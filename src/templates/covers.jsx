// Cover page templates. Every template is drawn on a real A4 sheet (210 × 297 mm).
// Positions use millimetres so the printed page matches the preview exactly.
import Fit from "../components/Fit.jsx";
import Illustration from "../components/Illustration.jsx";
import { InfoList, TeacherLines, studentRows, teacherRows, SubjectLine, DateLine, Logo, key } from "./parts.jsx";

const abs = (top, left, right, height, extra = {}) => ({ position: "absolute", top, left, right, height, ...extra });

/* ---------- 1. Classic Green (based on your TC-I cover) ---------- */
function ClassicGreen({ d }) {
  const sRows = studentRows(d);
  const tRows = teacherRows(d);
  return (
    <div className="a4 tpl-classic">
      <div className="frame-outer" />
      <div className="frame-inner" />

      <div style={{ ...abs("17mm", "19mm", "19mm", "30mm"), display: "flex", gap: "5mm", alignItems: "center" }}>
        <Logo src={d.logo} size="28mm" />
        <Fit max={24} min={11} deps={[d.collegeName]} className="college-name serif" style={{ flex: 1, height: "28mm", display: "flex", alignItems: "center", color: "#274E13" }}>
          <span>{d.collegeName}</span>
        </Fit>
      </div>

      <div style={{ ...abs("49mm", "19mm", "19mm", "1mm") }} className="rule-green" />

      <Fit max={14} min={9} deps={[d.department]} style={{ ...abs("52mm", "19mm", "19mm", "8mm"), textAlign: "center", color: "#7D140A", fontWeight: 700 }}>
        {d.department ? "Department of " + d.department : "\u00a0"}
      </Fit>

      <Fit max={30} min={14} deps={[d.reportType]} style={{ ...abs("61mm", "44mm", "44mm", "15mm"), textAlign: "center", color: "#0070C0", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }} className="serif">
        {d.reportType || "\u00a0"}
      </Fit>

      <div style={abs("77mm", "24mm", "24mm", "17mm")}>
        <SubjectLine d={d} />
      </div>

      <img src="/img/molecule.png" alt="" className="decor" style={{ position: "absolute", top: "60mm", right: "13mm", width: "30mm", opacity: 0.35, mixBlendMode: "multiply" }} />

      <Illustration src={d.illustration} feather={d.feather} shape={d.featherShape} blend={d.blend} style={abs("97mm", "22mm", "22mm", "84mm")} />

      <div style={{ ...abs("186mm", "19mm", "19mm", "76mm"), display: "flex" }}>
        <div style={{ flex: 1.35, paddingRight: "5mm" }}>
          <div className="pill" style={{ background: "#274E13" }}>Submitted By</div>
          <Fit max={11} min={7.5} deps={[key(sRows)]} style={{ height: "64mm" }}>
            <InfoList rows={sRows} />
          </Fit>
        </div>
        <div style={{ width: "0.5mm", background: "#00B050" }} />
        <div style={{ flex: 0.85, paddingLeft: "5mm" }}>
          <div className="pill" style={{ background: "#274E13" }}>Submitted To</div>
          <Fit max={11} min={7.5} deps={[key(tRows)]} style={{ height: "64mm" }}>
            <TeacherLines lines={tRows} />
          </Fit>
        </div>
      </div>

      <DateLine d={d} style={abs("274mm", "40mm", "40mm", "9mm")} />

      <img src="/img/icon-beaker.png" alt="" style={{ position: "absolute", left: "13mm", bottom: "13mm", width: "17mm" }} />
      <img src="/img/icon-testtubes.png" alt="" style={{ position: "absolute", right: "13mm", bottom: "13mm", width: "17mm" }} />
    </div>
  );
}

