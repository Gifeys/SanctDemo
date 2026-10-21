/**
 * "Tell me when this opens."
 *
 * Most of what a parish offers is closed most of the time. Confirmation
 * runs once a year, the choir takes members when somebody leaves, and a
 * Mass marked unavailable goes back on the schedule when the priest is
 * back. The app could say "not available" and leave it there - and did
 * - which puts the burden on the pilgrim to keep checking a screen that
 * will look identical on all but one of the days they open it.
 *
 * A subscription is that check, moved off the pilgrim. It is kept on the
 * device, not in Firestore: the thing being watched is already streaming
 * in for the parish page, so the only state that needs to persist is
 * which of those things this person cares about. That also means no
 * account is required to be told, which matters for a parish app whose
 * visitors mostly never sign in.
 *
 * What it deliberately is NOT is a push subscription. Nothing is
 * delivered while the app is closed; see lib/deviceNotifications for
 * why that stayed out of scope. The notice arrives the first time the
 * app is open and sees the change, which for a ministry that opens for
 * a fortnight is in good time, and for a Mass restored this Sunday is
 * not. That is a real limit and it is why the bell's own wording
 * promises a notice, not an instant one.
 */

/** What a pilgrim can ask to be told about. */
export type WatchKind = "mass" | "ministry" | "sacrament";

export interface Watch {
  kind: WatchKind;
  parishId: string;
  /** The ministry or sacrament id. Omitted for a parish's Mass schedule. */
  itemId?: string;
}

const STORE_KEY = "sanctiwalk.watch.v1";

/**
 * One line per watch, stable across reloads and orderings.
 *
 * Built from the parts rather than stored as typed, so two components
 * asking about the same ministry always agree.
 */
export function watchKey(watch: Watch): string {
  return watch.itemId
    ? `${watch.kind}:${watch.parishId}:${watch.itemId}`
    : `${watch.kind}:${watch.parishId}`;
}

function readAll(): Set<string> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    // Anything else in that slot is somebody else's data or a half
    // written value. An empty set is the safe reading of both.
    return Array.isArray(parsed) ? new Set(parsed.filter(v => typeof v === "string")) : new Set();
  } catch {
    // Private mode, or a quota refusal. Watching simply does not
    // persist; nothing else should break because of it.
    return new Set();
  }
}

function writeAll(keys: Set<string>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...keys]));
  } catch {
    /* as above */
  }
}

export function isWatched(watch: Watch): boolean {
  return readAll().has(watchKey(watch));
}

/** Returns what the watch is after the change, so callers can render it. */
export function setWatched(watch: Watch, on: boolean): boolean {
  const keys = readAll();
  if (on) keys.add(watchKey(watch));
  else keys.delete(watchKey(watch));
  writeAll(keys);
  notifyListeners();
  return on;
}

export function watchedKeys(): ReadonlySet<string> {
  return readAll();
}

/**
 * Lets every bell on screen agree with every other one.
 *
 * Two bells can point at the same thing - a sacrament has one on its
 * card and another on its detail page - and localStorage fires no event
 * in the tab that wrote it, so without this the one you did not tap
 * keeps the old face until something else re-renders it.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* one bad subscriber must not silence the rest */
    }
  }
}

export function onWatchChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
