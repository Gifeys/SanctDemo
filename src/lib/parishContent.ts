import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "./firebase";
import app from "./firebase";
import type { MassScheduleEntry } from "./schedule";

/**
 * Per-parish content an admin can change without a developer.
 *
 * Everything here is optional and overlays the values compiled into data.ts —
 * it never replaces them wholesale. A parish with no document behaves exactly
 * as before, which matters because 29 of the 31 have no collected content at
 * all and must not become blank the moment this feature exists.
 */
export interface ParishContent {
  /** Download URL of the patron photograph, once an admin has uploaded one. */
  photoUrl?: string;
  /** The parish's own description, shown on Home. */
  description?: string;
  /** Mass times, entered by the parish office rather than hardcoded. */
  massSchedule?: MassScheduleEntry[];
  /** Brand colour. Validated for contrast before it is ever saved. */
  themeColor?: string;
  /** Who last changed this and when — a parish office needs an audit trail. */
  updatedBy?: string;
  updatedAt?: string;
}

const COLLECTION = "parishContent";

/** Live-subscribes to one parish's admin-managed content. */
export function watchParishContent(
  parishId: string,
  onChange: (content: ParishContent | null) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION, parishId),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as ParishContent) : null),
    (error) => {
      // Never fatal. Without this the app silently shows nothing when rules
      // are wrong or the network drops, instead of falling back to the
      // content compiled into data.ts.
      console.error("[parishContent] read failed:", error.message);
      onChange(null);
    },
  );
}

export async function saveParishContent(
  parishId: string,
  patch: Partial<ParishContent>,
  editorEmail: string,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, parishId),
    { ...patch, updatedBy: editorEmail, updatedAt: new Date().toISOString() },
    // Merge, so editing the description cannot wipe a photo someone else
    // uploaded from another device.
    { merge: true },
  );
}

/** Largest photo accepted, before upload. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Deliberately one shape with two optional fields rather than a discriminated
 * union on `ok: true | false`. This project compiles with `strict` off, which
 * widens boolean literal types and stops TypeScript narrowing such a union at
 * all — the `else` branch still believed it held the success case.
 */
export interface PhotoUploadResult {
  url?: string;
  error?: string;
}

/**
 * Uploads a patron photograph and returns its public URL.
 *
 * Validated before the network is touched: a phone camera photo is routinely
 * 8-12MB, and letting one upload for a minute on parish wifi before failing
 * is worse than refusing it in a sentence.
 */
export async function uploadParishPhoto(
  parishId: string,
  file: File,
): Promise<PhotoUploadResult> {
  if (!file.type.startsWith("image/")) {
    return { error: "That file is not an image. Choose a JPG or PNG photo." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      error: `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use one under 5 MB — most phones can resize when sharing.`,
    };
  }

  try {
    const storage = getStorage(app);
    // One fixed path per parish, so re-uploading replaces rather than
    // accumulating orphaned files nobody will ever clean up.
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const target = ref(storage, `parish-photos/${parishId}.${extension}`);
    await uploadBytes(target, file, { contentType: file.type });
    return { url: await getDownloadURL(target) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[parishContent] upload failed:", message);

    // The overwhelmingly likely cause in a fresh project, said plainly rather
    // than as a raw Firebase error code.
    if (/storage\/unauthorized|permission/i.test(message)) {
      return {
        error: "Upload was refused. Firebase Storage rules need deploying — see docs/admin-parish-content.md.",
      };
    }
    if (/storage\/unknown|bucket/i.test(message)) {
      return {
        error: "Firebase Storage is not set up for this project yet — see docs/admin-parish-content.md.",
      };
    }
    return { error: "The photo could not be uploaded. Check your connection and try again." };
  }
}
