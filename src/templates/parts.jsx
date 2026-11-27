// Small building blocks shared by all templates.
import Fit from "../components/Fit.jsx";
import { formatDate, toNumber } from "../data.js";

// Rows for "Submitted By". Required rows always print (with a blank line when empty,
// so a student can still hand-write). Optional rows print only when filled.
export function studentRows(d) {
  const s = d.student;
  return [
    ["Name", s.name, true],
    ["Department", s.department || d.department, true],
    ["Student ID / Roll", s.id, true],
    ["Registration No.", s.reg, false],
    ["Session", s.session, true],
    ["Level", toNumber(d.level), true],
    ["Term", toNumber(d.term), true],
    ["Contact", s.contact, true],
  ].filter(([, v, req]) => req || (v && v.trim()));
}

// "Submitted To" has no labels: just the filled lines (name, designation, ...).
// Every line is optional; if all are empty, one blank line is left for hand-writing.
export function teacherRows(d) {
  const t = d.teacher;
  return [t.name, t.designation, t.department, t.college].map((v) => (v || "").trim()).filter(Boolean);
}

export function TeacherLines({ lines, color = "#1b1b1b" }) {
  if (lines.length === 0) return <div className="teacher-lines"><div className="info-value blank">{"\u00a0"}</div></div>;
  return (
    <div className="teacher-lines" style={{ color }}>
      {lines.map((l, i) => (
        <div key={i} className={i === 0 ? "t-name" : ""}>{l}</div>
      ))}
    </div>
  );
}

export function InfoList({ rows, labelColor = "#7D140A", valueColor = "#1b1b1b" }) {
  return (
    <div className="info-list">
      {rows.map(([label, value]) => (
        <div className="info-row" key={label}>
          <span className="info-label" style={{ color: labelColor }}>{label}</span>
          <span className="info-colon">:</span>
          <span className={"info-value" + (value ? "" : " blank")} style={{ color: valueColor }}>
            {value || "\u00a0"}
          </span>
        </div>
      ))}
    </div>
  );
}

// Text content used as "deps" so <Fit> re-measures whenever it changes.
export function key(...parts) {
  return JSON.stringify(parts);
}

export function SubjectLine({ d, color = "#1b1b1b", labelColor = "#7D140A", max = 15, height = "16mm", align = "center" }) {
  return (
    <Fit max={max} min={9} deps={[key(d.subjectName, d.subjectCode)]} style={{ height, textAlign: align, display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.25 }}>
      <div>
        <span style={{ color: labelColor, fontWeight: 700 }}>Subject: </span>
        <span style={{ color, fontWeight: 600 }}>{d.subjectName || "\u00a0"}</span>
      </div>
      <div>
        <span style={{ color: labelColor, fontWeight: 700 }}>Subject Code: </span>
        <span style={{ color, fontWeight: 600 }}>{d.subjectCode || "\u00a0"}</span>
      </div>
    </Fit>
  );
}

export function DateLine({ d, color = "#0070C0", max = 13, style = {} }) {
  return (
    <Fit max={max} min={9} deps={[d.submissionDate]} style={{ height: "9mm", textAlign: "center", ...style }}>
      <span style={{ fontWeight: 700, color }}>Submission Date: </span>
      <span style={{ fontWeight: 600 }}>{formatDate(d.submissionDate) || "____-____-________"}</span>
    </Fit>
  );
}

export function Logo({ src, size = "28mm", round = false, bg = "transparent", pad = "0" }) {
  return (
    <div className="logo-box" style={{ width: size, height: size, borderRadius: round ? "50%" : "2mm", background: bg, padding: pad }}>
      {src ? <img src={src} alt="College logo" /> : null}
    </div>
  );
}
