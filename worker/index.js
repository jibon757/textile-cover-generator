// Backend (Cloudflare Worker). Every URL starting with /api/ comes here.
// All other URLs are served from the built website (dist folder).
//
// The database (Firestore) is ONLY written from here, using the service account
// stored as the Cloudflare secret FIREBASE_SERVICE_ACCOUNT. Browsers can't write to it directly.

import { Firestore } from "./firestore.js";
import { verifyIdToken, sha256Hex, readServiceAccount, getAccessToken } from "./google.js";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}
function errorResponse(err) {
  const msg = String(err?.message || err);
  if (msg.startsWith("QUOTA:")) return json({ ok: false, code: "quota", error: msg.slice(6).trim() }, 429);
  if (msg.startsWith("SETUP:")) return json({ ok: false, code: "setup", error: "Server setup problem: " + msg.slice(6).trim() }, 503);
  if (err?.status && err.status < 500) return json({ ok: false, code: err.code || "bad_request", error: msg }, err.status);
  console.error("API error:", err?.stack || msg);
  return json({ ok: false, code: "server", error: "Something went wrong on the server. Please try again.", detail: msg.slice(0, 300) }, 500);
}
function userError(message, status = 400, code = "bad_request") {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

// ---------- small helpers ----------
const clean = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const TEMPLATE_ID = /^[a-z0-9-]{1,40}$/;

function allowedImageUrl(url, env) {
  if (typeof url !== "string" || !url) return "";
  if (/^\/(img\/|gtec-logo)[\w./-]{0,120}$/.test(url)) return url; // pictures that ship with the website
  const prefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (url.startsWith(prefix) && url.length < 400 && !/[\s"'<>]/.test(url)) return url;
  return "";
}

export function collegeKey(name) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

const DEFAULT_COLLEGE = {
  id: "gopalganj-textile-engineering-college-gopalganj",
  name: "Gopalganj Textile Engineering College, Gopalganj",
  logoUrl: "/gtec-logo.jpeg",
};

async function getUser(request, env) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  return verifyIdToken(token, env.FIREBASE_PROJECT_ID);
}
async function requireUser(request, env) {
  const u = await getUser(request, env);
  if (!u) throw userError("Please reload the page and try again (visitor sign-in missing).", 401, "auth");
  return u;
}

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
async function rateLimit(db, uid, action, limit) {
  const { count } = await db.increment(`rateLimits/${action}_${uid}_${today()}`, { action, uid, day: today() }, { count: 1 });
  if (count > limit) throw userError(`Daily limit reached for this action (${limit} per day). Please try again tomorrow.`, 429, "limit");
}

// Simple edge cache (per Cloudflare location) for public lists.
async function cached(key, seconds, ctx, producer) {
  const cache = caches.default;
  const req = new Request("https://cache.internal/" + key);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await producer();
  ctx.waitUntil(cache.put(req, new Response(JSON.stringify(data), { headers: { "cache-control": `max-age=${seconds}` } })));
  return data;
}
async function bust(key) {
  await caches.default.delete(new Request("https://cache.internal/" + key));
}

// ---------- colleges ----------
async function listColleges(env, ctx) {
  const db = new Firestore(env);
  const items = await cached("colleges-v1", 120, ctx, async () => {
    let all = await db.list("colleges", 300);
    if (!all.find((c) => c.id === DEFAULT_COLLEGE.id)) {
      await db.createIfMissing("colleges", DEFAULT_COLLEGE.id, {
        name: DEFAULT_COLLEGE.name,
        logoUrl: DEFAULT_COLLEGE.logoUrl,
        source: "default",
        status: "visible",
        createdAt: new Date(),
      });
      all = [{ id: DEFAULT_COLLEGE.id, name: DEFAULT_COLLEGE.name, logoUrl: DEFAULT_COLLEGE.logoUrl, source: "default", status: "visible" }, ...all];
    }
    return all
      .filter((c) => c.status !== "hidden" && c.status !== "merged")
      .map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl || "", community: c.source === "community" }))
      .sort((a, b) => (a.id === DEFAULT_COLLEGE.id ? -1 : b.id === DEFAULT_COLLEGE.id ? 1 : a.name.localeCompare(b.name)));
  });
  return json({ ok: true, colleges: items });
}

