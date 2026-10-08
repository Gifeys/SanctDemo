/**
 * Turning a chosen photo into an announcement banner.
 *
 * Same stopgap as lib/avatar.ts and for the same reason: Firebase Storage
 * is not set up on this project, so an upload would be a feature that
 * fails for every parish. The picture is resized hard here and carried in
 * the announcement document as a data URL.
 *
 * Unlike an avatar this crops to 16:9, not to a square. An announcement
 * photo is a group of altar servers or a church interior - a centre-square
 * crop of either loses the ends of the group and the aisle.
 */

/** The stored banner's width. Retina-sharp at the ~330px it displays. */
export const BANNER_W = 720;
export const BANNER_H = 405; // 16:9

/**
 * Refused above this. A Firestore document cannot exceed 1 MB in total,
 * and the bulletin may hold several of these on screen at once.
 */
export const MAX_STORED_BYTES = 220_000;

export class AnnouncementImageError extends Error {}

export async function fileToBannerDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new AnnouncementImageError("That file is not an image. Please choose a photo.");
  }

  const bitmap = await loadImage(file);

  // The largest 16:9 rectangle that fits, centred. Squashing a photograph
  // to the frame is worse than cropping it.
  const targetRatio = BANNER_W / BANNER_H;
  let sw = bitmap.width;
  let sh = Math.round(sw / targetRatio);
  if (sh > bitmap.height) {
    sh = bitmap.height;
    sw = Math.round(sh * targetRatio);
  }
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round((bitmap.height - sh) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = BANNER_W;
  canvas.height = BANNER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AnnouncementImageError("This browser could not process the image.");

  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, BANNER_W, BANNER_H);
  if ("close" in bitmap) (bitmap as ImageBitmap).close?.();

  let quality = 0.8;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > MAX_STORED_BYTES && quality > 0.4) {
    quality -= 0.1;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  if (url.length > MAX_STORED_BYTES) {
    throw new AnnouncementImageError("That photo is too detailed to store. Please try another.");
  }
  return url;
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari has refused some JPEGs here; the <img> path below handles them.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new AnnouncementImageError("That image could not be read."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
