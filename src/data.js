// Default values and helpers for the Cover and Index documents.
// The college list comes from the database; GTEC is the default. Every field stays editable.

export const DEFAULT_COLLEGE = {
  id: "gopalganj-textile-engineering-college-gopalganj",
  name: "Gopalganj Textile Engineering College, Gopalganj",
  logo: "/gtec-logo.jpeg",
};

export const DEPARTMENTS = [
  "Wet Process Engineering",
  "Yarn Engineering",
  "Fabric Engineering",
  "Apparel Engineering",
  "Fashion Design & Technology",
  "Textile Machine Design & Maintenance",
  "Industrial & Production Engineering",
];

export const LEVELS = ["1", "2", "3", "4"];
export const TERMS = ["I", "II"];

// Temporary placeholder illustration (from your reference cover) until the
// image library + AI arrive in Phase 5.
export const SAMPLE_ILLUSTRATION = "/img/sample-dyeing.jpg";

export function emptyCover() {
  return {
    collegeId: DEFAULT_COLLEGE.id,
    collegeName: DEFAULT_COLLEGE.name,
    logo: DEFAULT_COLLEGE.logo,
    department: "Wet Process Engineering",
    reportType: "Lab Report",
    subjectName: "",
    subjectCode: "",
    level: "",
    term: "",
    student: { name: "", department: "", id: "", reg: "", session: "", contact: "" },
    teacher: { name: "", designation: "", department: "", college: "" },
    submissionDate: "",
    illustration: SAMPLE_ILLUSTRATION,
    feather: 35, // 0 = sharp edges, 100 = very soft
    featherShape: "oval", // "oval" | "soft-rect"
    blend: true, // white parts of the image melt into the white page
  };
}

export function emptyIndex() {
  return {
    rows: [{ id: newId(), name: "", date: "" }],
  };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

// "2026-06-30" -> "30-06-2026"
export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

// Only rows that have an experiment name are printed, numbered 01, 02, ...
export function completedRows(rows) {
  return rows
    .filter((r) => r.name.trim() !== "")
    .map((r, i) => ({ ...r, no: String(i + 1).padStart(2, "0") }));
}

export const MAX_INDEX_ROWS = 10;
export const MAX_IMAGE_MB = 2;
