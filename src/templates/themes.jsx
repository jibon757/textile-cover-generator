// Ten bold "art" cover templates (4–13) with matching index pages.
// Inspired by textile processes (colour, weaving, spinning, sewing) but with NO department
// text, so every department can use every template.
// Every template is a real A4 sheet (210 × 297 mm). All text sits in <Fit> boxes with a fixed
// size, so long names shrink instead of overlapping. Art stays away from the text areas.
import Fit from "../components/Fit.jsx";
import Illustration from "../components/Illustration.jsx";
import { InfoList, TeacherLines, studentRows, teacherRows, SubjectLine, DateLine, Logo, key } from "./parts.jsx";
import { completedRows, formatDate } from "../data.js";

const abs = (top, left, right, height, extra = {}) => ({ position: "absolute", top, left, right, height, ...extra });
const mm = (n) => n + "mm";
const PAGE = { position: "absolute", inset: 0, width: "210mm", height: "297mm" };

/* ------------------------------------------------------------------ */
/* Small art helpers (deterministic, so preview = PDF)                 */
/* ------------------------------------------------------------------ */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Smooth organic blob around (cx, cy).
function blob(cx, cy, r, seed, n = 9, wobble = 0.35) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + R() * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + "Z";
}
function Splash({ cx, cy, r, colors, seed }) {
  const R = rng(seed);
  const drops = Array.from({ length: 14 }, () => {
    const a = R() * Math.PI * 2;
    const dist = r * (1.05 + R() * 0.9);
    return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, s: 0.6 + R() * 2.6, c: colors[Math.floor(R() * colors.length)] };
  });
  return (
    <g style={{ mixBlendMode: "multiply" }}>
      {colors.map((c, i) => (
        <path key={i} d={blob(cx + (i - 1) * r * 0.32, cy + ((i % 2) - 0.5) * r * 0.35, r * (0.78 - i * 0.08), seed + i * 7, 11, 0.55)} fill={c} opacity={0.88} />
      ))}
      {drops.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.s} fill={p.c} opacity={0.9} />)}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Shared text blocks                                                  */
/* ------------------------------------------------------------------ */
function Title({ c, children, kind = "pill" }) {
  return <div className={"bx-title bx-" + kind} style={{ "--c": c }}>{children}</div>;
}

function InfoBlock({ d, top, height, left, right, c1, c2, label, kind = "pill", boxed = false, rule }) {
  const sRows = studentRows(d);
  const tRows = teacherRows(d);
  const inner = height - (boxed ? 17 : 12);
  const box = (c) => (boxed ? { border: `0.45mm solid ${c}`, borderRadius: "3mm", padding: "3mm 4mm", background: "#fff" } : {});
  return (
    <div style={{ ...abs(mm(top), mm(left), mm(right), mm(height)), display: "flex", gap: "6mm" }}>
      <div style={{ flex: 1.35, minWidth: 0, ...box(c1) }}>
        <Title c={c1} kind={kind}>Submitted By</Title>
        <Fit max={11} min={7.5} deps={[key(sRows)]} style={{ height: mm(inner) }}>
          <InfoList rows={sRows} labelColor={label || c1} />
        </Fit>
      </div>
      {rule && <div style={{ width: "0.4mm", background: rule }} />}
      <div style={{ flex: 0.85, minWidth: 0, ...box(c2) }}>
        <Title c={c2} kind={kind}>Submitted To</Title>
        <Fit max={11} min={7.5} deps={[key(tRows)]} style={{ height: mm(inner) }}>
          <TeacherLines lines={tRows} />
        </Fit>
      </div>
    </div>
  );
}

