// Index page templates (A4). Only completed rows are printed, numbered 01, 02, ...
import Fit from "../components/Fit.jsx";
import { Logo, key } from "./parts.jsx";
import { completedRows, formatDate } from "../data.js";

const abs = (top, left, right, height, extra = {}) => ({ position: "absolute", top, left, right, height, ...extra });

function IndexTable({ rows, variant }) {
  return (
    <table className={"index-table " + variant}>
      <colgroup>
        <col style={{ width: "17%" }} />
        <col />
        <col style={{ width: "22%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>Exp. No.</th>
          <th>Experiment Name</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="empty-note">
            <td colSpan={3}>Add an experiment name to see it here.</td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id}>
              <td className="c">{r.no}</td>
              <td>{r.name}</td>
              <td className="c">{formatDate(r.date)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function SubjectCaption({ cover, color }) {
  if (!cover.subjectName && !cover.subjectCode) return null;
  const text = [cover.subjectName, cover.subjectCode && `(${cover.subjectCode})`].filter(Boolean).join(" ");
  return (
    <Fit max={13} min={9} deps={[text]} style={{ height: "8mm", textAlign: "center", color, fontWeight: 600 }}>
      {text}
    </Fit>
  );
}

/* ---------- 1. Classic Green (based on your TC-I index) ---------- */
function ClassicIndex({ cover, index }) {
  const rows = completedRows(index.rows);
  return (
    <div className="a4 tpl-classic">
      <div className="frame-outer" />
      <div className="frame-inner" />
      <div style={{ ...abs("17mm", "19mm", "19mm", "30mm"), display: "flex", gap: "5mm", alignItems: "center" }}>
        <Logo src={cover.logo} size="28mm" />
        <Fit max={24} min={11} deps={[cover.collegeName]} className="serif college-name" style={{ flex: 1, height: "28mm", display: "flex", alignItems: "center", color: "#274E13" }}>
          <span>{cover.collegeName}</span>
        </Fit>
      </div>
      <div style={abs("49mm", "19mm", "19mm", "1mm")} className="rule-green" />
      <div style={{ ...abs("55mm", "0", "0", "14mm"), display: "flex", justifyContent: "center" }}>
        <div className="index-box">INDEX</div>
      </div>
      <div style={abs("71mm", "24mm", "24mm", "8mm")}>
        <SubjectCaption cover={cover} color="#7D140A" />
      </div>
      <Fit max={13} min={8} deps={[key(rows)]} style={abs("82mm", "19mm", "19mm", "196mm")}>
        <IndexTable rows={rows} variant="classic" />
      </Fit>
    </div>
  );
}

/* ---------- 2. Royal Banner ---------- */
function BannerIndex({ cover, index }) {
  const rows = completedRows(index.rows);
  return (
    <div className="a4 tpl-banner">
      <div className="banner-band short" />
      <div style={{ ...abs("10mm", "16mm", "16mm", "28mm"), display: "flex", gap: "5mm", alignItems: "center" }}>
        <Logo src={cover.logo} size="26mm" round bg="#fff" pad="1.6mm" />
        <Fit max={20} min={10} deps={[cover.collegeName]} className="serif" style={{ flex: 1, height: "24mm", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center" }}>
          <span>{cover.collegeName}</span>
        </Fit>
      </div>
      <div style={{ ...abs("50mm", "0", "0", "16mm"), display: "flex", justifyContent: "center" }}>
        <div className="index-title-banner">INDEX</div>
      </div>
      <div style={abs("67mm", "24mm", "24mm", "8mm")}>
        <SubjectCaption cover={cover} color="#0b3d91" />
      </div>
      <Fit max={13} min={8} deps={[key(rows)]} style={abs("79mm", "16mm", "16mm", "196mm")}>
        <IndexTable rows={rows} variant="banner" />
      </Fit>
      <div className="banner-foot thin" />
    </div>
  );
}

export const INDEX_TEMPLATES = [
  { id: "classic-green", name: "Classic Green", Component: ClassicIndex },
  { id: "royal-banner", name: "Royal Banner", Component: BannerIndex },
];