async function addCollege(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const name = clean(body.name, 200);
  if (name.length < 5) throw userError("Please write the full college name.");
  const logoUrl = allowedImageUrl(body.logoUrl, env);
  if (body.logoUrl && !logoUrl) throw userError("The logo upload was not accepted. Please upload the logo again.");
  const id = collegeKey(name);
  if (!id) throw userError("Please write the college name in letters.");

  const db = new Firestore(env);
  const existing = await db.get("colleges/" + id);
  if (existing && existing.status !== "hidden") {
    return json({ ok: true, existed: true, college: { id, name: existing.name, logoUrl: existing.logoUrl || "", community: existing.source === "community" } });
  }
  await rateLimit(db, user.uid, "college", 5);
  const created = await db.createIfMissing("colleges", id, {
    name,
    logoUrl,
    source: "community",
    status: "visible",
    reviewed: false,
    createdBy: user.uid,
    createdAt: new Date(),
  });
  await bust("colleges-v1");
  return json({ ok: true, existed: !created, college: { id, name, logoUrl, community: true } });
}

// ---------- saved designs (NO personal data) ----------
export function sanitizeDesign(d, env) {
  const design = {
    subjectName: clean(d.subjectName, 150),
    subjectCode: clean(d.subjectCode, 40),
    reportType: clean(d.reportType, 80),
    department: clean(d.department, 120),
    level: clean(d.level, 4),
    term: clean(d.term, 4),
    collegeId: clean(d.collegeId, 120),
    collegeName: clean(d.collegeName, 200),
    logoUrl: allowedImageUrl(d.logoUrl, env),
    coverTemplate: TEMPLATE_ID.test(d.coverTemplate || "") ? d.coverTemplate : "",
    indexTemplate: TEMPLATE_ID.test(d.indexTemplate || "") ? d.indexTemplate : "",
    illustration: allowedImageUrl(d.illustration, env),
    feather: Math.max(0, Math.min(100, Math.round(Number(d.feather) || 0))),
    featherShape: d.featherShape === "soft-rect" ? "soft-rect" : "oval",
    blend: d.blend !== false,
  };
  return design;
}
function canonical(obj) {
  return JSON.stringify(Object.keys(obj).sort().reduce((o, k) => ((o[k] = typeof obj[k] === "string" ? obj[k].toLowerCase() : obj[k]), o), {}));
}

async function listDesigns(env, ctx) {
  const db = new Firestore(env);
  const items = await cached("designs-v1", 60, ctx, async () => {
    const rows = await db.query("savedDesigns", { orderBy: [["createdAt", "DESCENDING"]], limit: 300 });
    return rows.filter((r) => r.status !== "hidden").map(({ createdBy, status, ...rest }) => rest);
  });
  return json({ ok: true, designs: items });
}

async function saveDesign(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const design = sanitizeDesign(body.design || {}, env);
  if (!design.subjectName) throw userError("Write the subject name first.");
  if (!design.coverTemplate) throw userError("Choose a cover template first.");

  const id = (await sha256Hex(canonical(design))).slice(0, 40);
  const db = new Firestore(env);
  const existing = await db.get("savedDesigns/" + id);
  if (existing) return json({ ok: true, existed: true, id });

  await rateLimit(db, user.uid, "design", 30);
  const created = await db.createIfMissing("savedDesigns", id, { ...design, createdBy: user.uid, createdAt: new Date(), status: "visible" });
  if (created) {
    const subjectId = collegeKey((design.subjectCode + " " + design.subjectName).trim()) || "unknown";
    await db.increment("subjects/" + subjectId, { name: design.subjectName, code: design.subjectCode, department: design.department }, { designs: 1 });
  }
  await bust("designs-v1");
  return json({ ok: true, existed: !created, id });
}

