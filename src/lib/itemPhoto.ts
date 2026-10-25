import {
  collection, doc, getDoc, onSnapshot, query, setDoc, where,
} from "firebase/firestore";

import { db } from "./firebase";
import { fileToBannerDataUrl, AnnouncementImageError } from "./announcementImage";

/**
 * A photograph for one ministry or sacrament, kept in Firestore.
 *
 * ## Why not Cloud Storage
 *
 * Because Cloud Storage is not switched on for this project and
 * switching it on asks for a billing plan. Firestore is already there,
 * already free for this volume, and already holds photographs this
 * way: an announcement's banner is a downscaled data URL in its own
 * document. This is the same trick for the same reason.
 *
 * ## Why one document per photograph
 *
 * The obvious place was the parish's own content record, beside the
 * description. That record is ONE document shared by every ministry
 * and every sacrament, and Firestore caps a document at 1 MiB - so
 * four or five photographs in and saving would start failing, taking
 * the descriptions down with it.
 *
 * A document per photograph gives each one the whole 1 MiB, and the
 * image helper keeps them near 220 KB anyway. It also means reading a
 * ministry's text does not drag its photograph along with it.
 */

const COLLECTION = "itemPhotos";

/** One document per parish per item, so neither can collide. */
export function itemPhotoId(parishId: string, itemId: string): string {
  return `${parishId}__${itemId}`;
}

export interface ItemPhotoDoc {
  parishId: string;
  itemId: string;
  /** Downscaled JPEG as a data URL. */
  dataUrl: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * Downscales the chosen file and saves it.
 *
 * The downscale is the whole reason this fits: a phone photograph is
 * 8-12 MB and no document would hold one. fileToBannerDataUrl brings
 * it to 720x405 and under 220 KB, which is what an announcement banner
 * already does.
 */
export async function saveItemPhoto(
  parishId: string,
  itemId: string,
  file: File,
  editorEmail: string,
): Promise<SaveResult> {
  try {
    const dataUrl = await fileToBannerDataUrl(file);
    const payload: ItemPhotoDoc = {
      parishId,
      itemId,
      dataUrl,
      updatedAt: new Date().toISOString(),
      updatedBy: editorEmail,
    };
    await setDoc(doc(db, COLLECTION, itemPhotoId(parishId, itemId)), payload);
    return { ok: true };
  } catch (error) {
    if (error instanceof AnnouncementImageError) {
      return { ok: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[itemPhoto] save failed:", message);
    if (/permission|insufficient/i.test(message)) {
      return {
        ok: false,
        error: "That photo was refused. Check you are signed in as this parish's administrator.",
      };
    }
    return { ok: false, error: "That photo could not be saved. Check your connection." };
  }
}

/** Removing the photograph is writing an empty one, so the app falls back. */
export async function clearItemPhoto(
  parishId: string,
  itemId: string,
  editorEmail: string,
): Promise<SaveResult> {
  try {
    await setDoc(doc(db, COLLECTION, itemPhotoId(parishId, itemId)), {
      parishId,
      itemId,
      dataUrl: "",
      updatedAt: new Date().toISOString(),
      updatedBy: editorEmail,
    } satisfies ItemPhotoDoc);
    return { ok: true };
  } catch {
    return { ok: false, error: "That could not be saved. Check your connection." };
  }
}

export async function readItemPhoto(
  parishId: string,
  itemId: string,
): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, itemPhotoId(parishId, itemId)));
    const url = snap.exists() ? (snap.data() as ItemPhotoDoc).dataUrl : "";
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Live photographs for one parish, as a map of item id to data URL.
 *
 * One listener for the whole list rather than one per row: a ministries
 * screen has fifteen rows, and fifteen listeners for fifteen small
 * documents is fifteen times the connections for no benefit.
 */
export function watchItemPhotos(
  parishId: string,
  onChange: (photos: Record<string, string>) => void,
): () => void {
  // A single equality filter on parishId, which needs no composite
  // index - anything with a second clause eventually would.
  try {
    return onSnapshot(
      query(collection(db, COLLECTION), where("parishId", "==", parishId)),
      snap => {
        const out: Record<string, string> = {};
        snap.forEach(d => {
          const data = d.data() as ItemPhotoDoc;
          if (data.dataUrl) out[data.itemId] = data.dataUrl;
        });
        onChange(out);
      },
      () => onChange({}),
    );
  } catch {
    onChange({});
    return () => {};
  }
}
