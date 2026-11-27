// Admin panel (owner only). Opened with the "Admin panel" link or the address …/#admin.
// The server checks EVERY admin request (Google sign-in + email in ADMIN_EMAILS),
// so hiding this page is only for comfort, not for security.
import { useCallback, useEffect, useState } from "react";
import { api, uploadLogo } from "../api.js";
import { readImageFile } from "../imageTools.js";
import { COVER_TEMPLATES } from "../templates/covers.jsx";
import { INDEX_TEMPLATES } from "../templates/indexes.jsx";

const TABS = [
  ["overview", "📊 Overview"],
  ["ai", "🤖 AI providers"],
  ["images", "🖼️ Pictures"],
  ["colleges", "🏫 Colleges"],
  ["designs", "📁 Designs"],
  ["settings", "⚙️ Settings"],
];

const TYPE_HELP = {
  "workers-ai-flux2": "Cloudflare Workers AI, FLUX.2 klein (landscape). No key needed.",
  "workers-ai": "Cloudflare Workers AI, FLUX.1 schnell (square). No key needed.",
  huggingface: "Hugging Face Inference. Needs an access token. Model e.g. black-forest-labs/FLUX.1-schnell",
  together: "Together AI. Needs an API key. Model e.g. black-forest-labs/FLUX.1-schnell-Free",
  "openai-compatible": "Any OpenAI-style /images/generations endpoint. Needs endpoint (+ key if required).",
  gemini: "Google Imagen (Gemini API). Needs an API key. Model e.g. imagen-4.0-fast-generate-001",
  pollinations: "Pollinations (free, no key, slow).",
};

