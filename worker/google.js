// Google helpers for the Worker:
//  1) getAccessToken(env): signs in to Google as the Firebase service account
//     (secret FIREBASE_SERVICE_ACCOUNT) so the Worker can read/write Firestore.
//  2) verifyIdToken(token, projectId): checks a visitor's Firebase login token
//     (anonymous or Google) and returns { uid, provider } — or null if invalid.

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlJson(obj) {
  return b64url(enc.encode(JSON.stringify(obj)));
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function readServiceAccount(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("SETUP: secret FIREBASE_SERVICE_ACCOUNT is missing in Cloudflare.");
  let sa;
  try {
    sa = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("SETUP: FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole downloaded file.");
  }
  if (!sa.client_email || !sa.private_key) throw new Error("SETUP: FIREBASE_SERVICE_ACCOUNT is missing client_email/private_key.");
  return sa;
}

let tokenCache = { token: null, exp: 0 };

export async function getAccessToken(env, fetchImpl = fetch) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.exp - 120 > now) return tokenCache.token;

  const sa = readServiceAccount(env);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64urlJson(header) + "." + b64urlJson(claims);
  let key;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(sa.private_key.replace(/\\n/g, "\n")),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  } catch (e) {
    throw new Error("SETUP: The private_key inside FIREBASE_SERVICE_ACCOUNT could not be read (" + (e?.message || e) + "). Paste the whole JSON file again.");
  }
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const jwt = unsigned + "." + b64url(sig);

  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error("SETUP: Google refused the service account (" + (data.error_description || data.error || res.status) + ").");
  }
  tokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

let jwkCache = { keys: null, exp: 0 };
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

async function getJwks(fetchImpl) {
  const now = Date.now();
  if (jwkCache.keys && jwkCache.exp > now) return jwkCache.keys;
  const res = await fetchImpl(JWK_URL);
  const data = await res.json();
  const m = /max-age=(\d+)/.exec(res.headers.get("cache-control") || "");
  jwkCache = { keys: data.keys || [], exp: now + (m ? Number(m[1]) * 1000 : 3600_000) };
  return jwkCache.keys;
}

export async function verifyIdToken(token, projectId, fetchImpl = fetch) {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (header.alg !== "RS256") return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) return null;
    if (payload.iss !== "https://securetoken.google.com/" + projectId) return null;
    if (!payload.sub || payload.exp < now - 30 || payload.iat > now + 300) return null;

    const jwk = (await getJwks(fetchImpl)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlDecode(s), enc.encode(h + "." + p));
    if (!ok) return null;
    return {
      uid: payload.sub,
      provider: payload.firebase?.sign_in_provider || "unknown",
      email: payload.email || null,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// For tests only.
export function _resetCaches() {
  tokenCache = { token: null, exp: 0 };
  jwkCache = { keys: null, exp: 0 };
}
