// Backend (Cloudflare Worker). Every URL starting with /api/ comes here.
// All other URLs are served from the built website (dist folder).

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
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
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: "Unknown API route: " + url.pathname }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