function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setError("");
    try {
      setData(await api(path));
    } catch (e) {
      setError(e.message);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

function Loading({ error, retry }) {
  if (error)
    return (
      <div className="adm-empty">
        <p className="adm-err">{error}</p>
        <button className="btn-outline" onClick={retry}>Try again</button>
      </div>
    );
  return (
    <p className="adm-empty">
      <span className="spinner dark" /> Loading…
    </p>
  );
}

// ---------------- Overview ----------------
function Overview() {
  const { data, error, reload } = useLoad("/api/admin/overview");
  if (!data) return <Loading error={error} retry={reload} />;
  const c = data.counts;
  const name = (kind, id) => ((kind === "cover" ? COVER_TEMPLATES : INDEX_TEMPLATES).find((t) => t.id === id)?.name || id);
  return (
    <>
      <div className="adm-stats">
        <div><b>{c.colleges}</b>Colleges</div>
        <div className={c.collegesToReview ? "warn" : ""}><b>{c.collegesToReview}</b>To review</div>
        <div><b>{c.designs}</b>Saved designs</div>
        <div><b>{c.approvedImages}</b>Library pictures</div>
        <div><b>{c.sharedUploads}</b>Student uploads</div>
        <div><b>{c.commonImages}</b>Common pictures</div>
      </div>
      <h3 className="adm-h">PDF downloads by template</h3>
      {data.downloads.length === 0 ? (
        <p className="hint">No downloads counted yet.</p>
      ) : (
        <ul className="adm-list">
          {[...data.downloads].sort((a, b) => b.downloads - a.downloads).map((d) => (
            <li key={d.kind + d.templateId}>
              <span>{d.kind === "cover" ? "Cover" : "Index"} · {name(d.kind, d.templateId)}</span>
              <b>{d.downloads}</b>
            </li>
          ))}
        </ul>
      )}
      <h3 className="adm-h">AI pictures made today (UTC day)</h3>
      {data.aiToday.length === 0 ? (
        <p className="hint">None yet today.</p>
      ) : (
        <ul className="adm-list">
          {data.aiToday.map((u) => (
            <li key={u.provider}>
              <span>{u.provider}</span>
              <b>{u.count}</b>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">{data.note}</p>
      <button className="btn-link" onClick={reload}>↻ Refresh</button>
    </>
  );
}

// ---------------- AI providers ----------------
const EMPTY_PROV = { id: "", name: "", type: "huggingface", model: "", endpoint: "", apiKey: "", enabled: true, priority: 10, dailyLimit: 50 };

function Providers({ notify, confirm }) {
  const { data, error, reload } = useLoad("/api/admin/providers");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState(null); // { id, image?, error?, ms? }

  async function save() {
    setBusy("save");
    try {
      await api("/api/admin/providers", { method: "POST", body: { provider: edit } });
      notify("success", "Provider saved.");
      setEdit(null);
      reload();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy("");
    }
  }
  async function runTest(p) {
    setBusy("test-" + p.id);
    setTest({ id: p.id });
    try {
      const r = await fetchTest(p.id);
      setTest({ id: p.id, ...r });
    } finally {
      setBusy("");
    }
  }
  async function fetchTest(id) {
    try {
      const r = await api(`/api/admin/providers/${encodeURIComponent(id)}/test`, { method: "POST", body: {} });
      return { image: r.image, ms: r.ms };
    } catch (e) {
      return { error: e.message };
    }
  }
  async function toggle(p) {
    try {
      await api("/api/admin/providers", { method: "POST", body: { provider: { ...p, enabled: !p.enabled } } });
      reload();
    } catch (e) {
      notify("error", e.message);
    }
  }
  async function remove(p) {
    const msg = p.builtIn ? `Reset "${p.name}" to its default settings?` : `Delete provider "${p.name}"? Its saved key is deleted too.`;
    if (!(await confirm(msg))) return;
    try {
      await api(`/api/admin/providers/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      notify("success", p.builtIn ? "Reset to default." : "Provider deleted.");
      reload();
    } catch (e) {
      notify("error", e.message);
    }
  }

  if (!data) return <Loading error={error} retry={reload} />;
  if (edit) {
    const builtIn = data.providers.find((p) => p.id === edit.id)?.builtIn;
    const set = (k, v) => setEdit({ ...edit, [k]: v });
    return (
      <div className="adm-form">
        <h3 className="adm-h">{edit.id ? "Edit provider" : "Add provider"}</h3>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={edit.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Hugging Face FLUX" />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select value={edit.type} disabled={builtIn} onChange={(e) => set("type", e.target.value)}>
            {data.types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="hint">{TYPE_HELP[edit.type]}</span>
        </label>
        <label className="field">
          <span className="field-label">Model <em>(empty = default)</em></span>
          <input value={edit.model} onChange={(e) => set("model", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Endpoint <em>(https://…, empty = default)</em></span>
          <input value={edit.endpoint} onChange={(e) => set("endpoint", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">API key <em>{edit.hasKey ? `(saved: ${edit.keyHint}. Leave empty to keep it)` : "(if the provider needs one)"}</em></span>
          <input type="password" autoComplete="off" value={edit.apiKey || ""} onChange={(e) => set("apiKey", e.target.value)} />
          <span className="hint">🔒 Stored encrypted on the server. It is never shown again, only its last 4 characters.</span>
        </label>
        {edit.hasKey && (
          <label className="adm-check">
            <input type="checkbox" checked={!!edit.removeKey} onChange={(e) => set("removeKey", e.target.checked)} /> Remove the saved key
          </label>
        )}
        <div className="adm-row2">
          <label className="field">
            <span className="field-label">Priority <em>(1 = tried first)</em></span>
            <input type="number" min="1" max="99" value={edit.priority} onChange={(e) => set("priority", e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Daily cap <em>(0 = none)</em></span>
            <input type="number" min="0" value={edit.dailyLimit} onChange={(e) => set("dailyLimit", e.target.value)} />
          </label>
        </div>
        <label className="adm-check">
          <input type="checkbox" checked={edit.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Turned on
        </label>
        <div className="adm-actions">
          <button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn-main" disabled={busy === "save"} onClick={save}>
            {busy === "save" && <span className="spinner" />} Save
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="hint">Providers are tried from top to bottom. If one fails or reaches its cap, the next one is used automatically.</p>
      <ul className="adm-cards">
        {data.providers.map((p) => (
          <li key={p.id} className={p.enabled ? "" : "off"}>
            <div className="adm-card-top">
              <b>#{p.priority} {p.name}</b>
              <span className={"pill " + (p.enabled ? "on" : "")}>{p.enabled ? "On" : "Off"}</span>
            </div>
            <small>
              {p.type}
              {p.model ? " · " + p.model : ""}
              {p.dailyLimit ? ` · cap ${p.dailyLimit}/day` : ""}
              {p.hasKey ? ` · key ${p.keyHint}` : ""}
            </small>
            {test?.id === p.id && (
              <div className="adm-test">
                {busy === "test-" + p.id ? (
                  <span><span className="spinner dark" /> Testing (can take 10–40 s)…</span>
                ) : test.image ? (
                  <>
                    <img src={test.image} alt="Test result" />
                    <small>✅ Works ({Math.round(test.ms / 1000)} s). This test picture is not saved.</small>
                  </>
                ) : (
                  <small className="adm-err">{test.error}</small>
                )}
              </div>
            )}
            <div className="adm-btns">
              <button className="btn-soft" disabled={!!busy} onClick={() => runTest(p)}>Test</button>
              <button className="btn-soft" onClick={() => setEdit({ ...p, apiKey: "" })}>Edit</button>
              <button className="btn-soft" onClick={() => toggle(p)}>{p.enabled ? "Turn off" : "Turn on"}</button>
              <button className="btn-link danger" onClick={() => remove(p)}>{p.builtIn ? "Reset" : "Delete"}</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="btn-main" onClick={() => setEdit({ ...EMPTY_PROV })}>＋ Add provider</button>
    </>
  );
}

// ---------------- Pictures ----------------
function Pictures({ notify, confirm }) {
  const { data, error, reload } = useLoad("/api/admin/images");
  const [file, setFile] = useState(null); // data URL
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");

  async function addCommon() {
    if (!file) return notify("error", "Choose a picture first.");
    setBusy(true);
    try {
      const url = await uploadLogo(file, "common-images");
      await api("/api/admin/common", { method: "POST", body: { url, title, tags } });
      notify("success", "Common picture added for everyone.");
      setFile(null);
      setTitle("");
      setTags("");
      reload();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  }
  async function act(kind, item, action) {
    const base = `/api/admin/${kind}/${encodeURIComponent(item.id)}`;
    if (action === "delete" && !(await confirm("Delete this picture from the library? Students will not see it any more."))) return;
    try {
      if (action === "delete") await api(base, { method: "DELETE" });
      else await api(base, { method: "PATCH", body: { status: action } });
      notify("success", action === "delete" ? "Deleted." : action === "hidden" ? "Hidden from students." : "Visible again.");
      reload();
    } catch (e) {
      notify("error", e.message);
    }
  }

  if (!data) return <Loading error={error} retry={reload} />;
  const approved = data.approved.filter((a) => filter === "all" || (filter === "hidden" ? a.status === "hidden" : a.source === filter));
  const srcName = { ai: "AI", "ai-prompt": "AI (own prompt)", upload: "Student upload" };
  return (
    <>
      <h3 className="adm-h">Add a common picture</h3>
      <div className="adm-form">
        <label className="btn-soft adm-file">
          {file ? "✅ Picture chosen (tap to change)" : "📁 Choose picture"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setFile(await readImageFile(f, 1600));
              } catch (err) {
                notify("error", err.message);
              }
            }}
          />
        </label>
        {file && <img className="adm-preview" src={file} alt="Chosen" />}
        <label className="field">
          <span className="field-label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dyeing machine" />
        </label>
        <label className="field">
          <span className="field-label">Tags <em>(words students may search, e.g. dyeing color wet process)</em></span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <button className="btn-main" disabled={busy || !file} onClick={addCommon}>
          {busy && <span className="spinner" />} Upload & add
        </button>
      </div>

      <h3 className="adm-h">Common pictures ({data.common.length})</h3>
      {data.common.length === 0 ? <p className="hint">None yet. The 4 built-in pictures are always shown.</p> : (
        <div className="adm-grid">
          {data.common.map((c) => (
            <figure key={c.id} className={c.status === "hidden" ? "off" : ""}>
              <img src={c.url} alt={c.title} loading="lazy" />
              <figcaption>{c.title || "(no title)"}</figcaption>
              <div className="adm-btns">
                <button className="btn-soft" onClick={() => act("common", c, c.status === "hidden" ? "visible" : "hidden")}>{c.status === "hidden" ? "Show" : "Hide"}</button>
                <button className="btn-link danger" onClick={() => act("common", c, "delete")}>Delete</button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <h3 className="adm-h">Library pictures from students ({data.approved.length})</h3>
      <div className="seg small">
        {[["all", "All"], ["ai", "AI"], ["ai-prompt", "Own prompt"], ["upload", "Uploads"], ["hidden", "Hidden"]].map(([k, l]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {approved.length === 0 ? <p className="hint">Nothing here.</p> : (
        <div className="adm-grid">
          {approved.map((a) => (
            <figure key={a.id} className={a.status === "hidden" ? "off" : ""}>
              <img src={a.url} alt={a.subjectName} loading="lazy" />
              <figcaption>
                {a.subjectName || "(no subject)"}
                <small>{srcName[a.source] || a.source}{a.status === "hidden" ? " · hidden" : ""}</small>
              </figcaption>
              <div className="adm-btns">
                <button className="btn-soft" onClick={() => act("approved", a, a.status === "hidden" ? "visible" : "hidden")}>{a.status === "hidden" ? "Show" : "Hide"}</button>
                <button className="btn-link danger" onClick={() => act("approved", a, "delete")}>Delete</button>
              </div>
            </figure>
          ))}
        </div>
      )}
      <p className="hint">Delete removes it from the website. The file itself stays in Cloudinary (you can delete it there).</p>
    </>
  );
}

// ---------------- Colleges ----------------
function Colleges({ notify, confirm }) {
  const { data, error, reload } = useLoad("/api/admin/colleges");
  const [edit, setEdit] = useState(null); // { id?, name, logoUrl, newLogo? , mergeInto }
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function save() {
    setBusy(true);
    try {
      let logoUrl = edit.logoUrl;
      if (edit.newLogo) logoUrl = await uploadLogo(edit.newLogo);
      if (edit.id) {
        await api(`/api/admin/colleges/${encodeURIComponent(edit.id)}`, { method: "PATCH", body: { name: edit.name, logoUrl } });
      } else {
        await api("/api/admin/colleges", { method: "POST", body: { name: edit.name, logoUrl } });
      }
      notify("success", "College saved.");
      setEdit(null);
      reload();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  }
  async function patch(c, body, msg, ask) {
    if (ask && !(await confirm(ask))) return;
    try {
      await api(`/api/admin/colleges/${encodeURIComponent(c.id)}`, { method: "PATCH", body });
      notify("success", msg);
      reload();
    } catch (e) {
      notify("error", e.message);
    }
  }

  if (!data) return <Loading error={error} retry={reload} />;
  const list = data.colleges.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const live = data.colleges.filter((c) => c.status === "visible" || !c.status);
  if (edit) {
    return (
      <div className="adm-form">
        <h3 className="adm-h">{edit.id ? "Edit college" : "Add college"}</h3>
        <label className="field">
          <span className="field-label">College name</span>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        </label>
        <div className="adm-logo-row">
          {(edit.newLogo || edit.logoUrl) && <img src={edit.newLogo || edit.logoUrl} alt="Logo" />}
          <label className="btn-soft adm-file">
            📁 {edit.logoUrl || edit.newLogo ? "Change logo" : "Upload logo"}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setEdit({ ...edit, newLogo: await readImageFile(f, 600) });
                } catch (err) {
                  notify("error", err.message);
                }
              }}
            />
          </label>
        </div>
        <div className="adm-actions">
          <button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn-main" disabled={busy} onClick={save}>{busy && <span className="spinner" />} Save</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="adm-actions">
        <input className="adm-search" placeholder="Search colleges…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-main" onClick={() => setEdit({ name: "", logoUrl: "" })}>＋ Add</button>
      </div>
      <ul className="adm-cards">
        {list.map((c) => (
          <li key={c.id} className={c.status === "hidden" || c.status === "merged" ? "off" : ""}>
            <div className="adm-card-top">
              {c.logoUrl ? <img className="adm-logo" src={c.logoUrl} alt="" /> : <span className="adm-logo none">🏫</span>}
              <b>{c.name}</b>
            </div>
            <small>
              {c.source === "community" ? "Added by a student" : c.source === "default" ? "Default" : "Added by owner"}
              {c.source === "community" && !c.reviewed ? " · ⚠️ needs review" : ""}
              {c.status === "hidden" ? " · hidden" : ""}
              {c.status === "merged" ? ` · merged into ${data.colleges.find((x) => x.id === c.mergedInto)?.name || c.mergedInto}` : ""}
            </small>
            <div className="adm-btns">
              <button className="btn-soft" onClick={() => setEdit({ id: c.id, name: c.name, logoUrl: c.logoUrl })}>Edit</button>
              {c.source === "community" && !c.reviewed && c.status !== "hidden" && (
                <button className="btn-soft" onClick={() => patch(c, {}, "Marked as checked.")}>✓ Looks good</button>
              )}
              {c.source !== "default" &&
                (c.status === "hidden" || c.status === "merged" ? (
                  <button className="btn-soft" onClick={() => patch(c, { status: "visible", mergeInto: "" }, "Visible again.")}>Show</button>
                ) : (
                  <button className="btn-link danger" onClick={() => patch(c, { status: "hidden" }, "Hidden from students.", `Hide "${c.name}" from students?`)}>Hide</button>
                ))}
              {c.source !== "default" && c.status !== "merged" && (
                <select
                  className="adm-merge"
                  value=""
                  onChange={(e) => e.target.value && patch(c, { mergeInto: e.target.value }, "Merged (duplicate hidden).", `Merge "${c.name}" into "${live.find((x) => x.id === e.target.value)?.name}"? It will be hidden as a duplicate.`)}
                >
                  <option value="">Merge into…</option>
                  {live.filter((x) => x.id !== c.id).map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------- Designs ----------------
function Designs({ notify, confirm }) {
  const { data, error, reload } = useLoad("/api/admin/designs");
  async function act(d, action) {
    if (action === "delete" && !(await confirm(`Delete the saved design "${d.subjectName}"?`))) return;
    try {
      const base = `/api/admin/designs/${encodeURIComponent(d.id)}`;
      if (action === "delete") await api(base, { method: "DELETE" });
      else await api(base, { method: "PATCH", body: { status: action } });
      notify("success", "Done.");
      reload();
    } catch (e) {
      notify("error", e.message);
    }
  }
  if (!data) return <Loading error={error} retry={reload} />;
  if (!data.designs.length) return <p className="adm-empty">No saved designs yet.</p>;
  const tname = (id) => COVER_TEMPLATES.find((t) => t.id === id)?.name || id;
  return (
    <ul className="adm-cards">
      {data.designs.map((d) => (
        <li key={d.id} className={d.status === "hidden" ? "off" : ""}>
          <div className="adm-card-top">
            {d.illustration ? <img className="adm-logo" src={d.illustration} alt="" /> : <span className="adm-logo none">📄</span>}
            <b>{d.subjectCode ? d.subjectCode + " · " : ""}{d.subjectName}</b>
          </div>
          <small>{tname(d.coverTemplate)} · {d.collegeName}{d.status === "hidden" ? " · hidden" : ""}</small>
          <div className="adm-btns">
            <button className="btn-soft" onClick={() => act(d, d.status === "hidden" ? "visible" : "hidden")}>{d.status === "hidden" ? "Show" : "Hide"}</button>
            <button className="btn-link danger" onClick={() => act(d, "delete")}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Settings ----------------
function Settings({ notify, onSaved }) {
  const { data, error, reload } = useLoad("/api/admin/settings");
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);
  if (!s) return <Loading error={error} retry={reload} />;
  const toggleHidden = (key, id) => setS({ ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] });
  async function save() {
    if (COVER_TEMPLATES.every((t) => s.hiddenCover.includes(t.id)) || INDEX_TEMPLATES.every((t) => s.hiddenIndex.includes(t.id))) {
      return notify("error", "Keep at least one cover and one index template visible.");
    }
    setBusy(true);
    try {
      await api("/api/admin/settings", { method: "PUT", body: { settings: s } });
      notify("success", "Settings saved. Students see them within about a minute.");
      onSaved?.();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adm-form">
      <label className="field">
        <span className="field-label">Notice at the top of the website <em>(empty = no notice)</em></span>
        <textarea rows={2} maxLength={300} value={s.notice} onChange={(e) => setS({ ...s, notice: e.target.value })} />
      </label>
      <label className="adm-check">
        <input type="checkbox" checked={s.aiEnabled} onChange={(e) => setS({ ...s, aiEnabled: e.target.checked })} /> AI pictures turned on for students
      </label>
      <div className="adm-row2">
        <label className="field">
          <span className="field-label">AI pictures per student per day</span>
          <input type="number" min="0" max="30" value={s.aiPerDay} onChange={(e) => setS({ ...s, aiPerDay: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Max picture/logo size (MB)</span>
          <input type="number" min="1" max="10" value={s.uploadMaxMB} onChange={(e) => setS({ ...s, uploadMaxMB: e.target.value })} />
        </label>
      </div>
      <h3 className="adm-h">Templates students can use</h3>
      {[["hiddenCover", "Cover", COVER_TEMPLATES], ["hiddenIndex", "Index", INDEX_TEMPLATES]].map(([key, label, list]) => (
        <div key={key} className="adm-tpls">
          <b>{label}</b>
          {list.map((t) => (
            <label key={t.id} className="adm-check">
              <input type="checkbox" checked={!s[key].includes(t.id)} onChange={() => toggleHidden(key, t.id)} /> {t.name}
            </label>
          ))}
        </div>
      ))}
      <button className="btn-main" disabled={busy} onClick={save}>{busy && <span className="spinner" />} Save settings</button>
    </div>
  );
}

// ---------------- Shell ----------------
export default function AdminPanel({ user, isGoogle, googleIn, googleOut, notify, confirm, onExit, onSettingsSaved }) {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    setMe(null);
    api("/api/admin/me")
      .then(setMe)
      .catch((e) => setMe({ admin: false, error: e.message }));
  }, [user?.uid, isGoogle]);

  let body;
  if (!me) body = <p className="adm-empty"><span className="spinner dark" /> Checking…</p>;
  else if (!me.admin) {
    body = (
      <div className="adm-empty">
        <p><b>Owner only.</b></p>
        {!me.configured ? (
          <p className="hint">Admin is not set up yet. In Cloudflare add the secret <b>ADMIN_EMAILS</b> with the owner's Gmail address.</p>
        ) : isGoogle ? (
          <p className="hint">You are signed in as {me.email || user?.email}. This account is not an admin.</p>
        ) : (
          <p className="hint">Sign in with the owner's Google account.</p>
        )}
        {isGoogle ? (
          <button className="btn-outline" onClick={googleOut}>Sign out</button>
        ) : (
          <button className="btn-google" onClick={googleIn}><span aria-hidden="true">G</span> Sign in with Google</button>
        )}
      </div>
    );
  } else {
    const props = { notify, confirm };
    body = (
      <>
        <nav className="adm-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <section className="adm-body">
          {tab === "overview" && <Overview />}
          {tab === "ai" && <Providers {...props} />}
          {tab === "images" && <Pictures {...props} />}
          {tab === "colleges" && <Colleges {...props} />}
          {tab === "designs" && <Designs {...props} />}
          {tab === "settings" && <Settings {...props} onSaved={onSettingsSaved} />}
        </section>
      </>
    );
  }
  return (
    <div className="admin">
      <header className="adm-top">
        <button className="btn-link" onClick={onExit}>← Back to generator</button>
        <strong>Admin panel</strong>
      </header>
      {body}
    </div>
  );
}