/* ---------- 2. Royal Banner (blue header band) ---------- */
function RoyalBanner({ d }) {
  const sRows = studentRows(d);
  const tRows = teacherRows(d);
  return (
    <div className="a4 tpl-banner">
      <div className="banner-band" />
      <div style={{ ...abs("12mm", "16mm", "16mm", "34mm"), display: "flex", gap: "6mm", alignItems: "center" }}>
        <Logo src={d.logo} size="32mm" round bg="#fff" pad="2mm" />
        <div style={{ flex: 1 }}>
          <Fit max={22} min={11} deps={[d.collegeName]} className="serif" style={{ height: "22mm", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center" }}>
            <span>{d.collegeName}</span>
          </Fit>
          <Fit max={12} min={8} deps={[d.department]} style={{ height: "8mm", color: "#cfe6ff", fontWeight: 600 }}>
            {d.department ? "Department of " + d.department : "\u00a0"}
          </Fit>
        </div>
      </div>

      <div style={{ ...abs("66mm", "0", "0", "14mm"), display: "flex", justifyContent: "center" }}>
        <Fit max={22} min={12} deps={[d.reportType]} className="ribbon" style={{ height: "14mm", maxWidth: "170mm" }}>
          {d.reportType || "\u00a0"}
        </Fit>
      </div>

      <Fit max={24} min={12} deps={[d.subjectName]} className="serif" style={{ ...abs("86mm", "20mm", "20mm", "14mm"), textAlign: "center", color: "#0b3d91", fontWeight: 800 }}>
        {d.subjectName || "\u00a0"}
      </Fit>
      <Fit max={14} min={9} deps={[d.subjectCode]} style={{ ...abs("101.5mm", "20mm", "20mm", "8mm"), textAlign: "center", color: "#7D140A", fontWeight: 700, letterSpacing: "0.08em" }}>
        {d.subjectCode ? "Course Code: " + d.subjectCode : "\u00a0"}
      </Fit>

      <Illustration src={d.illustration} feather={d.feather} shape={d.featherShape} blend={d.blend} style={abs("112mm", "22mm", "22mm", "79mm")} />

      <div style={{ ...abs("196mm", "14mm", "14mm", "70mm"), display: "flex", gap: "6mm" }}>
        <div className="card-box" style={{ borderColor: "#0070C0", flex: 1.35 }}>
          <div className="card-title" style={{ color: "#0070C0" }}>Submitted By</div>
          <Fit max={11} min={7.5} deps={[key(sRows)]} style={{ height: "56mm" }}>
            <InfoList rows={sRows} labelColor="#0b3d91" />
          </Fit>
        </div>
        <div className="card-box" style={{ borderColor: "#7D140A", flex: 0.85 }}>
          <div className="card-title" style={{ color: "#7D140A" }}>Submitted To</div>
          <Fit max={11} min={7.5} deps={[key(tRows)]} style={{ height: "56mm" }}>
            <TeacherLines lines={tRows} />
          </Fit>
        </div>
      </div>

      <div className="banner-foot" />
      <DateLine d={d} color="#fff" style={{ ...abs("286.5mm", "30mm", "30mm", "9mm"), color: "#fff" }} />
    </div>
  );
}

/* ---------- 3. Maroon Side Band ---------- */
// Vertical text on the band: smaller font for longer text so it always fits the page height.
function SideText({ text }) {
  const size = Math.max(7, Math.min(14, 520 / Math.max(1, text.length)));
  return (
    <div className="side-text" style={{ fontSize: size + "pt" }}>
      {text}
    </div>
  );
}

function MaroonSide({ d }) {
  const sRows = studentRows(d);
  const tRows = teacherRows(d);
  const L = "36mm";
  const R = "14mm";
  return (
    <div className="a4 tpl-side">
      <div className="side-band">
        <SideText text={(d.reportType || "Lab Report") + (d.subjectCode ? "  ·  " + d.subjectCode : "")} />
      </div>
      <div className="side-gold" />

      <div style={{ ...abs("16mm", L, R, "30mm"), display: "flex", justifyContent: "center" }}>
        <Logo src={d.logo} size="30mm" />
      </div>
      <Fit max={21} min={11} deps={[d.collegeName]} className="serif" style={{ ...abs("48mm", L, R, "18mm"), textAlign: "center", color: "#4a0b06", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>{d.collegeName}</span>
      </Fit>
      <Fit max={11} min={7.5} deps={[d.department]} style={{ ...abs("67mm", L, R, "7mm"), textAlign: "center", color: "#555", fontWeight: 600, letterSpacing: "0.04em" }}>
        {d.department ? "Department of " + d.department : "\u00a0"}
      </Fit>
      <div style={{ ...abs("76mm", "70mm", "48mm", "0.6mm"), background: "#C9A227" }} />

      <Fit max={26} min={13} deps={[d.reportType]} className="serif" style={{ ...abs("79mm", L, R, "14mm"), textAlign: "center", color: "#7D140A", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {d.reportType || "\u00a0"}
      </Fit>

      <div className="subject-box" style={abs("97mm", "48mm", "26mm", "19mm")}>
        <SubjectLine d={d} height="17mm" max={14} labelColor="#7D140A" />
      </div>

      <Illustration src={d.illustration} feather={d.feather} shape={d.featherShape} blend={d.blend} style={abs("119mm", L, R, "78mm")} />

      <div style={{ ...abs("201mm", L, R, "66mm"), display: "flex", gap: "6mm" }}>
        <div style={{ flex: 1.35 }}>
          <div className="underline-title">Submitted By</div>
          <Fit max={11} min={7.5} deps={[key(sRows)]} style={{ height: "56mm" }}>
            <InfoList rows={sRows} labelColor="#4a0b06" />
          </Fit>
        </div>
        <div style={{ flex: 0.85 }}>
          <div className="underline-title">Submitted To</div>
          <Fit max={11} min={7.5} deps={[key(tRows)]} style={{ height: "56mm" }}>
            <TeacherLines lines={tRows} />
          </Fit>
        </div>
      </div>

      <DateLine d={d} color="#7D140A" style={abs("279mm", L, R, "9mm")} />
    </div>
  );
}

export const COVER_TEMPLATES = [
  { id: "classic-green", name: "Classic Green", Component: ClassicGreen },
  { id: "royal-banner", name: "Royal Banner", Component: RoyalBanner },
  { id: "maroon-side", name: "Maroon Side Band", Component: MaroonSide },
];
