// Choose a college from the shared list, or add a new one for everyone.
import { useEffect, useMemo, useState } from "react";
import { api, uploadLogo } from "../api.js";
import { readImageFile } from "../imageTools.js";

export default function CollegePicker({ value, onPick, notify }) {
  const [colleges, setColleges] = useState(null); // null = loading
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState(""); // data URL preview
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoadError("");
    try {
      const { colleges } = await api("/api/colleges", { auth: false });
      setColleges(colleges);
    } catch (err) {
      setColleges([]);
      setLoadError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (colleges || []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [colleges, query]);

  async function save() {
    const name = newName.replace(/\s+/g, " ").trim();
    if (name.length < 5) return notify("error", "Please write the full college name.");
    const dup = (colleges || []).find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (dup) {
      onPick(dup);
      setAdding(false);
      return notify("success", "This college is already in the list, so it was selected.");
    }
    setBusy(true);
    try {
      const logoUrl = newLogo ? await uploadLogo(newLogo) : "";
      const { college, existed, pending } = await api("/api/colleges", { method: "POST", body: { name, logoUrl } });
      setColleges((cs) => [...(cs || []).filter((c) => c.id !== college.id), college]);
      onPick(college);
      setAdding(false);
      setNewName("");
      setNewLogo("");
      notify(
        "success",
        pending
          ? "College added for your cover. Others will see it after the site owner approves it."
          : existed
            ? "This college already existed, so it was selected."
            : "College added. Everyone can now pick it.",
      );
    } catch (err) {
      notify("error", err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="college-picker">
      <button type="button" className="picker-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="picker-logo">{value.logo ? <img src={value.logo} alt="" /> : "🏛️"}</span>
        <span className="picker-name">{value.collegeName || "Choose your college"}</span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="picker-panel">
          <input placeholder="Search college…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {colleges === null && <p className="hint">Loading colleges…</p>}
          {loadError && (
            <p className="hint error-text">
              {loadError}{" "}
              <button type="button" className="btn-link" onClick={load}>
                Retry
              </button>
            </p>
          )}
          {colleges && !loadError && list.length === 0 && <p className="hint">No college found. Add it below.</p>}
          <ul className="picker-list">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={c.id === value.collegeId ? "on" : ""}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                >
                  <span className="picker-logo small">{c.logoUrl ? <img src={c.logoUrl} alt="" /> : "🏛️"}</span>
                  <span>{c.name}</span>
                  {c.community && <em className="badge">community</em>}
                </button>
              </li>
            ))}
          </ul>

          {!adding ? (
            <button type="button" className="btn-soft full" onClick={() => setAdding(true)}>
              ➕ My college isn't here — add it
            </button>
          ) : (
            <div className="add-college">
              <label className="field">
                <span className="field-label">College full name</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Textile Engineering College, Chittagong" />
              </label>
              <div className="logo-row">
                <div className="logo-thumb">{newLogo ? <img src={newLogo} alt="" /> : <span>No logo</span>}</div>
                <label className="btn-soft">
                  Choose logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        setNewLogo(await readImageFile(f, 600));
                      } catch (err) {
                        notify("error", err.message);
                      }
                    }}
                  />
                </label>
              </div>
              <p className="hint">Added colleges are shown to everyone. Please use the real name and logo.</p>
              <div className="row-actions">
                <button type="button" className="btn-outline" onClick={() => setAdding(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="btn-main" onClick={save} disabled={busy}>
                  {busy ? <span className="spinner" /> : null} Save college
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