function College({ d, top, left, right, h, color = "#111", font = "serif", align = "left", max = 22 }) {
  return (
    <Fit max={max} min={9} deps={[d.collegeName]} className={font} style={{ ...abs(mm(top), mm(left), mm(right), mm(h)), fontWeight: 800, color, textAlign: align, display: "flex", alignItems: "center", justifyContent: align === "center" ? "center" : "flex-start" }}>
      <span>{d.collegeName}</span>
    </Fit>
  );
}
function LogoAt({ src, top, left, size, round, bg, pad }) {
  return (
    <div style={{ position: "absolute", top: mm(top), left: mm(left) }}>
      <Logo src={src} size={mm(size)} round={round} bg={bg} pad={pad} />
    </div>
  );
}
function LogoCenter({ src, top, size, round, bg, pad }) {
  return (
    <div style={{ ...abs(mm(top), "0", "0", mm(size)), display: "flex", justifyContent: "center" }}>
      <Logo src={src} size={mm(size)} round={round} bg={bg} pad={pad} />
    </div>
  );
}
function Big({ text, top, left, right, h, font, color, max = 44, min = 14, align = "left", style = {} }) {
  return (
    <Fit max={max} min={min} deps={[text]} className={font} style={{ ...abs(mm(top), mm(left), mm(right), mm(h)), color, textAlign: align, lineHeight: 1.02, display: "flex", alignItems: "center", justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", ...style }}>
      <span>{text || "\u00a0"}</span>
    </Fit>
  );
}
const Pic = ({ d, top, left, right, h }) => (
  <Illustration src={d.illustration} feather={d.feather} shape={d.featherShape} blend={d.blend} style={abs(mm(top), mm(left), mm(right), mm(h))} />
);
const Subject = ({ d, top, left, right, label, color = "#1b1b1b", align = "center" }) => (
  <div style={abs(mm(top), mm(left), mm(right), "17mm")}>
    <SubjectLine d={d} labelColor={label} color={color} align={align} />
  </div>
);
const When = ({ d, top, left, right, color, align = "center" }) => (
  <DateLine d={d} color={color} style={{ ...abs(mm(top), mm(left), mm(right), "9mm"), textAlign: align }} />
);

/* ------------------------------------------------------------------ */
/* Decorations (shared by a cover and its index)                       */
/* ------------------------------------------------------------------ */

// 1. Colour splash
const SPLASH = ["#ec4899", "#06b6d4", "#facc15", "#f97316"];
function SplashArt() {
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <Splash cx={192} cy={18} r={30} colors={SPLASH} seed={11} />
      <Splash cx={12} cy={286} r={22} colors={["#06b6d4", "#a855f7", "#ec4899"]} seed={29} />
    </svg>
  );
}

// 2. Dye drips from the top edge
function DripArt({ max = 30 }) {
  const R = rng(5);
  const drips = [];
  for (let x = 2; x < 208; ) {
    const w = 3 + R() * 6;
    const len = 6 + R() * (max - 6);
    drips.push({ x, w, len });
    x += w + 1.5 + R() * 6;
  }
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <defs>
        <linearGradient id="dyeg" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#be185d" />
          <stop offset="0.3" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#0284c7" />
          <stop offset="0.8" stopColor="#059669" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="210" height="9" fill="url(#dyeg)" />
      {drips.map((p, i) => (
        <g key={i} fill="url(#dyeg)">
          <rect x={p.x} y={0} width={p.w} height={p.len} rx={p.w / 2} />
          <circle cx={p.x + p.w / 2} cy={p.len + p.w * 0.9} r={p.w * 0.32} />
        </g>
      ))}
      <rect x="0" y="292" width="210" height="5" fill="url(#dyeg)" />
    </svg>
  );
}

// 3. Ink flow: full colour page + white card
function InkArt({ cardTop = 50 }) {
  return (
    <>
      <div className="ink-bg" />
      <div className="ink-card" style={{ top: mm(cardTop) }} />
    </>
  );
}

// 4. Woven panel on the left
function WovenArt() {
  const W = 46, s = 6, g = 1.4;
  const cols = Math.ceil(W / (s + g));
  const rows = Math.ceil(297 / (s + g));
  const warpC = ["#1e3a8a", "#1d4ed8", "#172554"];
  const weftC = ["#f59e0b", "#14b8a6", "#f59e0b", "#e11d48"];
  const cells = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      if ((i + j) % 2 === 0) cells.push(<rect key={i + "-" + j} x={i * (s + g)} y={j * (s + g) - 0.2} width={s} height={s + 0.4} fill={warpC[i % 3]} />);
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <defs>
        <clipPath id="wv"><rect x="0" y="0" width={W} height="297" /></clipPath>
      </defs>
      <g clipPath="url(#wv)">
        <rect x="0" y="0" width={W} height="297" fill="#0b1437" />
        {Array.from({ length: cols }, (_, i) => <rect key={"w" + i} x={i * (s + g)} y="0" width={s} height="297" fill={warpC[i % 3]} />)}
        {Array.from({ length: rows }, (_, j) => <rect key={"f" + j} x="0" y={j * (s + g)} width={W} height={s} fill={weftC[j % 4]} />)}
        {cells}
      </g>
      <rect x={W} y="0" width="1.2" height="297" fill="#f59e0b" />
    </svg>
  );
}

