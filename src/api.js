// Talks to our own backend (/api/...). Adds the visitor's sign-in token so the
// server knows who is asking (for fair-use limits and "my document").
import { auth, onAuthStateChanged } from "./firebase.js";

const CLOUDINARY_CLOUD = "hh9hmbra";
const CLOUDINARY_PRESET = "coverpc";

function authReady() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) {
        stop();
        resolve(u);
      }
    });
    setTimeout(() => resolve(auth.currentUser), 6000); // don't wait forever
  });
}

export async function authHeader() {
  const u = await authReady();
  if (!u) return {};
  try {
    return { authorization: "Bearer " + (await u.getIdToken()) };
  } catch {
    return {};
  }
}

export async function api(path, { method = "GET", body, auth: withAuth = true } = {}) {
  const headers = { ...(withAuth ? await authHeader() : {}) };
  if (body !== undefined) headers["content-type"] = "application/json";
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("No internet connection. Please check and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || "Something went wrong. Please try again.");
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

// Uploads a logo (data URL from imageTools) to Cloudinary and returns its https URL.
export async function uploadLogo(dataUrl, folder = "college-logos") {
  const form = new FormData();
  form.append("file", dataUrl);
  form.append("upload_preset", CLOUDINARY_PRESET);
  form.append("folder", folder);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: form });
  } catch {
    throw new Error("Logo upload failed: no internet connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error("Logo upload failed" + (data.error?.message ? ": " + data.error.message : ". Please try again."));
  }
  return data.secure_url;
}
