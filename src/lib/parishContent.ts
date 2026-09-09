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

  /**
   * The Church History card on Home.
   *
   * Every parish's history is its own, so this has to be editable or 29 of
   * the 31 show an empty card. The title falls back to the patron's name when
   * an admin leaves it blank.
   */
  historyTitle?: string;
  historyBody?: string;
  historyPhotoUrl?: string;

  /**
   * What the day commemorates, shown with the Mass card.
   *
   * An OVERRIDE, not the only source. The app already derives the liturgical
   * day from the calendar (lib/liturgical.ts), so a parish with nobody
   * editing still shows something true; this replaces that text when a parish
   * wants to say something more specific — a titular feast, a parish
   * anniversary, a bishop's visit.
   */
  commemoratesText?: string;

  /** The photograph behind the Mass schedule panel on Home. */
  massImageUrl?: string;

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
 * Which of a parish's photographs is being replaced.
 *
 * Each gets its own path, so uploading a history photo cannot silently
 * overwrite the patron image the home header depends on.
 */
export type ParishPhotoKind = "patron" | "history" | "mass";

/**
 * Uploads one of a parish's photographs and returns its public URL.
 *
 * Validated before the network is touched: a phone camera photo is routinely
 * 8-12MB, and letting one upload for a minute on parish wifi before failing
 * is worse than refusing it in a sentence.
 */
export async function uploadParishPhoto(
  parishId: string,
  file: File,
  kind: ParishPhotoKind = "patron",
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
    // One fixed path per parish PER KIND, so re-uploading replaces rather
    // than accumulating orphaned files nobody will ever clean up — and so a
    // history photo cannot overwrite the patron image.
    //
    // "patron" keeps the original unsuffixed path so any file already
    // uploaded under it stays reachable.
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const name = kind === "patron" ? parishId : `${parishId}-${kind}`;
    const target = ref(storage, `parish-photos/${name}.${extension}`);
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
