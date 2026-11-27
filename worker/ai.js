// AI picture makers ("providers") with automatic fallback.
//
// Default: Cloudflare Workers AI (free daily allowance, no key needed).
// More providers can be added later from the Admin panel (saved in Firestore
// collection "aiProviders", API keys encrypted). If one provider fails or its
// free limit is used up, the next one in priority order is tried.
//
// Trial pictures are NEVER stored by the server. They go straight back to the
// student's browser together with a signed "trial token". Only when the student
// downloads the cover PDF with that picture is it approved and saved for everyone.

import { sha256Hex } from "./google.js";

const enc = new TextEncoder();

// ---------- small crypto helpers ----------
function b64(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

// Master secret: the Worker secret AI_KEYS_SECRET if set, otherwise derived from
// the (already secret) service-account key, so no extra setup is needed.
async function masterBytes(env, purpose) {
  const base = env.AI_KEYS_SECRET || env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!base) throw new Error("SETUP: no server secret available for signing.");
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(purpose + "|" + base)));
}

// Trial token = proof that THIS server made THIS exact picture (valid 2 days).
export async function signTrial(env, data) {
  const key = await crypto.subtle.importKey("raw", await masterBytes(env, "trial"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const body = b64url(enc.encode(JSON.stringify(data)));
  const sig = b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body))));
  return body + "." + sig;
}
export async function verifyTrial(env, token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const key = await crypto.subtle.importKey("raw", await masterBytes(env, "trial"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// AES-GCM for provider API keys stored in Firestore (used by the Admin panel).
async function aesKey(env) {
  return crypto.subtle.importKey("raw", await masterBytes(env, "ai-keys"), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSecret(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), enc.encode(plain));
  return b64(iv) + ":" + b64(new Uint8Array(ct));
}
export async function decryptSecret(env, stored) {
  if (!stored) return "";
  const [iv, ct] = stored.split(":");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

// ---------- prompt ----------
const SCENES = [
  [/colou?r|dye|dyeing|wet process/i, "textile dyeing: colorful dye baths, dyed yarn hanks and fabric swatches, laboratory beakers with colored dye solutions"],
  [/print/i, "textile printing: printing screen with squeegee, printed fabric with colorful patterns"],
  [/pretreat|scour|bleach|chemical|chemistry/i, "textile chemistry laboratory: glass flasks, beakers, test tubes and fabric swatches"],
  [/finish/i, "textile finishing: rolls of smooth finished fabric, finishing machine rollers"],
  [/yarn|spin/i, "yarn manufacturing: spinning frame with bobbins, cotton fibres turning into yarn, cones of yarn"],
  [/fibre|fiber|polymer/i, "textile fibres: cotton boll, fibre strands and microscope view of fibres"],
  [/fabric|weav|loom/i, "weaving: loom with warp and weft yarns forming woven fabric"],
  [/knit/i, "knitting: knitting machine needles and knitted fabric loops"],
  [/apparel|garment|sewing|cad/i, "apparel manufacturing: sewing machine, garment pattern pieces, measuring tape"],
  [/fashion|design/i, "fashion design: dress form mannequin, sketches and fabric swatches"],
  [/test|quality|physical/i, "textile testing laboratory: fabric strength tester, magnifying glass on fabric, measuring tools"],
  [/machine|mechanic|maintenance/i, "textile machinery: gears, rollers and machine parts"],
  [/electr/i, "electrical engineering: circuit board, motor and wires"],
  [/math|statistic/i, "mathematics: graphs, formulas and geometric shapes"],
  [/physics/i, "physics laboratory: pendulum, lenses and light rays"],
];

export function buildPrompt(subjectName, idea) {
  const s = String(subjectName || "").slice(0, 120);
  const scene = (SCENES.find(([re]) => re.test(s)) || [null, `an illustration representing the subject "${s}" in textile engineering`])[1];
  const extra = idea ? ` Details: ${String(idea).slice(0, 200)}.` : "";
  return (
    `Clean modern flat vector illustration for a university lab report cover about "${s}": ${scene}.${extra} ` +
    "Centered composition, soft pastel colors, pure white background, soft edges fading into white, " +
    "no border, no frame, no text, no letters, no watermark."
  );
}

// ---------- adapters ----------
// Each returns { bytes: Uint8Array, mime } or throws. Errors starting with "QUOTA:" mean "free limit used up".
async function readImageResponse(res, name) {
  if (res.status === 429 || res.status === 402) throw new Error(`QUOTA: ${name} limit reached.`);
  if (!res.ok) throw new Error(`${name} failed (HTTP ${res.status}).`);
  const type = res.headers.get("content-type") || "";
  if (type.startsWith("image/")) return { bytes: new Uint8Array(await res.arrayBuffer()), mime: type.split(";")[0] };
  const j = await res.json().catch(() => ({}));
  const b = j.data?.[0]?.b64_json || j.image || j.images?.[0];
  if (b) return { bytes: unb64(b.replace(/^data:[^,]+,/, "")), mime: "image/png" };
  const url = j.data?.[0]?.url;
  if (url) {
    const r2 = await fetch(url);
    if (r2.ok) return { bytes: new Uint8Array(await r2.arrayBuffer()), mime: r2.headers.get("content-type") || "image/png" };
  }
  throw new Error(`${name} returned no image.`);
}

const ADAPTERS = {
  // Cloudflare Workers AI (binding "AI"). Free: 10,000 neurons per day, resets 00:00 UTC (6:00 AM Bangladesh).
  "workers-ai": async (p, prompt, env) => {
    if (!env.AI) throw new Error("Workers AI is not connected (AI binding missing).");
    let out;
    try {
      out = await env.AI.run(p.model || "@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4, seed: Math.floor(Math.random() * 1e9) });
    } catch (e) {
      const m = String(e?.message || e);
      if (/neuron|quota|limit|exceed|429|4006/i.test(m)) throw new Error("QUOTA: Workers AI daily free limit reached.");
      throw new Error("Workers AI failed: " + m.slice(0, 160));
    }
    if (out?.image) return { bytes: unb64(out.image), mime: "image/jpeg" };
    if (out instanceof ReadableStream || out instanceof ArrayBuffer || out instanceof Uint8Array) {
      return { bytes: new Uint8Array(await new Response(out).arrayBuffer()), mime: "image/png" };
    }
    throw new Error("Workers AI returned no image.");
  },
  "huggingface": async (p, prompt) => {
    const res = await fetch(p.endpoint || `https://router.huggingface.co/hf-inference/models/${p.model || "black-forest-labs/FLUX.1-schnell"}`, {
      method: "POST",
      headers: { authorization: "Bearer " + p.apiKey, "content-type": "application/json", accept: "image/png" },
      body: JSON.stringify({ inputs: prompt }),
    });
    return readImageResponse(res, "Hugging Face");
  },
  "together": async (p, prompt) => {
    const res = await fetch(p.endpoint || "https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { authorization: "Bearer " + p.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ model: p.model || "black-forest-labs/FLUX.1-schnell-Free", prompt, width: 1024, height: 1024, steps: 4, n: 1, response_format: "b64_json" }),
    });
    return readImageResponse(res, "Together AI");
  },
  "openai-compatible": async (p, prompt) => {
    if (!p.endpoint) throw new Error("This provider has no endpoint set.");
    const res = await fetch(p.endpoint, {
      method: "POST",
      headers: { ...(p.apiKey ? { authorization: "Bearer " + p.apiKey } : {}), "content-type": "application/json" },
      body: JSON.stringify({ model: p.model, prompt, n: 1, size: "1024x1024", response_format: "b64_json" }),
    });
    return readImageResponse(res, p.name || "Image provider");
  },
  "gemini": async (p, prompt) => {
    const model = p.model || "imagen-4.0-fast-generate-001";
    const res = await fetch(p.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
      method: "POST",
      headers: { "x-goog-api-key": p.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
    });
    if (res.status === 429) throw new Error("QUOTA: Google image limit reached.");
    if (!res.ok) throw new Error(`Google image failed (HTTP ${res.status}).`);
    const j = await res.json();
    const b = j.predictions?.[0]?.bytesBase64Encoded;
    if (!b) throw new Error("Google returned no image.");
    return { bytes: unb64(b), mime: j.predictions[0].mimeType || "image/png" };
  },
  // Free, no key, but slow and shared (one picture per 45 s per server address). Off by default.
  "pollinations": async (p, prompt) => {
    const res = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`);
    return readImageResponse(res, "Pollinations");
  },
};
export const PROVIDER_TYPES = Object.keys(ADAPTERS);

// Built-in default. Admin-panel providers (Firestore "aiProviders") are added to this list.
const DEFAULT_PROVIDERS = [{ id: "workers-ai", type: "workers-ai", name: "Cloudflare Workers AI", enabled: true, priority: 1, dailyLimit: 150 }];

export async function loadProviders(env, db) {
  let saved = [];
  try {
    saved = await db.list("aiProviders", 50);
  } catch {
    saved = [];
  }
  const byId = new Map(DEFAULT_PROVIDERS.map((p) => [p.id, { ...p }]));
  for (const s of saved) byId.set(s.id, { ...(byId.get(s.id) || {}), ...s });
  const list = [...byId.values()].filter((p) => p.enabled !== false && ADAPTERS[p.type]).sort((a, b) => (a.priority || 99) - (b.priority || 99));
  for (const p of list) {
    if (p.apiKeyEnc) {
      try {
        p.apiKey = await decryptSecret(env, p.apiKeyEnc);
      } catch {
        p.apiKey = "";
      }
    }
  }
  return list;
}

function dayUTC() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

// Tries each provider in order. Each provider also has a site-wide daily cap so the
// free allowance is never overrun.
export async function generateWithFallback(env, db, prompt) {
  const providers = await loadProviders(env, db);
  const problems = [];
  let quotaOnly = true;
  for (const p of providers) {
    const usageId = `aiUsage/${p.id}_${dayUTC()}`;
    if (p.dailyLimit) {
      const u = await db.get(usageId).catch(() => null);
      if (u && u.count >= p.dailyLimit) {
        problems.push(p.name + ": daily limit reached");
        continue;
      }
    }
    try {
      const img = await ADAPTERS[p.type](p, prompt, env);
      if (!img.bytes?.length) throw new Error("empty image");
      await db.increment(usageId, { provider: p.id, day: dayUTC() }, { count: 1 }).catch(() => {});
      return { ...img, provider: p.id };
    } catch (e) {
      const m = String(e?.message || e);
      if (!m.startsWith("QUOTA:")) quotaOnly = false;
      problems.push((p.name || p.id) + ": " + m.replace(/^QUOTA:\s*/, ""));
    }
  }
  const err = new Error(
    quotaOnly
      ? "QUOTA: Today's free AI picture limit is used up. It resets at 6:00 AM (Bangladesh time). You can still use the ready pictures or your own image."
      : "AI picture could not be made right now. Please try again, or use a ready picture."
  );
  err.problems = problems;
  if (!quotaOnly) {
    err.status = 503;
    err.expose = true;
    err.code = "ai_failed";
  }
  throw err;
}

export { sha256Hex, b64 };
