// Site settings chosen by the owner in the Admin panel (loaded from /api/settings).
import { api } from "./api.js";
import { MAX_IMAGE_MB } from "./data.js";

export const siteSettings = { notice: "", aiEnabled: true, aiPerDay: 9, uploadMaxMB: MAX_IMAGE_MB, hiddenCover: [], hiddenIndex: [] };

export async function loadSiteSettings() {
  try {
    const r = await api("/api/settings", { auth: false });
    Object.assign(siteSettings, r.settings || {});
  } catch {
    /* defaults keep the site working */
  }
  return { ...siteSettings };
}