// ---------- download stats / template ranking ----------
async function getStats(env, ctx) {
  const db = new Firestore(env);
  const stats = await cached("stats-v1", 300, ctx, async () => {
    const rows = await db.list("templateStats", 100);
    const out = { cover: {}, index: {} };
    for (const r of rows) if (r.kind === "cover" || r.kind === "index") out[r.kind][r.templateId] = r.downloads || 0;
    return out;
  });
  return json({ ok: true, stats });
}

// Counted only after a PDF was really created. The same document downloaded
// again by the same visitor is not counted twice.
async function recordDownload(env, user, meta, html) {
  try {
    const what = ["cover", "index", "both"].includes(meta.what) ? meta.what : null;
    if (!what) return;
    const db = new Firestore(env);
    const eventId = await sha256Hex(user.uid + "|" + what + "|" + (await sha256Hex(html)));
    const isNew = await db.createIfMissing("downloadEvents", eventId.slice(0, 40), {
      uid: user.uid,
      what,
      coverTemplate: TEMPLATE_ID.test(meta.coverTemplate || "") ? meta.coverTemplate : "",
      indexTemplate: TEMPLATE_ID.test(meta.indexTemplate || "") ? meta.indexTemplate : "",
      createdAt: new Date(),
    });
    if (!isNew) return;
    if ((what === "cover" || what === "both") && TEMPLATE_ID.test(meta.coverTemplate || "")) {
      await db.increment(`templateStats/cover_${meta.coverTemplate}`, { kind: "cover", templateId: meta.coverTemplate }, { downloads: 1 });
    }
    if ((what === "index" || what === "both") && TEMPLATE_ID.test(meta.indexTemplate || "")) {
      await db.increment(`templateStats/index_${meta.indexTemplate}`, { kind: "index", templateId: meta.indexTemplate }, { downloads: 1 });
    }
  } catch {
    // Stats must never break a download.
  }
}

// ---------- PDF ----------
const MAX_HTML_BYTES = 15 * 1024 * 1024;
const PDF_QUOTA_MSG = "Today's free PDF limit is used up. It resets at 6:00 AM (Bangladesh time).";

