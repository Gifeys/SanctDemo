import type { ApplicationDoc, ApplicationStatus } from "../types";

/**
 * Filtering and sorting the parish's applications.
 *
 * Pure functions on an array, deliberately. The alternative is a Firestore
 * query per filter combination, and that needs a composite index for every
 * one of them - churchId + kind + status + a createdAt range is a different
 * index from churchId + type + status, and an index that has not been
 * deployed makes the page throw rather than render.
 *
 * A parish's application list is hundreds of rows, not millions. The whole
 * parish arrives in one churchId query - which the security rules already
 * scope - and the filtering happens here, where it is instant, needs no
 * index, and can be unit-tested without a database.
 *
 * If a parish ever outgrows that, the fix is pagination on createdAt, not a
 * matrix of indexes.
 */

/**
 * Whether a view is showing live work or the archive.
 *
 * "Archived" is not a field on the document and deliberately so. An
 * application is finished when the parish has finished with it - rejected
 * or completed - and that is already recorded in `status`. A separate
 * `archived: true` would be a second source of truth for the same fact,
 * and the two would drift the first time anyone reopened something.
 */
export type Scope = "open" | "archived" | "all";

/** The statuses that take an application out of the parish's in-tray. */
export const ARCHIVED_STATUSES: ApplicationStatus[] = ["rejected", "completed"];

export function isArchived(status: ApplicationStatus): boolean {
  return ARCHIVED_STATUSES.includes(status);
}

export interface Filters {
  /**
   * Defaults to "open". A parish office asking "how many applications do
   * we have" means the ones still needing something done, not every one
   * ever filed - the finished ones were inflating every count on the
   * dashboard and every list under it.
   */
  scope: Scope;
  /** 1-12, or null for any month. */
  month: number | null;
  year: number | null;
  /** "ministry" | "sacrament", or null for both. */
  kind: "ministry" | "sacrament" | null;
  /** The exact ministry or sacrament name, or null for all of them. */
  type: string | null;
  status: ApplicationStatus | null;
  /** ISO dates, inclusive. Independent of month/year. */
  from: string | null;
  to: string | null;
  /** Matched against name, email, reference and type. */
  search: string;
}

/**
 * The resting state of the table: no filters chosen, and the archive put
 * away. "Clear filters" returns here, which is why scope lives in this
 * object rather than beside it.
 */
export const NO_FILTERS: Filters = {
  scope: "open",
  month: null, year: null, kind: null, type: null,
  status: null, from: null, to: null, search: "",
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The date an application is filed under: when it was submitted. */
export function submittedAt(app: ApplicationDoc): Date | null {
  const raw = app.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function matchesSearch(app: ApplicationDoc, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  // Reference last: it is the least likely thing typed, but the most
  // decisive when it is.
  return (
    (app.applicantName ?? "").toLowerCase().includes(q) ||
    (app.applicantEmail ?? "").toLowerCase().includes(q) ||
    (app.type ?? "").toLowerCase().includes(q) ||
    (app.referenceNumber ?? "").toLowerCase().includes(q)
  );
}

export function applyFilters(apps: ApplicationDoc[], f: Filters): ApplicationDoc[] {
  return apps.filter(app => {
    if (f.kind && app.kind !== f.kind) return false;
    if (f.type && app.type !== f.type) return false;
    if (f.status && app.status !== f.status) return false;

    // Scope yields to an explicit status. Asking for "Completed" while the
    // view is scoped to open work would otherwise return nothing at all,
    // and an empty table is read as "there are none" rather than as "those
    // two filters cannot both be true".
    if (!f.status && f.scope !== "all") {
      const archived = isArchived(app.status);
      if (f.scope === "open" && archived) return false;
      if (f.scope === "archived" && !archived) return false;
    }
    if (!matchesSearch(app, f.search)) return false;

    const when = submittedAt(app);

    // A row with no usable date cannot honestly be said to fall inside a
    // month or a range, so it drops out of a dated view rather than being
    // shown under a month it might not belong to.
    if (f.month !== null || f.year !== null || f.from || f.to) {
      if (!when) return false;
    }

    if (f.year !== null && when!.getFullYear() !== f.year) return false;
    if (f.month !== null && when!.getMonth() + 1 !== f.month) return false;

    if (f.from) {
      const from = new Date(f.from);
      if (!Number.isNaN(from.getTime()) && when! < startOfDay(from)) return false;
    }
    if (f.to) {
      const to = new Date(f.to);
      // Inclusive: "to 31 August" means the whole of the 31st, not midnight.
      if (!Number.isNaN(to.getTime()) && when! > endOfDay(to)) return false;
    }

    return true;
  });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export type SortKey = "submitted" | "name" | "type" | "status" | "reference";

export function sortApplications(
  apps: ApplicationDoc[],
  key: SortKey,
  direction: "asc" | "desc",
): ApplicationDoc[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...apps].sort((a, b) => {
    let cmp = 0;
    if (key === "submitted") {
      const ta = submittedAt(a)?.getTime() ?? 0;
      const tb = submittedAt(b)?.getTime() ?? 0;
      cmp = ta - tb;
    } else if (key === "name") {
      cmp = (a.applicantName ?? "").localeCompare(b.applicantName ?? "");
    } else if (key === "type") {
      cmp = (a.type ?? "").localeCompare(b.type ?? "");
    } else if (key === "status") {
      cmp = (a.status ?? "").localeCompare(b.status ?? "");
    } else {
      cmp = (a.referenceNumber ?? "").localeCompare(b.referenceNumber ?? "");
    }
    return cmp * sign;
  });
}

/**
 * The ministry and sacrament names actually present in this parish's
 * applications.
 *
 * Read from the data rather than from the MINISTRIES catalogue, so the
 * dropdown offers what someone has really applied for. A list of thirty
 * ministries where twenty-eight return nothing is a list you have to read
 * twice to use once - and a ministry that was renamed still appears here
 * for the old applications that carry the old name.
 */
export function typesPresent(apps: ApplicationDoc[], kind?: "ministry" | "sacrament"): string[] {
  const seen = new Set<string>();
  for (const a of apps) {
    if (kind && a.kind !== kind) continue;
    if (a.type) seen.add(a.type);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** The years with at least one application, newest first. */
export function yearsPresent(apps: ApplicationDoc[]): number[] {
  const seen = new Set<number>();
  for (const a of apps) {
    const d = submittedAt(a);
    if (d) seen.add(d.getFullYear());
  }
  return [...seen].sort((a, b) => b - a);
}

/**
 * How many filters the admin has chosen, for the "Clear filters" button.
 *
 * The default scope does not count: it is the resting state of the table,
 * and offering to clear a filter nobody set is confusing. Switching to the
 * archive or to everything does count, because that IS a choice and it is
 * the one most likely to explain a surprising list.
 */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.scope !== "open") n++;
  if (f.month !== null) n++;
  if (f.year !== null) n++;
  if (f.kind) n++;
  if (f.type) n++;
  if (f.status) n++;
  if (f.from) n++;
  if (f.to) n++;
  if (f.search.trim()) n++;
  return n;
}