// 5. Tartan bands
function TartanArt({ top = 58, foot = true }) {
  return (
    <>
      <div className="tartan" style={{ top: 0, height: mm(top) }} />
      {foot && <div className="tartan" style={{ bottom: 0, height: "14mm" }} />}
    </>
  );
}

// 6. Knit frame (V stitches)
function KnitArt() {
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <defs>
        <pattern id="knit" width="5" height="5.6" patternUnits="userSpaceOnUse">
          <rect width="5" height="5.6" fill="#9a3412" />
          <path d="M0.4,0.6 Q1.2,3.6 2.5,5.0 M4.6,0.6 Q3.8,3.6 2.5,5.0" stroke="#fdba74" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </pattern>
        <mask id="knitm">
          <rect width="210" height="297" fill="#fff" />
          <rect x="11" y="11" width="188" height="275" rx="4" fill="#000" />
        </mask>
      </defs>
      <rect width="210" height="297" fill="url(#knit)" mask="url(#knitm)" />
      <rect x="12.2" y="12.2" width="185.6" height="272.6" rx="3.4" fill="none" stroke="#fdba74" strokeWidth="0.5" strokeDasharray="1.6 1.2" />
    </svg>
  );
}

// 7. Spinning spiral (top right) + thread
function SpinArt() {
  const pts = [];
  for (let t = 0; t < 7 * Math.PI * 2; t += 0.12) {
    const r = 1.2 + t * 1.15;
    pts.push(`${(180 + Math.cos(t) * r).toFixed(2)},${(28 + Math.sin(t) * r).toFixed(2)}`);
  }
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <polyline points={pts.join(" ")} fill="none" stroke="#7c3aed" strokeWidth="1.1" opacity="0.9" />
      <path d="M196,52 C206,80 198,120 205,160 S200,230 214,260" fill="none" stroke="#7c3aed" strokeWidth="0.9" />
      <path d="M192,56 C203,86 195,124 202,164 S197,232 212,266" fill="none" stroke="#f472b6" strokeWidth="0.7" />
      <path d="M-4,288 C40,276 80,296 120,284 S190,276 214,286" fill="none" stroke="#f472b6" strokeWidth="0.8" />
      <path d="M-4,292 C40,281 80,300 120,289 S190,281 214,291" fill="none" stroke="#7c3aed" strokeWidth="0.8" />
    </svg>
  );
}

// 8. Yarn ball (bottom left) + winding thread up the right edge
function YarnArt() {
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <defs>
        <clipPath id="ball"><circle cx="26" cy="275" r="19" /></clipPath>
      </defs>
      <circle cx="26" cy="275" r="19" fill="#f97362" />
      <g clipPath="url(#ball)" fill="none" stroke="#ffd7cf" strokeWidth="0.8">
        {[-60, -30, 0, 30, 60, 90].map((a, i) => (
          <ellipse key={i} cx="26" cy="275" rx={19 - (i % 3) * 3} ry={7 + (i % 2) * 4} transform={`rotate(${a} 26 275)`} />
        ))}
      </g>
      <path d="M44,283 C80,293 120,294 160,286 S206,250 202,200 S192,120 203,80 S198,24 172,8 S130,-2 112,5" fill="none" stroke="#f97362" strokeWidth="1" />
      <path d="M203,80 S198,24 172,8" fill="none" stroke="#0f766e" strokeWidth="0.6" transform="translate(-2.5 2)" />
    </svg>
  );
}

// 9. Measuring tape (left edge) + stitch border
function TapeArt() {
  const ticks = [];
  for (let y = 0; y <= 297; y += 2) {
    const big = y % 10 === 0;
    ticks.push(<line key={y} x1="14" x2={big ? 8 : 11} y1={y} y2={y} stroke="#1f2937" strokeWidth={big ? 0.35 : 0.2} />);
    if (big && y > 0 && y < 297) ticks.push(<text key={"t" + y} x="3.2" y={y + 1.1} fontSize="3" fill="#1f2937" fontFamily="Inter, sans-serif">{y / 10}</text>);
  }
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <rect x="0" y="0" width="14" height="297" fill="#facc15" />
      {ticks}
      <rect x="20" y="8" width="182" height="281" rx="3" fill="none" stroke="#111827" strokeWidth="0.45" strokeDasharray="2.2 1.6" />
    </svg>
  );
}