async function makePdf(request, env, ctx) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  if (!env.BROWSER || typeof env.BROWSER.quickAction !== "function") {
    return json({ ok: false, code: "pdf_unavailable", error: "PDF service is not connected (BROWSER binding missing)." }, 503);
  }
  const body = await request.json().catch(() => null);
  const html = typeof body?.html === "string" ? body.html : "";
  if (!html.includes('class="a4')) return json({ ok: false, error: "Nothing to print." }, 400);
  if (html.length > MAX_HTML_BYTES) return json({ ok: false, code: "too_large", error: "The page is too large. Please use smaller images." }, 413);

  const user = await getUser(request, env);
  if (user) {
    try {
      await rateLimit(new Firestore(env), user.uid, "pdf", 40);
    } catch (e) {
      if (e.code === "limit") return errorResponse(e);
      // database problems must not block the PDF
    }
  }

  try {
    const res = await env.BROWSER.quickAction("pdf", {
      html,
      gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      pdfOptions: { format: "a4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const quota = res.status === 429 || /limit|quota|exceed/i.test(text);
      return json({ ok: false, code: quota ? "quota" : "render_failed", error: quota ? PDF_QUOTA_MSG : "PDF could not be created. Please try again." }, quota ? 429 : 502);
    }
    const pdf = await res.arrayBuffer();
    if (user && body.meta) ctx.waitUntil(recordDownload(env, user, body.meta, html));
    return new Response(pdf, { headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
  } catch (err) {
    const quota = /limit|quota|429|exceed/i.test(String(err?.message || err));
    return json({ ok: false, code: quota ? "quota" : "render_failed", error: quota ? PDF_QUOTA_MSG : "PDF could not be created. Please try again." }, quota ? 429 : 502);
  }
}

// ---------- my document (Google sign-in only, owner only) ----------
const MAX_DOC_CHARS = 900_000;

async function myDoc(request, env) {
  const user = await requireUser(request, env);
  if (user.provider === "anonymous") throw userError("Sign in with Google to save your details in the cloud.", 403, "google_required");
  const db = new Firestore(env);
  const path = "userDocuments/" + user.uid;

  if (request.method === "GET") {
    const doc = await db.get(path);
    if (!doc?.data) return json({ ok: true, doc: null });
    try {
      return json({ ok: true, doc: JSON.parse(doc.data), updatedAt: doc.updatedAt });
    } catch {
      return json({ ok: true, doc: null });
    }
  }
  if (request.method === "PUT") {
    await rateLimit(db, user.uid, "mydoc", 400);
    const body = await request.json().catch(() => ({}));
    const data = JSON.stringify(body.doc || {});
    if (data.length > MAX_DOC_CHARS) throw userError("Your document is too big to save in the cloud (large images). It is still saved on this device.", 413, "too_large");
    await db.set(path, { data, updatedAt: new Date() }, false);
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await db.remove(path);
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed." }, 405);
}

// ---------- step-by-step database check (shows where setup is broken; never shows secrets) ----------
async function dbCheck(env) {
  const steps = [];
  const step = async (name, fn) => {
    try {
      const info = await fn();
      steps.push({ step: name, ok: true, ...(info || {}) });
      return true;
    } catch (e) {
      steps.push({ step: name, ok: false, error: String(e?.message || e).replace(/^SETUP:\s*/, "").slice(0, 400) });
      return false;
    }
  };
  let sa;
  const ok1 = await step("1. Read secret FIREBASE_SERVICE_ACCOUNT", async () => {
    sa = readServiceAccount(env);
    return { project_id: sa.project_id || "(missing)", client_email: sa.client_email };
  });
  const ok2 = ok1 && (await step("2. Project matches", async () => {
    if (sa.project_id && sa.project_id !== env.FIREBASE_PROJECT_ID) throw new Error(`The key is for project "${sa.project_id}", but the site uses "${env.FIREBASE_PROJECT_ID}".`);
  }));
  const ok3 = ok2 && (await step("3. Google accepts the key", async () => {
    await getAccessToken(env);
  }));
  const ok4 = ok3 && (await step("4. Firestore database reachable", async () => {
    await new Firestore(env).list("colleges", 1);
  }));
  return json({ ok: !!ok4, database: ok4 ? "connected" : "not connected", steps }, ok4 ? 200 : 500);
}

// ---------- router ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;

    try {
      if (p === "/api/health") {
        return json({
          ok: true,
          app: "Textile Cover Generator",
          version: env.APP_VERSION,
          time: new Date().toISOString(),
          firebaseProject: env.FIREBASE_PROJECT_ID,
          cloudinaryCloud: env.CLOUDINARY_CLOUD_NAME,
          pdfService: !!(env.BROWSER && typeof env.BROWSER.quickAction === "function"),
          databaseKey: !!env.FIREBASE_SERVICE_ACCOUNT,
        });
      }
      if (p === "/api/health/db") return await dbCheck(env);
      if (p === "/api/pdf") return await makePdf(request, env, ctx);
      if (p === "/api/colleges" && m === "GET") return await listColleges(env, ctx);
      if (p === "/api/colleges" && m === "POST") return await addCollege(request, env);
      if (p === "/api/designs" && m === "GET") return await listDesigns(env, ctx);
      if (p === "/api/designs" && m === "POST") return await saveDesign(request, env);
      if (p === "/api/stats" && m === "GET") return await getStats(env, ctx);
      if (p === "/api/my/doc") return await myDoc(request, env);
      if (p.startsWith("/api/")) return json({ ok: false, error: "Unknown API route: " + p }, 404);
    } catch (err) {
      return errorResponse(err);
    }
    return env.ASSETS.fetch(request);
  },
};
