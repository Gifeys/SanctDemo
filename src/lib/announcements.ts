import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Parish announcements — the middle of the Parish Bulletin.
 *
 * ## Why churchId is optional
 *
 * Announcements existed before parishes were isolated, and those documents
 * have no churchId at all. Treating a missing churchId as "deleted" would
 * empty every bulletin the day this shipped; treating it as diocese-wide is
 * what it actually meant when it was written, so that is what it stays.
 * Anything the new admin writes carries a churchId and belongs to one
 * parish.
 *
 * ## Why the image is a data URL
 *
 * Same reason as lib/avatar.ts: Firebase Storage is not set up on this
 * project, so an upload path would be a feature that silently fails for
 * every parish. announcementImage.ts resizes hard enough that the picture
 * fits in the document, and the field is called imageUrl rather than
 * imageData so swapping to Storage later costs nothing above this module.
 */

/**
 * Where an announcement is in its life.
 *
 * Absent means published. Everything written before this field existed is
 * already on people's home screens, and reading those as drafts would
 * empty every bulletin in the diocese the moment this shipped.
 */
export type AnnouncementStatus = "published" | "draft" | "archived";

export interface AnnouncementDoc {
  id: string;
  /** Absent on the legacy diocese-wide announcements; see above. */
  churchId?: string;
  title: string;
  /** The parish's own sentence or two. Optional — a title can be enough. */
  body?: string;
  /** When the thing happens. Any string Date can parse; "" means undated. */
  date: string;
  time?: string;
  /**
   * "Mass", "Feast", "Event"… shown as the chip on the card, and what
   * separates the Feast Days and Events screens from the rest.
   *
   * Reused rather than joined by a second `category` field: this one
   * already holds exactly these values on every existing document.
   */
  type: string;
  status?: AnnouncementStatus;
  /** Feast days and events happen somewhere. Announcements usually do not. */
  location?: string;
  imageUrl?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** What the admin form offers. Free text would give every parish its own. */
export const ANNOUNCEMENT_TYPES = [
  "Mass",
  "Feast",
  "Event",
  "Notice",
  "Schedule change",
] as const;

/**
 * The three screens in the admin, and what each one holds.
 *
 * Feast Days and Events are not their own collections. They are the same
 * document with a different chip on it - same title, date, picture,
 * published/archived life - and three collections would have meant three
 * sets of rules, three admin pages and three places for the next bug.
 */
export const FEAST_TYPE = "Feast";
export const EVENT_TYPE = "Event";

export type Board = "announcements" | "feasts" | "events";

export function onBoard(item: AnnouncementDoc, board: Board): boolean {
  if (board === "feasts") return item.type === FEAST_TYPE;
  if (board === "events") return item.type === EVENT_TYPE;
  // The announcements board is everything, feasts and events included.
  // A parish secretary looking for "the thing I posted on Tuesday" should
  // not have to remember which chip they gave it.
  return true;
}

export const BOARD_LABEL: Record<Board, string> = {
  announcements: "Announcements",
  feasts: "Feast Days",
  events: "Events",
};

/** Absent means published; see AnnouncementStatus. */
export function statusOf(item: AnnouncementDoc): AnnouncementStatus {
  return item.status ?? "published";
}

export const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

/**
 * What a pilgrim may see: published only.
 *
 * Drafts and archived items are filtered here, in one place, so no screen
 * can forget. The bulletin, the feast list and anything added later all
 * come through this.
 */
export function publishedOnly(items: AnnouncementDoc[]): AnnouncementDoc[] {
  return items.filter(a => statusOf(a) === "published");
}

const COLLECTION = "announcements";

export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * The ones this parish's bulletin should show: its own, plus the legacy
 * diocese-wide ones that belong to nobody.
 */
export function announcementsForParish(
  all: AnnouncementDoc[],
  parishId: string,
): AnnouncementDoc[] {
  return all.filter(a => !a.churchId || a.churchId === parishId);
}

/**
 * Soonest first, with anything already past dropped.
 *
 * A bulletin still showing last month's fiesta is worse than a short one.
 * Undated announcements are kept rather than guessed at — a parish notice
 * with no event date is still a notice — and they sort to the end.
 */
export function upcomingAnnouncements(
  items: AnnouncementDoc[],
  now: Date = new Date(),
): Array<AnnouncementDoc & { when: Date | null }> {
  const today = startOfDay(now);
  return items
    .map(a => {
      const parsed = a.date ? new Date(a.date) : null;
      const when = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      return { ...a, when };
    })
    .filter(a => a.when === null || a.when.getTime() >= today)
    .sort((a, b) => {
      if (a.when === null) return b.when === null ? 0 : 1;
      if (b.when === null) return -1;
      return a.when.getTime() - b.when.getTime();
    });
}

/** "Today", "Tomorrow", "Saturday", or a date once it is more than a week off. */
export function formatWhen(when: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(when) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return when.toLocaleDateString("en-US", { weekday: "long" });
  return when.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export interface NewAnnouncement {
  churchId: string;
  title: string;
  body?: string;
  date: string;
  time?: string;
  type: string;
  location?: string;
  imageUrl?: string;
  status?: AnnouncementStatus;
}

export async function createAnnouncement(
  input: NewAnnouncement,
  authorEmail: string,
): Promise<void> {
  // Undefined fields are stripped rather than sent: Firestore rejects an
  // undefined value outright, and an optional field the parish left blank
  // is the ordinary case here, not an error.
  const payload: Record<string, string> = {
    churchId: input.churchId,
    title: input.title.trim(),
    date: input.date,
    type: input.type,
    createdAt: new Date().toISOString(),
    createdBy: authorEmail,
  };
  payload.status = input.status ?? "published";
  if (input.body?.trim()) payload.body = input.body.trim();
  if (input.time) payload.time = input.time;
  if (input.location?.trim()) payload.location = input.location.trim();
  if (input.imageUrl) payload.imageUrl = input.imageUrl;

  await addDoc(collection(db, COLLECTION), payload);
}

/**
 * Edit, publish, archive and restore - all one write.
 *
 * Archiving is a status change, not a delete. A parish that archived last
 * year's fiesta can still look it up, which is the whole point of having
 * an archive rather than a confirmation dialog.
 */
export async function updateAnnouncement(
  id: string,
  patch: Partial<NewAnnouncement> & { status?: AnnouncementStatus },
  editorEmail: string,
): Promise<void> {
  const clean: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: editorEmail,
  };
  for (const [key, value] of Object.entries(patch)) {
    // Firestore rejects undefined outright, and a field the parish
    // cleared has to be written as "" rather than left behind.
    if (value !== undefined) clean[key] = typeof value === "string" ? value.trim() : value;
  }
  await updateDoc(doc(db, COLLECTION, id), clean);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
