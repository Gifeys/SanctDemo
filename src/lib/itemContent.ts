import type { ParishContent } from "./parishContent";
import { MINISTRIES, SACRAMENTS } from "../data";

/**
 * What a parish has written about one ministry or sacrament.
 *
 * ## Why this overlays data.ts rather than replacing it
 *
 * The descriptions and canonical requirements in data.ts came from the
 * parish and are correct. 29 of the 31 parishes have written nothing
 * here, and must keep showing what they have. So every field is optional
 * and falls back: a parish that edits only the schedule keeps the
 * description the app shipped with.
 *
 * ## Why this is not the application record
 *
 * This is the page a pilgrim reads before applying. The application is
 * what they send afterwards. Keeping them apart means a parish can
 * correct a requirement without touching anybody's submission, which is
 * the whole reason the brief asks for them to be separate.
 *
 * ## Why nothing here is invented
 *
 * Every field starts empty. The app never writes a requirement, a fee or
 * a schedule that a parish did not type - the standing rule in this
 * codebase is that a plausible-looking wrong answer about a sacrament is
 * worse than no answer.
 */
export interface ItemContent {
  /** Replaces the compiled description when the parish writes one. */
  about?: string;
  /** Replaces the compiled requirements list entirely when non-empty. */
  requirements?: string[];
  /** "Saturdays, 9:00 AM" - free text, because parishes phrase it their way. */
  schedule?: string;
  /** The steps, in order, from applying to the day itself. */
  process?: string[];
  /** "Bring the originals", "Arrive fifteen minutes early". */
  reminders?: string[];
  /** Who to ring, and when the office is open. */
  contact?: string;
  /** Responsibilities, for ministries. */
  responsibilities?: string[];
}

/** The content as it should be displayed: parish's words over the app's. */
export interface ResolvedItem {
  id: string;
  name: string;
  about: string;
  requirements: string[];
  schedule: string;
  process: string[];
  reminders: string[];
  responsibilities: string[];
  contact: string;
}

function managedFor(
  content: ParishContent | null | undefined,
  itemId: string,
): ItemContent {
  return content?.itemContent?.[itemId] ?? {};
}

/**
 * A list wins only when it has something in it.
 *
 * An admin who opens the editor, saves, and types nothing writes `[]`.
 * Treating that as "the parish says there are no requirements" would
 * blank a correct list that came from the parish in the first place.
 */
function listOrFallback(managed: string[] | undefined, compiled: string[]): string[] {
  return managed && managed.length > 0 ? managed : compiled;
}

function textOrFallback(managed: string | undefined, compiled: string): string {
  return managed?.trim() ? managed.trim() : compiled;
}

export function resolveMinistry(
  content: ParishContent | null | undefined,
  ministryId: string,
): ResolvedItem | null {
  const base = MINISTRIES.find(m => m.id === ministryId);
  if (!base) return null;
  const managed = managedFor(content, ministryId);
  return {
    id: base.id,
    name: base.name,
    about: textOrFallback(managed.about, base.description),
    requirements: listOrFallback(managed.requirements, base.requirements),
    schedule: managed.schedule?.trim() ?? "",
    process: managed.process ?? [],
    reminders: managed.reminders ?? [],
    responsibilities: managed.responsibilities ?? [],
    contact: managed.contact?.trim() ?? "",
  };
}

export function resolveSacrament(
  content: ParishContent | null | undefined,
  sacramentId: string,
): ResolvedItem | null {
  const base = SACRAMENTS.find(s => s.id === sacramentId);
  if (!base) return null;
  const managed = managedFor(content, sacramentId);
  return {
    id: base.id,
    name: base.name,
    about: textOrFallback(managed.about, base.description),
    requirements: listOrFallback(managed.requirements, base.requirements),
    // The compiled scheduleDetails is the parish's own line and stays
    // the fallback - a sacrament page with no schedule at all is the
    // most-asked question in a parish office.
    schedule: textOrFallback(managed.schedule, base.scheduleDetails),
    process: managed.process ?? [],
    reminders: managed.reminders ?? [],
    responsibilities: [],
    contact: managed.contact?.trim() ?? "",
  };
}

/**
 * Turns a textarea into a list, one item per line.
 *
 * Blank lines are dropped rather than becoming empty bullets - people
 * leave one between paragraphs out of habit, and a list with a gap in it
 * looks broken.
 */
export function linesToList(value: string): string[] {
  return value.split("\n").map(line => line.trim()).filter(Boolean);
}

export function listToLines(value: string[] | undefined): string {
  return (value ?? []).join("\n");
}

/**
 * One item's content merged into the parish's document.
 *
 * Fields the admin left empty are REMOVED rather than written as "" or
 * [], so the fallback to data.ts keeps working. Writing an empty string
 * would mean "the parish says this is blank", which is a different and
 * wrong claim.
 */
export function mergeItemContent(
  existing: ParishContent | null | undefined,
  itemId: string,
  patch: ItemContent,
): Record<string, ItemContent> {
  const all = { ...(existing?.itemContent ?? {}) };
  const clean: ItemContent = {};

  if (patch.about?.trim()) clean.about = patch.about.trim();
  if (patch.schedule?.trim()) clean.schedule = patch.schedule.trim();
  if (patch.contact?.trim()) clean.contact = patch.contact.trim();
  if (patch.requirements?.length) clean.requirements = patch.requirements;
  if (patch.process?.length) clean.process = patch.process;
  if (patch.reminders?.length) clean.reminders = patch.reminders;
  if (patch.responsibilities?.length) clean.responsibilities = patch.responsibilities;

  if (Object.keys(clean).length === 0) {
    // Nothing written: drop the key entirely rather than leaving {}
    // behind for every item an admin ever opened.
    delete all[itemId];
  } else {
    all[itemId] = clean;
  }
  return all;
}

/** True when the parish has written anything at all about this one. */
export function hasParishContent(
  content: ParishContent | null | undefined,
  itemId: string,
): boolean {
  return Object.keys(managedFor(content, itemId)).length > 0;
}