// 10. Fashion editorial: black top block with pattern-paper curves
function EditorialArt({ h = 112 }) {
  return (
    <svg viewBox="0 0 210 297" style={PAGE}>
      <rect x="0" y="0" width="210" height={h} fill="#0a0a0a" />
      <g fill="none" stroke="#3f3f46" strokeWidth="0.45" strokeDasharray="2 1.4">
        <path d={`M150,${h} C150,${h - 40} 170,${h - 60} 196,${h - 70}`} />
        <path d={`M165,${h} C168,${h - 30} 185,${h - 45} 214,${h - 50}`} />
        <path d={`M120,-2 C140,20 170,24 214,18`} />
      </g>
      <rect x="0" y={h} width="210" height="1.6" fill="#e11d48" />
      <rect x="16" y="283" width="40" height="1" fill="#0a0a0a" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Covers                                                              */
/* ------------------------------------------------------------------ */

function ColorSplash({ d }) {
  return (
    <div className="a4">
      <SplashArt />
      <LogoAt src={d.logo} top={14} left={16} size={24} />
      <College d={d} top={14} left={45} right={58} h={24} color="#111" max={19} />
      <div style={{ ...abs("43mm", "16mm", "120mm", "1.6mm"), background: "linear-gradient(90deg,#ec4899,#06b6d4,#facc15)" }} />
      <Big text={d.reportType} top={49} left={16} right={50} h={32} font="f-heavy" color="#111" max={40} style={{ textTransform: "uppercase" }} />
      <Subject d={d} top={83} left={16} right={30} label="#db2777" align="left" />
      <Pic d={d} top={104} left={16} right={16} h={80} />
      <InfoBlock d={d} top={188} height={72} left={16} right={16} c1="#db2777" c2="#0891b2" kind="chip" rule="#facc15" />
      <When d={d} top={266} left={60} right={16} color="#db2777" align="right" />
    </div>
  );
}

function DyeDrip({ d }) {
  return (
    <div className="a4">
      <DripArt />
      <LogoCenter src={d.logo} top={38} size={24} />
      <College d={d} top={63} left={20} right={20} h={14} color="#3b0764" align="center" max={20} />
      <Big text={d.reportType} top={79} left={20} right={20} h={18} font="f-bebas" color="#7c3aed" max={46} align="center" style={{ letterSpacing: "0.08em" }} />
      <Subject d={d} top={98} left={22} right={22} label="#be185d" />
      <Pic d={d} top={117} left={22} right={22} h={72} />
      <InfoBlock d={d} top={192} height={70} left={16} right={16} c1="#7c3aed" c2="#0284c7" kind="under" rule="#e9d5ff" />
      <When d={d} top={267} left={30} right={30} color="#be185d" />
    </div>
  );
}

function InkFlow({ d }) {
  return (
    <div className="a4">
      <InkArt />
      <LogoAt src={d.logo} top={11} left={16} size={28} round bg="#fff" pad={1.6} />
      <College d={d} top={11} left={50} right={16} h={28} color="#fff" max={22} />
      <Big text={d.reportType} top={57} left={22} right={22} h={16} font="f-play" color="#9d174d" max={30} align="center" style={{ fontStyle: "italic" }} />
      <Subject d={d} top={74} left={24} right={24} label="#c2410c" />
      <Pic d={d} top={94} left={22} right={22} h={84} />
      <InfoBlock d={d} top={182} height={76} left={20} right={20} c1="#9d174d" c2="#c2410c" kind="pill" />
      <When d={d} top={264} left={30} right={30} color="#9d174d" />
    </div>
  );
}

function Woven({ d }) {
  return (
    <div className="a4">
      <WovenArt />
      <LogoAt src={d.logo} top={14} left={56} size={26} />
      <College d={d} top={14} left={87} right={14} h={26} color="#172554" max={20} />
      <div style={{ ...abs("44mm", "56mm", "14mm", "0.5mm"), background: "#f59e0b" }} />
      <Big text={d.reportType} top={48} left={56} right={14} h={22} font="f-bebas" color="#1e3a8a" max={50} style={{ letterSpacing: "0.04em" }} />
      <Subject d={d} top={71} left={56} right={14} label="#b45309" align="left" />
      <Pic d={d} top={92} left={56} right={12} h={84} />
      <InfoBlock d={d} top={180} height={80} left={56} right={12} c1="#1e3a8a" c2="#b45309" kind="tab" boxed />
      <When d={d} top={266} left={56} right={14} color="#1e3a8a" align="left" />
    </div>
  );
}

function Tartan({ d }) {
  return (
    <div className="a4">
      <TartanArt />
      <div className="plate" style={abs("13mm", "18mm", "18mm", "36mm")} />
      <LogoAt src={d.logo} top={16} left={23} size={30} />
      <College d={d} top={16} left={58} right={23} h={30} color="#7f1d1d" max={21} />
      <Big text={d.reportType} top={63} left={20} right={20} h={16} font="f-play" color="#7f1d1d" max={32} align="center" style={{ fontWeight: 900 }} />
      <div className="tartan thin" style={abs("81mm", "80mm", "80mm", "2.2mm")} />
      <Subject d={d} top={85} left={22} right={22} label="#14532d" />
      <Pic d={d} top={105} left={22} right={22} h={76} />
      <InfoBlock d={d} top={185} height={72} left={18} right={18} c1="#7f1d1d" c2="#14532d" kind="under" rule="#d6c7a1" />
      <When d={d} top={262} left={30} right={30} color="#7f1d1d" />
    </div>
  );
}

function Knit({ d }) {
  return (
    <div className="a4">
      <KnitArt />
      <LogoCenter src={d.logo} top={19} size={24} />
      <College d={d} top={45} left={20} right={20} h={14} color="#7c2d12" align="center" max={20} />
      <div style={{ ...abs("63mm", "0", "0", "15mm"), display: "flex", justifyContent: "center" }}>
        <Fit max={22} min={11} deps={[d.reportType]} className="knit-label" style={{ height: "15mm", maxWidth: "150mm" }}>
          {d.reportType || "\u00a0"}
        </Fit>
      </div>
      <Subject d={d} top={81} left={24} right={24} label="#9a3412" />
      <Pic d={d} top={101} left={22} right={22} h={78} />
      <InfoBlock d={d} top={183} height={74} left={19} right={19} c1="#9a3412" c2="#a16207" kind="pill" boxed />
      <When d={d} top={262} left={30} right={30} color="#9a3412" />
    </div>
  );
}

function Spin({ d }) {
  return (
    <div className="a4">
      <SpinArt />
      <LogoAt src={d.logo} top={14} left={16} size={24} />
      <College d={d} top={14} left={44} right={78} h={24} color="#2e1065" max={18} />
      <Big text={d.reportType} top={56} left={16} right={72} h={24} font="f-bebas" color="#4c1d95" max={58} style={{ letterSpacing: "0.03em" }} />
      <Subject d={d} top={81} left={16} right={16} label="#db2777" align="left" />
      <Pic d={d} top={102} left={16} right={16} h={80} />
      <InfoBlock d={d} top={186} height={72} left={16} right={16} c1="#6d28d9" c2="#db2777" kind="chip" rule="#ede9fe" />
      <When d={d} top={264} left={16} right={60} color="#6d28d9" align="left" />
    </div>
  );
}

function YarnBall({ d }) {
  return (
    <div className="a4">
      <YarnArt />
      <LogoCenter src={d.logo} top={16} size={26} />
      <College d={d} top={44} left={22} right={22} h={15} color="#134e4a" align="center" max={20} />
      <div style={{ ...abs("62mm", "0", "0", "15mm"), display: "flex", justifyContent: "center" }}>
        <Fit max={22} min={11} deps={[d.reportType]} className="yarn-label" style={{ height: "15mm", maxWidth: "150mm" }}>
          {d.reportType || "\u00a0"}
        </Fit>
      </div>
      <Subject d={d} top={80} left={24} right={24} label="#0f766e" />
      <Pic d={d} top={100} left={22} right={22} h={78} />
      <InfoBlock d={d} top={182} height={70} left={18} right={18} c1="#0f766e" c2="#ea580c" kind="tab" rule="#fed7cf" />
      <When d={d} top={262} left={50} right={20} color="#0f766e" />
    </div>
  );
}

function StitchTape({ d }) {
  return (
    <div className="a4">
      <TapeArt />
      <LogoAt src={d.logo} top={15} left={26} size={26} />
      <College d={d} top={15} left={57} right={14} h={26} color="#111827" max={20} />
      <div className="hang-tag" style={{ position: "absolute", top: "48mm", left: "58mm", width: "104mm", height: "26mm" }}>
        <Fit max={24} min={11} deps={[d.reportType]} className="f-heavy" style={{ position: "absolute", top: "3mm", bottom: "3mm", left: "16mm", right: "6mm", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", textTransform: "uppercase", color: "#1f2937" }}>
          <span>{d.reportType || "\u00a0"}</span>
        </Fit>
      </div>
      <Subject d={d} top={80} left={26} right={14} label="#b91c1c" />
      <Pic d={d} top={100} left={26} right={14} h={78} />
      <InfoBlock d={d} top={182} height={74} left={26} right={14} c1="#111827" c2="#b91c1c" kind="stitch" rule="#d1d5db" />
      <When d={d} top={264} left={40} right={20} color="#b91c1c" />
    </div>
  );
}

function Editorial({ d }) {
  return (
    <div className="a4">
      <EditorialArt />
      <LogoAt src={d.logo} top={12} left={16} size={22} round bg="#fff" pad={1.4} />
      <College d={d} top={12} left={43} right={16} h={22} color="#fff" max={17} font="" />
      <Big text={d.reportType} top={40} left={16} right={16} h={40} font="f-bebas" color="#fff" max={86} min={20} style={{ letterSpacing: "0.01em" }} />
      <div style={{ ...abs("83mm", "16mm", "150mm", "0.5mm"), background: "#e11d48" }} />
      <Subject d={d} top={88} left={16} right={60} label="#fda4af" color="#fff" align="left" />
      <Pic d={d} top={118} left={16} right={16} h={72} />
      <InfoBlock d={d} top={193} height={68} left={16} right={16} c1="#0a0a0a" c2="#e11d48" kind="mono" rule="#0a0a0a" label="#0a0a0a" />
      <When d={d} top={268} left={70} right={16} color="#e11d48" align="right" />
    </div>
  );
}

export const MORE_COVERS = [
  { id: "color-splash", name: "Color Splash", Component: ColorSplash },
  { id: "dye-drip", name: "Dye Drip", Component: DyeDrip },
  { id: "ink-flow", name: "Ink Flow", Component: InkFlow },
  { id: "woven", name: "Woven", Component: Woven },
  { id: "tartan", name: "Tartan", Component: Tartan },
  { id: "knit", name: "Knit Frame", Component: Knit },
  { id: "spin", name: "Spinning Spiral", Component: Spin },
  { id: "yarn-ball", name: "Yarn Ball", Component: YarnBall },
  { id: "stitch-tape", name: "Stitch & Tape", Component: StitchTape },
  { id: "editorial", name: "Fashion Editorial", Component: Editorial },
];

/* ------------------------------------------------------------------ */
/* Index pages                                                         */
/* ------------------------------------------------------------------ */

function ThemedTable({ rows, th, line, zebra, bw = false }) {
  return (
    <table className={"index-table themed" + (bw ? " bw" : "")} style={{ "--th": th, "--line": line, "--zebra": zebra }}>
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

function Caption({ cover, color, top, left, right, align = "center" }) {
  if (!cover.subjectName && !cover.subjectCode) return null;
  const text = [cover.subjectName, cover.subjectCode && `(${cover.subjectCode})`].filter(Boolean).join(" ");
  return (
    <Fit max={13} min={9} deps={[text]} style={{ ...abs(mm(top), mm(left), mm(right), "8mm"), textAlign: align, color, fontWeight: 600 }}>
      {text}
    </Fit>
  );
}

// o: art, logo {top,left|center,size,round}, college {top,left,right,h,color,align}, word {top,left,right,font,color,align,h},
//    cap {color}, table {top,left,right,bottom}, colors {th,line,zebra}
function makeIndex(o) {
  return function Idx({ cover, index }) {
    const rows = completedRows(index.rows);
    const L = o.logo, C = o.college, W = o.word, Tb = o.table;
    return (
      <div className="a4">
        {o.art}
        {o.extra}
        {L.center ? (
          <LogoCenter src={cover.logo} top={L.top} size={L.size} round={L.round} bg={L.round ? "#fff" : undefined} pad={L.round ? 1.4 : undefined} />
        ) : (
          <LogoAt src={cover.logo} top={L.top} left={L.left} size={L.size} round={L.round} bg={L.round ? "#fff" : undefined} pad={L.round ? 1.4 : undefined} />
        )}
        <College d={cover} top={C.top} left={C.left} right={C.right} h={C.h} color={C.color} align={C.align || "left"} max={C.max || 19} font={C.font ?? "serif"} />
        <Big text="INDEX" top={W.top} left={W.left} right={W.right} h={W.h || 16} font={W.font} color={W.color} max={W.max || 40} align={W.align || "center"} style={{ letterSpacing: W.ls || "0.2em", ...(W.style || {}) }} />
        <Caption cover={cover} color={o.cap} top={W.top + (W.h || 16) + 1} left={Tb.left} right={Tb.right} align={W.align === "left" ? "left" : "center"} />
        <Fit max={13} min={8} deps={[key(rows)]} style={abs(mm(Tb.top), mm(Tb.left), mm(Tb.right), mm(Tb.bottom - Tb.top))}>
          <ThemedTable rows={rows} {...o.colors} />
        </Fit>
      </div>
    );
  };
}

export const MORE_INDEXES = [
  {
    id: "color-splash",
    name: "Color Splash",
    Component: makeIndex({
      art: <SplashArt />,
      logo: { top: 14, left: 16, size: 24 },
      college: { top: 14, left: 45, right: 58, h: 24, color: "#111" },
      word: { top: 46, left: 16, right: 40, font: "f-heavy", color: "#111", align: "left", ls: "0.12em", h: 18 },
      cap: "#db2777",
      table: { top: 76, left: 16, right: 16, bottom: 262 },
      colors: { th: "#db2777", line: "#fbcfe8", zebra: "#fdf2f8" },
    }),
  },
  {
    id: "dye-drip",
    name: "Dye Drip",
    Component: makeIndex({
      art: <DripArt />,
      logo: { top: 36, center: true, size: 22 },
      college: { top: 59, left: 20, right: 20, h: 13, color: "#3b0764", align: "center" },
      word: { top: 73, left: 20, right: 20, font: "f-bebas", color: "#7c3aed", max: 46 },
      cap: "#be185d",
      table: { top: 99, left: 16, right: 16, bottom: 284 },
      colors: { th: "#7c3aed", line: "#e9d5ff", zebra: "#faf5ff" },
    }),
  },
  {
    id: "ink-flow",
    name: "Ink Flow",
    Component: makeIndex({
      art: <InkArt cardTop={44} />,
      logo: { top: 9, left: 16, size: 26, round: true },
      college: { top: 9, left: 48, right: 16, h: 26, color: "#fff" },
      word: { top: 50, left: 22, right: 22, font: "f-play", color: "#9d174d", style: { fontStyle: "italic" } },
      cap: "#c2410c",
      table: { top: 77, left: 20, right: 20, bottom: 276 },
      colors: { th: "#9d174d", line: "#fbcfe8", zebra: "#fff1f2" },
    }),
  },
  {
    id: "woven",
    name: "Woven",
    Component: makeIndex({
      art: <WovenArt />,
      logo: { top: 14, left: 56, size: 24 },
      college: { top: 14, left: 85, right: 14, h: 24, color: "#172554" },
      word: { top: 44, left: 56, right: 14, font: "f-bebas", color: "#1e3a8a", align: "left", max: 46, h: 18 },
      cap: "#b45309",
      table: { top: 74, left: 56, right: 12, bottom: 282 },
      colors: { th: "#1e3a8a", line: "#c7d2fe", zebra: "#eef2ff" },
    }),
  },
  {
    id: "tartan",
    name: "Tartan",
    Component: makeIndex({
      art: <TartanArt top={44} />,
      extra: <div className="plate" style={abs("9mm", "18mm", "18mm", "28mm")} />,
      logo: { top: 11, left: 23, size: 24 },
      college: { top: 11, left: 52, right: 23, h: 24, color: "#7f1d1d" },
      word: { top: 50, left: 20, right: 20, font: "f-play", color: "#7f1d1d", style: { fontWeight: 900 } },
      cap: "#14532d",
      table: { top: 77, left: 18, right: 18, bottom: 276 },
      colors: { th: "#7f1d1d", line: "#d6c7a1", zebra: "#fbf8f1" },
    }),
  },
  {
    id: "knit",
    name: "Knit Frame",
    Component: makeIndex({
      art: <KnitArt />,
      logo: { top: 18, center: true, size: 22 },
      college: { top: 42, left: 20, right: 20, h: 13, color: "#7c2d12", align: "center" },
      word: { top: 57, left: 30, right: 30, font: "f-play", color: "#9a3412", ls: "0.25em" },
      cap: "#a16207",
      table: { top: 84, left: 19, right: 19, bottom: 278 },
      colors: { th: "#9a3412", line: "#fed7aa", zebra: "#fff7ed" },
    }),
  },
  {
    id: "spin",
    name: "Spinning Spiral",
    Component: makeIndex({
      art: <SpinArt />,
      logo: { top: 14, left: 16, size: 24 },
      college: { top: 14, left: 44, right: 78, h: 24, color: "#2e1065" },
      word: { top: 54, left: 16, right: 16, font: "f-bebas", color: "#4c1d95", align: "left", max: 52, h: 20, ls: "0.06em" },
      cap: "#db2777",
      table: { top: 84, left: 16, right: 16, bottom: 276 },
      colors: { th: "#6d28d9", line: "#ddd6fe", zebra: "#f5f3ff" },
    }),
  },
  {
    id: "yarn-ball",
    name: "Yarn Ball",
    Component: makeIndex({
      art: <YarnArt />,
      logo: { top: 15, center: true, size: 24 },
      college: { top: 41, left: 22, right: 22, h: 14, color: "#134e4a", align: "center" },
      word: { top: 57, left: 50, right: 50, font: "f-heavy", color: "#0f766e", ls: "0.2em" },
      cap: "#ea580c",
      table: { top: 84, left: 18, right: 18, bottom: 250 },
      colors: { th: "#0f766e", line: "#99f6e4", zebra: "#f0fdfa" },
    }),
  },
  {
    id: "stitch-tape",
    name: "Stitch & Tape",
    Component: makeIndex({
      art: <TapeArt />,
      logo: { top: 15, left: 26, size: 24 },
      college: { top: 15, left: 55, right: 14, h: 24, color: "#111827" },
      word: { top: 46, left: 26, right: 14, font: "f-heavy", color: "#111827", ls: "0.25em" },
      cap: "#b91c1c",
      table: { top: 73, left: 26, right: 14, bottom: 280 },
      colors: { th: "#111827", line: "#d1d5db", zebra: "#f9fafb" },
    }),
  },
  {
    id: "editorial",
    name: "Fashion Editorial",
    Component: makeIndex({
      art: <EditorialArt h={68} />,
      logo: { top: 10, left: 16, size: 20, round: true },
      college: { top: 10, left: 41, right: 16, h: 20, color: "#fff", font: "" },
      word: { top: 34, left: 16, right: 16, font: "f-bebas", color: "#fff", align: "left", max: 64, h: 22, ls: "0.04em" },
      cap: "#fda4af",
      table: { top: 78, left: 16, right: 16, bottom: 280 },
      colors: { th: "#0a0a0a", line: "#d4d4d8", zebra: "#fafafa" },
    }),
  },
];

/* Plain black & white index (prints well on any printer). Always the first index. */
export function PlainBWIndex({ cover, index }) {
  const rows = completedRows(index.rows);
  return (
    <div className="a4">
      <LogoAt src={cover.logo} top={16} left={18} size={24} />
      <College d={cover} top={16} left={47} right={18} h={24} color="#000" max={20} />
      <div style={{ ...abs("43mm", "18mm", "18mm", "0.35mm"), background: "#000" }} />
      <div style={{ ...abs("49mm", "0", "0", "15mm"), display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="iw iw-bw">INDEX</div>
      </div>
      <Caption cover={cover} color="#000" top={66} left={18} right={18} />
      <Fit max={13} min={8} deps={[key(rows)]} style={abs("77mm", "18mm", "18mm", "204mm")}>
        <ThemedTable rows={rows} th="#000" line="#000" zebra="#fff" bw />
      </Fit>
    </div>
  );
}

/* Index for the existing "Maroon Side Band" cover. */
export function MaroonIndex({ cover, index }) {
  const rows = completedRows(index.rows);
  return (
    <div className="a4 tpl-side">
      <div className="side-band">
        <div className="side-text" style={{ fontSize: "14pt" }}>INDEX</div>
      </div>
      <div className="side-gold" />
      <LogoAt src={cover.logo} top={16} left={36} size={26} />
      <College d={cover} top={16} left={67} right={14} h={26} color="#4a0b06" max={20} />
      <div style={{ ...abs("45mm", "70mm", "48mm", "0.6mm"), background: "#C9A227" }} />
      <Big text="INDEX" top={49} left={36} right={14} h={15} font="serif" color="#7D140A" max={26} align="center" style={{ letterSpacing: "0.3em", fontWeight: 800 }} />
      <Caption cover={cover} color="#7D140A" top={66} left={40} right={18} />
      <Fit max={13} min={8} deps={[key(rows)]} style={abs("77mm", "36mm", "14mm", "204mm")}>
        <ThemedTable rows={rows} th="#7D140A" line="#e3c77a" zebra="#fffaf0" />
      </Fit>
    </div>
  );
}
