// Admin panel backend. EVERY /api/admin/* request is checked here, on the server:
// the visitor must be signed in with Google, with a verified email that is listed in
// the Cloudflare secret ADMIN_EMAILS (comma separated). The website only hides the
// Admin link; the real protection is this check.

import { Firestore } from "./firestore.js";
import { DEFAULT_PROVIDERS, PROVIDER_TYPES, encryptSecret, decryptSecret, testProvider, buildPrompt, b64 } from "./ai.js";

export const DEFAULT_SETTINGS = {
  notice: "", // message shown at the top of the website (empty = none)
  aiEnabled: true, // AI pictures on/off for students
  aiPerDay: 9, // AI pictures per visitor per day
  uploadMaxMB: 3, // biggest picture/logo a student may choose (before compression)
  hiddenCover: [], // cover template ids hidden from students
  hiddenIndex: [], // index template ids hidden from students
  // Auto-approve: ON = what students add is public at once. OFF = it waits ("pending")
  // until the owner presses Approve in the Admin panel.
  autoDesigns: true,
  autoImages: true,
  autoColleges: true,
};

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readSettings(db) {
  const s = await db.get("adminSettings/site").catch(() => null);
  return { ...DEFAULT_SETTINGS, ...(s || {}), id: undefined };
}

function adminEmails(env) {
  return String(env.ADMIN_EMAILS || "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(user, env) {
  if (!user || user.provider !== "google.com" || !user.email || !user.emailVerified) return false;
  return adminEmails(env).includes(user.email.toLowerCase());
}

const ID = /^[A-Za-z0-9_-]{1,120}$/;
const mask = (k) => (k ? "••••" + String(k).slice(-4) : "");
const day = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

export async function handleAdmin(request, env, ctx, h) {
  const { json, userError, bust, allowedImageUrl, clean, getUser } = h;
  const url = new URL(request.url);
  const p = url.pathname.replace(/^\/api\/admin/, "") || "/";
  const m = request.method;

  const user = await getUser(request, env);
  // "/me" tells the website whether to show the Admin link (never an error).
  if (p === "/me") {
    const configured = adminEmails(env).length > 0;
    return json({ ok: true, admin: await isAdmin(user, env), configured, email: user?.email || null });
  }
  if (!(await isAdmin(user, env))) {
    if (!adminEmails(env).length) throw userError("Admin is not set up yet: add the secret ADMIN_EMAILS in Cloudflare.", 403, "admin_setup");
    throw userError("Owner only. Sign in with the owner's Google account.", 403, "not_admin");
  }

  const db = new Firestore(env);
  const body = m === "GET" || m === "DELETE" ? {} : await request.json().catch(() => ({}));
  const idFrom = (prefix) => {
    const id = decodeURIComponent(p.slice(prefix.length));
    if (!ID.test(id)) throw userError("Bad id.");
    return id;
  };

  // ---------- overview / stats ----------
  if (p === "/overview" && m === "GET") {
    const [colleges, designs, approved, common, tstats, usage] = await Promise.all([
      db.list("colleges", 300).catch(() => []),
      db.list("savedDesigns", 300).catch(() => []),
      db.list("approvedImages", 300).catch(() => []),
      db.list("commonImages", 300).catch(() => []),
      db.list("templateStats", 100).catch(() => []),
      db.list("aiUsage", 300).catch(() => []),
    ]);
    const today = day();
    return json({
      ok: true,
      counts: {
        colleges: colleges.length,
        collegesToReview: colleges.filter((c) => c.source === "community" && !c.reviewed && c.status !== "hidden" && c.status !== "merged").length,
        designs: designs.length,
        pendingDesigns: designs.filter((x) => x.status === "pending").length,
        pendingImages: approved.filter((x) => x.status === "pending").length,
        pendingColleges: colleges.filter((x) => x.status === "pending").length,
        approvedImages: approved.length,
        sharedUploads: approved.filter((a) => a.source === "upload").length,
        commonImages: common.length,
      },
      downloads: tstats.map((t) => ({ kind: t.kind, templateId: t.templateId, downloads: t.downloads || 0 })),
      aiToday: usage.filter((u) => u.day === today).map((u) => ({ provider: u.provider, count: u.count || 0 })),
      note: "Lists show up to 300 items.",
    });
  }

  // ---------- settings ----------
  if (p === "/settings" && m === "GET") return json({ ok: true, settings: await readSettings(db) });
  if (p === "/settings" && m === "PUT") {
    const s = body.settings || {};
    const ids = (a) => (Array.isArray(a) ? a.filter((x) => /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 30) : []);
    const next = {
      notice: clean(s.notice, 300),
      aiEnabled: s.aiEnabled !== false,
      aiPerDay: Math.max(0, Math.min(30, Math.round(Number(s.aiPerDay) || 0))),
      uploadMaxMB: Math.max(1, Math.min(10, Math.round(Number(s.uploadMaxMB) || 3))),
      hiddenCover: ids(s.hiddenCover),
      hiddenIndex: ids(s.hiddenIndex),
      autoDesigns: s.autoDesigns !== false,
      autoImages: s.autoImages !== false,
      autoColleges: s.autoColleges !== false,
      updatedAt: new Date(),
    };
    await db.set("adminSettings/site", next, false);
    await bust("settings-v1");
    return json({ ok: true, settings: next });
  }

  // ---------- AI providers ----------
  if (p === "/providers" && m === "GET") {
    const saved = await db.list("aiProviders", 50).catch(() => []);
    const byId = new Map(DEFAULT_PROVIDERS.map((x) => [x.id, { ...x, builtIn: true }]));
    for (const s of saved) byId.set(s.id, { ...(byId.get(s.id) || {}), ...s });
    const list = [...byId.values()].sort((a, b) => (a.priority || 99) - (b.priority || 99));
    const out = [];
    for (const x of list) {
      let last = "";
      if (x.apiKeyEnc) {
        try {
          last = mask(await decryptSecret(env, x.apiKeyEnc));
        } catch {
          last = "(key unreadable – enter it again)";
        }
      }
      out.push({
        id: x.id,
        name: x.name || x.id,
        type: x.type,
        model: x.model || "",
        endpoint: x.endpoint || "",
        enabled: x.enabled !== false,
        priority: x.priority || 99,
        dailyLimit: x.dailyLimit || 0,
        builtIn: !!x.builtIn,
        hasKey: !!x.apiKeyEnc,
        keyHint: last,
      });
    }
    return json({ ok: true, providers: out, types: PROVIDER_TYPES });
  }
  if (p === "/providers" && m === "POST") {
    const x = body.provider || {};
    const builtIn = DEFAULT_PROVIDERS.find((d) => d.id === x.id);
    const id = x.id ? String(x.id) : "p-" + crypto.randomUUID().slice(0, 8);
    if (!ID.test(id)) throw userError("Bad provider id.");
    const type = builtIn ? builtIn.type : String(x.type || "");
    if (!PROVIDER_TYPES.includes(type)) throw userError("Choose a provider type.");
    const endpoint = clean(x.endpoint, 400);
    if (endpoint && !/^https:\/\/[^\s"'<>]+$/.test(endpoint)) throw userError("Endpoint must start with https://");
    const doc = {
      name: clean(x.name, 80) || (builtIn ? builtIn.name : type),
      type,
      model: clean(x.model, 200),
      endpoint,
      enabled: x.enabled !== false,
      priority: Math.max(1, Math.min(99, Math.round(Number(x.priority) || 10))),
      dailyLimit: Math.max(0, Math.min(100000, Math.round(Number(x.dailyLimit) || 0))),
      updatedAt: new Date(),
    };
    if (typeof x.apiKey === "string" && x.apiKey.trim()) doc.apiKeyEnc = await encryptSecret(env, x.apiKey.trim());
    if (x.removeKey) doc.apiKeyEnc = "";
    await db.set("aiProviders/" + id, doc, true);
    return json({ ok: true, id });
  }
  if (p.startsWith("/providers/") && p.endsWith("/test") && m === "POST") {
    const id = decodeURIComponent(p.slice("/providers/".length, -"/test".length));
    if (!ID.test(id)) throw userError("Bad id.");
    const saved = await db.get("aiProviders/" + id).catch(() => null);
    const base = DEFAULT_PROVIDERS.find((d) => d.id === id) || {};
    const prov = { ...base, ...(saved || {}) };
    if (!prov.type) throw userError("Provider not found.", 404, "not_found");
    if (prov.apiKeyEnc) prov.apiKey = await decryptSecret(env, prov.apiKeyEnc).catch(() => "");
    const started = Date.now();
    try {
      const img = await testProvider(env, prov, buildPrompt("Textile Coloration"));
      return json({ ok: true, image: `data:${img.mime};base64,${b64(img.bytes)}`, ms: Date.now() - started });
    } catch (e) {
      return json({ ok: false, code: "test_failed", error: "Test failed: " + String(e?.message || e).replace(/^QUOTA:\s*/, "").slice(0, 300) }, 200);
    }
  }
  if (p.startsWith("/providers/") && m === "DELETE") {
    const id = idFrom("/providers/");
    if (DEFAULT_PROVIDERS.find((d) => d.id === id)) {
      await db.remove("aiProviders/" + id); // back to built-in default settings
      return json({ ok: true, reset: true });
    }
    await db.remove("aiProviders/" + id);
    return json({ ok: true });
  }

  // ---------- pictures ----------
  if (p === "/images" && m === "GET") {
    const [approved, common] = await Promise.all([
      db.query("approvedImages", { orderBy: [["createdAt", "DESCENDING"]], limit: 300 }).catch(() => []),
      db.list("commonImages", 300).catch(() => []),
    ]);
    return json({
      ok: true,
      approved: approved.map((r) => ({ id: r.id, url: r.url, subjectName: r.subjectName || "", subjectCode: r.subjectCode || "", source: r.source || "ai", status: r.status || "visible", createdAt: r.createdAt || "" })),
      common: common.map((r) => ({ id: r.id, url: r.url, title: r.title || "", tags: r.tags || "", status: r.status || "visible" })),
    });
  }
  if (p === "/common" && m === "POST") {
    const urlOk = allowedImageUrl(body.url, env);
    if (!urlOk || !urlOk.startsWith("https://")) throw userError("Upload the picture first (Cloudinary link not accepted).");
    const id = "c-" + crypto.randomUUID().slice(0, 12);
    await db.set("commonImages/" + id, { url: urlOk, title: clean(body.title, 80), tags: clean(body.tags, 200).toLowerCase(), status: "visible", createdAt: new Date() }, false);
    await bust("images-v1");
    return json({ ok: true, id });
  }
  // Owner adds a picture for one subject (shown first to students who type that subject).
  if (p === "/approved" && m === "POST") {
    const urlOk = allowedImageUrl(body.url, env);
    if (!urlOk || !urlOk.startsWith("https://")) throw userError("Upload the picture first (Cloudinary link not accepted).");
    const n = clean(body.subjectName, 150);
    const c = clean(body.subjectCode, 40);
    if (n.length < 2 && c.length < 2) throw userError("Write the subject name (or code) for these pictures.");
    const id = "o-" + (await sha(urlOk)).slice(0, 38);
    await db.set(
      "approvedImages/" + id,
      { url: urlOk, subjectName: n, subjectCode: c, subjectKey: h.collegeKey((c + " " + n).trim()), provider: "", source: "owner", status: "visible", createdAt: new Date() },
      false,
    );
    await bust("images-v1");
    return json({ ok: true, id });
  }
  for (const [route, coll] of [["/common/", "commonImages"], ["/approved/", "approvedImages"]]) {
    if (p.startsWith(route)) {
      const id = idFrom(route);
      if (m === "PATCH") {
        const patch = { status: body.status === "hidden" ? "hidden" : "visible", reviewedAt: new Date() };
        if (coll === "commonImages") {
          if (typeof body.title === "string") patch.title = clean(body.title, 80);
          if (typeof body.tags === "string") patch.tags = clean(body.tags, 200).toLowerCase();
        }
        await db.set(`${coll}/${id}`, patch, true);
      } else if (m === "DELETE") {
        await db.remove(`${coll}/${id}`);
      } else break;
      await bust("images-v1");
      return json({ ok: true });
    }
  }

  // ---------- colleges ----------
  if (p === "/colleges" && m === "GET") {
    await h.ensureDefaultCollege(db).catch(() => {});
    const rows = await db.list("colleges", 300).catch(() => []);
    return json({
      ok: true,
      colleges: rows
        .map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl || "", source: c.source || "", status: c.status || "visible", reviewed: !!c.reviewed, mergedInto: c.mergedInto || "" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  if (p.startsWith("/colleges/") && m === "PATCH") {
    const id = idFrom("/colleges/");
    const cur = await db.get("colleges/" + id);
    if (!cur) throw userError("College not found.", 404, "not_found");
    const patch = { reviewed: true };
    if (typeof body.name === "string") {
      const n = clean(body.name, 200);
      if (n.length < 5) throw userError("Please write the full college name.");
      patch.name = n;
    }
    if (typeof body.logoUrl === "string") {
      const l = body.logoUrl ? allowedImageUrl(body.logoUrl, env) : "";
      if (body.logoUrl && !l) throw userError("Logo link not accepted. Upload the logo again.");
      patch.logoUrl = l;
    }
    if (body.status === "hidden" || body.status === "visible") patch.status = body.status;
    if (body.status === "visible") patch.mergedInto = "";
    if (body.mergeInto) {
      const target = String(body.mergeInto);
      if (!ID.test(target) || target === id) throw userError("Choose another college to merge into.");
      if (!(await db.get("colleges/" + target))) throw userError("That college does not exist.");
      patch.status = "merged";
      patch.mergedInto = target;
    }
    await db.set("colleges/" + id, patch, true);
    await bust("colleges-v1");
    return json({ ok: true });
  }
  if (p === "/colleges" && m === "POST") {
    const n = clean(body.name, 200);
    if (n.length < 5) throw userError("Please write the full college name.");
    const id = h.collegeKey(n);
    const logo = body.logoUrl ? allowedImageUrl(body.logoUrl, env) : "";
    const created = await db.createIfMissing("colleges", id, { name: n, logoUrl: logo, source: "admin", status: "visible", reviewed: true, createdAt: new Date() });
    if (!created) throw userError("A college with this name already exists.", 409, "exists");
    await bust("colleges-v1");
    return json({ ok: true, id });
  }

  // ---------- saved designs ----------
  if (p === "/designs" && m === "GET") {
    const rows = await db.query("savedDesigns", { orderBy: [["createdAt", "DESCENDING"]], limit: 300 }).catch(() => []);
    return json({
      ok: true,
      designs: rows.map((d) => ({ id: d.id, subjectName: d.subjectName, subjectCode: d.subjectCode, collegeName: d.collegeName, coverTemplate: d.coverTemplate, illustration: d.illustration || "", status: d.status || "visible", createdAt: d.createdAt || "" })),
    });
  }
  if (p.startsWith("/designs/")) {
    const id = idFrom("/designs/");
    if (m === "PATCH") await db.set("savedDesigns/" + id, { status: body.status === "hidden" ? "hidden" : "visible", reviewedAt: new Date() }, true);
    else if (m === "DELETE") await db.remove("savedDesigns/" + id);
    else return json({ ok: false, error: "Method not allowed." }, 405);
    await bust("designs-v1");
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown admin route: " + p }, 404);
}
