// Backend (Cloudflare Worker). Every URL starting with /api/ comes here.
// All other URLs are served from the built website (dist folder).

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

const MAX_HTML_BYTES = 15 * 1024 * 1024; // 15 MB (images are inside the HTML)

// Turns the page HTML sent by the website into a real A4 PDF using
// Cloudflare Browser Run (free plan: 10 browser-minutes per day).
async function makePdf(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  if (!env.BROWSER || typeof env.BROWSER.quickAction !== "function") {
    return json({ ok: false, code: "pdf_unavailable", error: "PDF service is not connected (BROWSER binding missing)." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  const html = typeof body?.html === "string" ? body.html : "";
  if (!html.includes('class="a4')) return json({ ok: false, error: "Nothing to print." }, 400);
  if (html.length > MAX_HTML_BYTES) {
    return json({ ok: false, code: "too_large", error: "The page is too large. Please use smaller images." }, 413);
  }

  try {
    const res = await env.BROWSER.quickAction("pdf", {
      html,
      gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      pdfOptions: {
        format: "a4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const quota = res.status === 429 || /limit|quota|exceed/i.test(text);
      return json(
        {
          ok: false,
          code: quota ? "quota" : "render_failed",
          error: quota
            ? "Today's free PDF limit is used up. It resets at 6:00 AM (Bangladesh time)."
            : "PDF could not be created. Please try again.",
        },
        quota ? 429 : 502
      );
    }

    return new Response(res.body, {
      headers: { "content-type": "application/pdf", "cache-control": "no-store" },
    });
  } catch (err) {
    const msg = String(err?.message || err);
    const quota = /limit|quota|429|exceed/i.test(msg);
    return json(
      {
        ok: false,
        code: quota ? "quota" : "render_failed",
        error: quota
          ? "Today's free PDF limit is used up. It resets at 6:00 AM (Bangladesh time)."
          : "PDF could not be created. Please try again.",
      },
      quota ? 429 : 502
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: "Textile Cover Generator",
        version: env.APP_VERSION,
        time: new Date().toISOString(),
        firebaseProject: env.FIREBASE_PROJECT_ID,
        cloudinaryCloud: env.CLOUDINARY_CLOUD_NAME,
        pdfService: !!(env.BROWSER && typeof env.BROWSER.quickAction === "function"),
      });
    }

    if (url.pathname === "/api/pdf") return makePdf(request, env);

    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: "Unknown API route: " + url.pathname }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
