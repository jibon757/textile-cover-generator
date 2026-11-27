// Shared "subject designs": subject, code, template, college and picture settings.
// They NEVER contain student or teacher details.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

export function designFromCover(cover, coverTpl, indexTpl) {
  const shareable = (url) => (url && !url.startsWith("data:") ? url : "");
  return {
    subjectName: cover.subjectName,
    subjectCode: cover.subjectCode,
    reportType: cover.reportType,
    department: cover.department,
    level: cover.level,
    term: cover.term,
    collegeId: cover.collegeId || "",
    collegeName: cover.collegeName,
    logoUrl: shareable(cover.logo),
    coverTemplate: coverTpl,
    indexTemplate: indexTpl,
    illustration: shareable(cover.illustration),
    feather: cover.feather,
    featherShape: cover.featherShape,
    blend: cover.blend,
  };
}

export default function DesignLibrary({ cover, coverTpl, indexTpl, templateNames, onApply, notify, confirm }) {
  const [designs, setDesigns] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setError("");
    try {
      const { designs } = await api("/api/designs", { auth: false });
      setDesigns(designs);
    } catch (err) {
      setDesigns([]);
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = (designs || []).filter((d) => !s || `${d.subjectName} ${d.subjectCode} ${d.collegeName}`.toLowerCase().includes(s));
    return showAll ? all : all.slice(0, 6);
  }, [designs, q, showAll]);

  async function save() {
    if (!cover.subjectName.trim()) return notify("error", "Write the subject name first.");
    const usesOwnImage = cover.illustration?.startsWith("data:") || cover.logo?.startsWith("data:");
    const ok = await confirm(
      "Share this design with everyone? Only the subject, code, college, template and picture settings are shared — never your name, ID, contact or teacher details." +
        (usesOwnImage ? " Pictures uploaded from your device are not shared." : "")
    );
    if (!ok) return;
    setSaving(true);
    try {
      const res = await api("/api/designs", { method: "POST", body: { design: designFromCover(cover, coverTpl, indexTpl) } });
      notify("success", res.existed ? "This exact design is already saved." : "Design saved for everyone. Thank you!");
      load();
    } catch (err) {
      notify("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-card">
      <h3>
        <span aria-hidden="true">📚</span> Ready subject designs
      </h3>
      <p className="hint">Pick a design other students saved, then just fill in your own details.</p>
      <input placeholder="Search subject or code, e.g. WPE-302" value={q} onChange={(e) => setQ(e.target.value)} />
      {designs === null && <p className="hint">Loading designs…</p>}
      {error && (
        <p className="hint error-text">
          {error}{" "}
          <button type="button" className="btn-link" onClick={load}>
            Retry
          </button>
        </p>
      )}
      {designs && !error && list.length === 0 && <p className="hint">{q ? "No design found for this search." : "No designs saved yet. Be the first!"}</p>}
      <ul className="design-list">
        {list.map((d) => (
          <li key={d.id}>
            <div>
              <strong>{d.subjectCode ? d.subjectCode + " · " : ""}{d.subjectName}</strong>
              <span>
                {templateNames[d.coverTemplate] || d.coverTemplate}
                {d.collegeName ? " · " + d.collegeName : ""}
              </span>
            </div>
            <button type="button" className="btn-soft" onClick={() => onApply(d)}>
              Use
            </button>
          </li>
        ))}
      </ul>
      {designs && designs.length > 6 && !q && (
        <button type="button" className="btn-link" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show less" : `Show all (${designs.length})`}
        </button>
      )}
      <button type="button" className="btn-outline full" onClick={save} disabled={saving}>
        {saving ? <span className="spinner dark" /> : "💾"} Save my design for everyone
      </button>
    </section>
  );
}
