/**
 * Turning a chosen photo into a small square avatar.
 *
 * ## Why this produces a data URL and not a Storage upload
 *
 * Firebase Storage is not set up on this project - `firebase deploy
 * --only storage` refuses with "Firebase Storage has not been set up",
 * and nothing can be uploaded until someone presses Get Started in the
 * console. Waiting for that would mean shipping an avatar feature that
 * silently fails for everyone.
 *
 * So the image is resized here, hard, and kept as a data URL on the
 * user's own document. A 256px JPEG at quality 0.82 lands around 15-25 KB,
 * comfortably inside Firestore's 1 MB document limit, and it is only ever
 * read by the person it belongs to and their parish admin.
 *
 * This is a deliberate stopgap, not a design. When Storage is enabled the
 * right shape is an upload to `avatars/{uid}` and a real URL in
 * `photoUrl` - which is why the field is called photoUrl rather than
 * photoData, so the swap costs nothing above this module.
 *
 * ## Why it resizes rather than validating and rejecting
 *
 * A phone camera produces a 4 MB, 4000px JPEG. Telling someone their own
 * photograph is too big, when the app could simply make it smaller, is
 * work handed back to the person for the app's convenience.
 */

/** The stored square's edge, in pixels. Retina-sharp at the 64px it displays. */
export const AVATAR_PX = 256;

/** Refused above this. A Firestore document cannot exceed 1 MB in total. */
export const MAX_STORED_BYTES = 180_000;

export class AvatarError extends Error {}

/**
 * Reads an image file and returns a square JPEG data URL.
 *
 * The crop is centred and takes the largest square that fits, rather than
 * squashing the picture to fit a square box - a stretched face is worse
 * than a cropped one.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new AvatarError("That file is not an image. Please choose a photo.");
  }

  const bitmap = await loadImage(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("This browser could not process the image.");

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  if ("close" in bitmap) (bitmap as ImageBitmap).close?.();

  // JPEG, not PNG: a photograph as PNG is several times larger for no
  // visible gain, and the budget here is a document field.
  let quality = 0.82;
  let url = canvas.toDataURL("image/jpeg", quality);

  // Busy photographs compress worse. Step down rather than refusing a
  // picture that is only slightly over.
  while (url.length > MAX_STORED_BYTES && quality > 0.4) {
    quality -= 0.12;
    url = canvas.toDataURL("image/jpeg", quality);
  }

  if (url.length > MAX_STORED_BYTES) {
    throw new AvatarError("That photo is too detailed to store. Please try another.");
  }
  return url;
}

function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap handles EXIF orientation, so a photo taken in
  // portrait does not arrive on its side.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
      loadViaElement(file),
    );
  }
  return loadViaElement(file);
}

function loadViaElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarError("That image could not be opened."));
    };
    img.src = url;
  });
}

/**
 * The initials to show when there is no photograph.
 *
 * Takes the first letter of the first two words, so "Juan Dela Cruz" is
 * JD rather than JDC, and a single name gives one letter rather than a
 * repeated one.
 */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/[.\s_-]+/).filter(Boolean);
  if (parts.length === 0) return "P";
  return parts.slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}
