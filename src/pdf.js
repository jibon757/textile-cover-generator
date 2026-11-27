// Builds one self-contained HTML document from the pages on screen and asks
// the backend (/api/pdf) to turn it into a real, vector A4 PDF.
// Text stays real text (selectable, sharp) — this is NOT a screenshot.

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@700;900&family=Bebas+Neue&family=Archivo+Black&family=Playfair+Display:ital,wght@0,800;0,900;1,800&display=swap";

function collectCss() {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      // Cross-origin sheets (Google Fonts) can't be read; the font link is added separately.
    }
  }
  return css;
}

export function buildPdfHtml(rootEl) {
  const pages = rootEl.innerHTML;
  return `<!doctype html>
<html><head><meta charset="utf-8">
<base href="${location.origin}/">
<link rel="stylesheet" href="${FONT_LINK}">
<style>${collectCss()}</style>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .export-root { position: static !important; left: auto !important; }
  .export-root .a4 { break-after: page; page-break-after: always; }
  .export-root .a4:last-child { break-after: auto; page-break-after: auto; }
  .empty-note { display: none !important; }
</style>
</head><body><div class="export-root">${pages}</div></body></html>`;
}

import { authHeader } from "./api.js";

export async function downloadPdf(rootEl, fileName, meta) {
  const html = buildPdfHtml(rootEl);
  let res;
  try {
    res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ html, meta }),
    });
  } catch {
    throw new Error("No internet connection. Please check and try again.");
  }
  if (!res.ok) {
    let msg = "PDF could not be created. Please try again.";
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// "Textile Coloration-I" + "WPE-302" + "Cover" -> "WPE-302_Textile-Coloration-I_Cover.pdf"
export function pdfFileName(cover, what) {
  const part = (s) => (s || "").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  const label = what === "both" ? "Cover-Index" : what === "index" ? "Index" : "Cover";
  const name = [part(cover.subjectCode), part(cover.subjectName), label].filter(Boolean).join("_");
  return (name || "Lab-Report") + ".pdf";
}
