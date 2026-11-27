// Tiny Firestore REST client used only by the Worker (with the service account).
import { getAccessToken } from "./google.js";

// ---- convert plain JS <-> Firestore "typed" values ----
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
export function toFields(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = toValue(v);
  return f;
}
export function fromValue(v) {
  if (!v) return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
export function fromFields(fields = {}) {
  const o = {};
  for (const [k, v] of Object.entries(fields)) o[k] = fromValue(v);
  return o;
}
export function docId(name) {
  return name.split("/").pop();
}

export class Firestore {
  constructor(env, fetchImpl = fetch) {
    this.env = env;
    this.fetch = fetchImpl;
    this.root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
    this.base = "https://firestore.googleapis.com/v1/" + this.root;
  }

  async call(url, init = {}) {
    const token = await getAccessToken(this.env, this.fetch);
    const res = await this.fetch(url, {
      ...init,
      headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(init.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  fail(r, what) {
    const msg = r.data?.error?.message || "HTTP " + r.status;
    if (r.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(msg)) {
      const e = new Error("QUOTA: The free database limit for today is used up. It resets at 2:00 PM (Bangladesh time).");
      e.status = 429;
      throw e;
    }
    if (r.status === 404 && /database/i.test(msg)) throw new Error("SETUP: Firestore database not found. Create it in the Firebase console.");
    if (r.status === 403) throw new Error("SETUP: The service account has no permission for Firestore (" + msg + ").");
    throw new Error(what + " failed: " + msg);
  }

  // Returns plain object with `id`, or null if it doesn't exist.
  async get(path) {
    const r = await this.call(this.base + "/" + path);
    if (r.status === 404) return null;
    if (!r.ok) this.fail(r, "Read");
    return { id: docId(r.data.name), ...fromFields(r.data.fields) };
  }

  // Creates a document only if it does not exist. Returns true if created, false if it already existed.
  async createIfMissing(collection, id, data) {
    const r = await this.call(`${this.base}/${collection}?documentId=${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ fields: toFields(data) }),
    });
    if (r.status === 409) return false;
    if (!r.ok) this.fail(r, "Create");
    return true;
  }

  // Creates or overwrites the given fields.
  async set(path, data, merge = true) {
    const mask = merge ? Object.keys(data).map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&") : "";
    const r = await this.call(`${this.base}/${path}${mask ? "?" + mask : ""}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: toFields(data) }),
    });
    if (!r.ok) this.fail(r, "Save");
    return true;
  }

  async remove(path) {
    const r = await this.call(this.base + "/" + path, { method: "DELETE" });
    if (!r.ok && r.status !== 404) this.fail(r, "Delete");
  }

  // Upsert `fields` and add `incBy` to numeric fields atomically. Returns the new values of the incremented fields.
  async increment(path, fields, incBy) {
    const r = await this.call(this.base.replace(/\/documents$/, "/documents:commit"), {
      method: "POST",
      body: JSON.stringify({
        writes: [
          {
            update: { name: this.root + "/" + path, fields: toFields(fields) },
            updateMask: { fieldPaths: Object.keys(fields) },
            updateTransforms: Object.entries(incBy).map(([fieldPath, n]) => ({ fieldPath, increment: { integerValue: String(n) } })),
          },
        ],
      }),
    });
    if (!r.ok) this.fail(r, "Update");
    const results = r.data.writeResults?.[0]?.transformResults || [];
    const out = {};
    Object.keys(incBy).forEach((k, i) => (out[k] = fromValue(results[i])));
    return out;
  }

  async list(collection, pageSize = 300) {
    const r = await this.call(`${this.base}/${collection}?pageSize=${pageSize}`);
    if (!r.ok) this.fail(r, "List");
    return (r.data.documents || []).map((d) => ({ id: docId(d.name), ...fromFields(d.fields) }));
  }

  // where: [[field, op, value]] with op like "EQUAL", "GREATER_THAN_OR_EQUAL", "LESS_THAN"
  async query(collection, { where = [], orderBy = [], limit = 50 } = {}) {
    const filters = where.map(([field, op, value]) => ({ fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) } }));
    const structuredQuery = {
      from: [{ collectionId: collection }],
      limit,
      ...(filters.length === 1 ? { where: filters[0] } : filters.length > 1 ? { where: { compositeFilter: { op: "AND", filters } } } : {}),
      ...(orderBy.length ? { orderBy: orderBy.map(([field, dir]) => ({ field: { fieldPath: field }, direction: dir || "ASCENDING" })) } : {}),
    };
    const r = await this.call(this.base.replace(/\/documents$/, "/documents:runQuery"), {
      method: "POST",
      body: JSON.stringify({ structuredQuery }),
    });
    if (!r.ok) this.fail(r, "Search");
    return (Array.isArray(r.data) ? r.data : []).filter((x) => x.document).map((x) => ({ id: docId(x.document.name), ...fromFields(x.document.fields) }));
  }
}
