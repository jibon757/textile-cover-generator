// Reads an image from the student's device, checks it, and shrinks it so it
// stays light (size limit is set by the owner in the Admin panel).
import { siteSettings } from "./siteSettings.js";

const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function readImageFile(file, maxSide = 1600) {
  if (!file) throw new Error("No file selected.");
  if (!OK_TYPES.includes(file.type)) throw new Error("Please choose a PNG, JPG or WebP image.");
  const maxMB = siteSettings.uploadMaxMB || 2;
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Image is larger than ${maxMB} MB. Please choose a smaller one.`);

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("This image could not be opened."));
      i.src = url;
    });
    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * s);
    canvas.height = Math.round(img.height * s);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    // WebP keeps transparency (good for logos) and is small.
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
