// The forms on the left side. Every change updates the preview instantly.
import { useRef } from "react";
import { DEPARTMENTS, LEVELS, TERMS, DEFAULT_COLLEGE, MAX_INDEX_ROWS, newId } from "../data.js";
import { readImageFile } from "../imageTools.js";
import CollegePicker from "./CollegePicker.jsx";
import ImageChooser from "./ImageChooser.jsx";

function Field({ label, optional, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {optional && <em>(optional)</em>}
      </span>
      {children}
    </label>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="form-card">
      <h3>
        <span aria-hidden="true">{icon}</span> {title}
      </h3>
      {children}
    </section>
  );
}

function ImagePicker({ label, onPick, notify, maxSide }) {
  const input = useRef(null);
  return (
    <>
      <button type="button" className="btn-soft" onClick={() => input.current.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files[0];
          e.target.value = "";
          if (!file) return;
          try {
            onPick(await readImageFile(file, maxSide));
            notify("success", "Image added. It stays on your device only.");
          } catch (err) {
            notify("error", err.message);
          }
        }}
      />
    </>
  );
}

export function CoverEditor({ d, set, notify, onPickCollege, imageProps, children }) {
  const up = (patch) => set({ ...d, ...patch });
  const upS = (patch) => set({ ...d, student: { ...d.student, ...patch } });
  const upT = (patch) => set({ ...d, teacher: { ...d.teacher, ...patch } });
  const txt = (fn, k) => (e) => fn({ [k]: e.target.value });

  return (
    <div className="editor">
      <Section title="College" icon="🏛️">
        <CollegePicker value={d} onPick={onPickCollege} notify={notify} />
        <details className="fine-tune">
          <summary>Change name or logo only on my cover</summary>
          <Field label="College name (as printed)">
            <textarea rows={2} value={d.collegeName} onChange={txt(up, "collegeName")} />
          </Field>
          <div className="logo-row">
            <div className="logo-thumb">{d.logo ? <img src={d.logo} alt="Logo" /> : <span>No logo</span>}</div>
            <div className="btn-col">
              <ImagePicker label="Use another logo" onPick={(logo) => up({ logo })} notify={notify} maxSide={800} />
              <button type="button" className="btn-link" onClick={() => up({ collegeId: DEFAULT_COLLEGE.id, collegeName: DEFAULT_COLLEGE.name, logo: DEFAULT_COLLEGE.logo })}>
                Reset to GTEC
              </button>
            </div>
          </div>
          <p className="hint">Changes here stay on your cover only. To add a college for everyone, use "add it" in the list above.</p>
        </details>
      </Section>

      {children}

      <Section title="Report & Subject" icon="📘">
        <Field label="Department">
          <input list="dept-list" value={d.department} onChange={txt(up, "department")} placeholder="e.g. Wet Process Engineering" />
          <datalist id="dept-list">
            {DEPARTMENTS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label="Report type">
          <input value={d.reportType} onChange={txt(up, "reportType")} placeholder="e.g. TC-I Lab Report" />
        </Field>
        <div className="two">
          <Field label="Subject name">
            <input value={d.subjectName} onChange={txt(up, "subjectName")} placeholder="e.g. Textile Coloration-I" />
          </Field>
          <Field label="Subject code">
            <input value={d.subjectCode} onChange={txt(up, "subjectCode")} placeholder="e.g. WPE-302" />
          </Field>
        </div>
        <div className="two">
          <Field label="Level">
            <select value={d.level} onChange={txt(up, "level")}>
              <option value="">Select</option>
              {LEVELS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Term">
            <select value={d.term} onChange={txt(up, "term")}>
              <option value="">Select</option>
              {TERMS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Submitted By (you)" icon="🎓">
        <p className="hint private">🔒 Your personal details stay on this device (and in your own Google account if you sign in). They are never shared.</p>
        <Field label="Student name">
          <input value={d.student.name} onChange={txt(upS, "name")} autoComplete="name" />
        </Field>
        <Field label="Department" optional>
          <input value={d.student.department} onChange={txt(upS, "department")} placeholder={d.department || "Same as above"} />
        </Field>
        <div className="two">
          <Field label="Student ID / Roll">
            <input value={d.student.id} onChange={txt(upS, "id")} />
          </Field>
          <Field label="Registration No." optional>
            <input value={d.student.reg} onChange={txt(upS, "reg")} />
          </Field>
        </div>
        <div className="two">
          <Field label="Session">
            <input value={d.student.session} onChange={txt(upS, "session")} placeholder="e.g. 2022-23" />
          </Field>
          <Field label="Contact" optional>
            <input value={d.student.contact} onChange={txt(upS, "contact")} inputMode="tel" />
          </Field>
        </div>
      </Section>

      <Section title="Submitted To (teacher)" icon="👩‍🏫">
        <p className="hint">Only the lines you fill are printed, without labels. All are optional.</p>
        <Field label="Teacher name" optional>
          <input value={d.teacher.name} onChange={txt(upT, "name")} placeholder="e.g. Eng. Md. ..." />
        </Field>
        <div className="two">
          <Field label="Designation" optional>
            <input value={d.teacher.designation} onChange={txt(upT, "designation")} placeholder="e.g. Lecturer" />
          </Field>
          <Field label="Department" optional>
            <input value={d.teacher.department} onChange={txt(upT, "department")} />
          </Field>
        </div>
        <Field label="College" optional>
          <input value={d.teacher.college} onChange={txt(upT, "college")} />
        </Field>
      </Section>

      <Section title="Submission date" icon="📅">
        <Field label="Date">
          <input type="date" value={d.submissionDate} onChange={txt(up, "submissionDate")} />
        </Field>
      </Section>

      <Section title="Illustration" icon="🖼️">
        <ImageChooser d={d} up={up} notify={notify} {...imageProps} />
        <Field label={`Soft edges (feather): ${d.feather}`}>
          <input type="range" min={0} max={100} value={d.feather} onChange={(e) => up({ feather: Number(e.target.value) })} />
        </Field>
        <div className="two">
          <Field label="Edge shape">
            <select value={d.featherShape} onChange={txt(up, "featherShape")}>
              <option value="oval">Oval</option>
              <option value="soft-rect">Soft rectangle</option>
            </select>
          </Field>
          <label className="check-field">
            <input type="checkbox" checked={d.blend} onChange={(e) => up({ blend: e.target.checked })} />
            Melt white background into page
          </label>
        </div>
      </Section>
    </div>
  );
}

export function IndexEditor({ index, set, notify, confirm }) {
  const rows = index.rows;
  const update = (id, patch) => set({ ...index, rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const add = () => {
    if (rows.length >= MAX_INDEX_ROWS) return notify("error", `An index page holds up to ${MAX_INDEX_ROWS} experiments.`);
    set({ ...index, rows: [...rows, { id: newId(), name: "", date: "" }] });
  };
  const remove = async (r) => {
    if (r.name.trim() && !(await confirm(`Delete "${r.name}"?`))) return;
    const next = rows.filter((x) => x.id !== r.id);
    set({ ...index, rows: next.length ? next : [{ id: newId(), name: "", date: "" }] });
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    set({ ...index, rows: next });
  };
  let n = 0;

  return (
    <div className="editor">
      <section className="form-card">
        <h3>
          <span aria-hidden="true">📋</span> Experiments ({rows.filter((r) => r.name.trim()).length}/{MAX_INDEX_ROWS})
        </h3>
        <p className="hint">Only rows with an experiment name are printed, numbered in order. Empty rows never print.</p>
        <div className="rows">
          {rows.map((r, i) => {
            const filled = r.name.trim() !== "";
            if (filled) n += 1;
            return (
              <div className={"row-item" + (filled ? "" : " pending")} key={r.id}>
                <div className="row-no">{filled ? String(n).padStart(2, "0") : "—"}</div>
                <div className="row-fields">
                  <textarea rows={2} placeholder="Experiment name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
                  <input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} />
                </div>
                <div className="row-actions">
                  <button type="button" title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button type="button" title="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                    ↓
                  </button>
                  <button type="button" title="Delete" className="danger" onClick={() => remove(r)}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn-soft wide" onClick={add} disabled={rows.length >= MAX_INDEX_ROWS}>
          + Add experiment
        </button>
      </section>
    </div>
  );
}
