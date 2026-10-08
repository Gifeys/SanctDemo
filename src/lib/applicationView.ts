import type { ApplicationStatus } from "../types";
import { STATUS_LABEL } from "./applications";

/**
 * One shape for a pilgrim's submissions, old and new.
 *
 * ## Why a normaliser exists at all
 *
 * The applications collection has two generations in it. The new ones carry
 * `kind`, `referenceNumber`, a lowercase status from a fixed set, and
 * structured `formData`. The ones already in the database carry `type:
 * "Ministry Application"`, a free-text status like "Awaiting Parish
 * Interview", and the answers flattened into a `details` sentence.
 *
 * Migrating them would mean a server pass over documents belonging to real
 * people, on a plan with no Cloud Functions, to change rows a parish may
 * already have acted on. Reading both is cheaper and loses nothing: the old
 * rows are finite and stop appearing once they are closed.
 */

export interface ViewApplication {
  id: string;
  /** "Baptism", or the ministry's name. */
  title: string;
  kind: "sacrament" | "ministry" | "other";
  status: ApplicationStatus | "unknown";
  /** What to print for the status, including an old free-text one. */
  statusLabel: string;
  referenceNumber?: string;
  /** Already formatted for reading. */
  submitted: string;
  /** When the parish last touched it, if they have. */
  lastUpdate?: string;
  /** The office's note, when there is one. */
  note?: string;
  /** Legacy summary line, shown only when there is nothing better. */
  details?: string;
}

/** A record as it may arrive from Firestore: either generation. */
type RawApplication = Record<string, unknown> & { id?: string };

const KNOWN: ApplicationStatus[] = [
  "pending", "under_review", "approved", "rejected", "completed",
];

/**
 * A free-text status as one of the five, where that is honest.
 *
 * "Awaiting" is tested before "interview" on purpose: "Awaiting Parish
 * Interview" means the parish has not acted, which is pending. Matching
 * "interview" first would report it as already under review and tell the
 * applicant something untrue.
 *
 * Anything unrecognised stays "unknown" and is printed as written, rather
 * than being guessed into a colour that implies an outcome.
 */
export function normaliseStatus(raw: unknown): { status: ApplicationStatus | "unknown"; label: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { status: "unknown", label: "Submitted" };

  const exact = text.toLowerCase().replace(/[\s-]+/g, "_");
  if ((KNOWN as string[]).includes(exact)) {
    return { status: exact as ApplicationStatus, label: STATUS_LABEL[exact as ApplicationStatus] };
  }

  const lower = text.toLowerCase();
  if (lower.includes("declin") || lower.includes("reject")) return { status: "rejected", label: text };
  if (lower.includes("complet")) return { status: "completed", label: text };
  if (lower.includes("approve")) return { status: "approved", label: text };
  if (lower.includes("pending") || lower.includes("awaiting")) return { status: "pending", label: text };
  if (lower.includes("review") || lower.includes("interview") || lower.includes("schedul")) {
    return { status: "under_review", label: text };
  }
  return { status: "unknown", label: text };
}

function readableDate(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const d = new Date(text);
  // Old rows store a localised date string, which is already readable and
  // does not survive being parsed and reformatted.
  if (Number.isNaN(d.getTime())) return text;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function toViewApplication(raw: RawApplication): ViewApplication {
  const kindField = raw.kind;
  const kind: ViewApplication["kind"] =
    kindField === "sacrament" || kindField === "ministry"
      ? kindField
      : raw.type === "Ministry Application"
        ? "ministry"
        : raw.type === "Sacrament Booking"
          ? "sacrament"
          : "other";

  const { status, label } = normaliseStatus(raw.status);

  // New rows name the thing in `type`; the oldest ministry rows put the
  // literal words "Ministry Application" there and the real name beside it.
  const title =
    (typeof raw.ministryName === "string" && raw.ministryName) ||
    (typeof raw.type === "string" && raw.type !== "Ministry Application" && raw.type) ||
    (typeof raw.details === "string" && raw.details) ||
    "Application";

  const history = Array.isArray(raw.history) ? raw.history : [];
  const last = history.length > 1 ? history[history.length - 1] : undefined;

  return {
    id: String(raw.id ?? ""),
    title: String(title),
    kind,
    status,
    statusLabel: label,
    referenceNumber: typeof raw.referenceNumber === "string" ? raw.referenceNumber : undefined,
    submitted: readableDate(raw.createdAt ?? raw.submittedAt ?? raw.date),
    lastUpdate: typeof raw.reviewedAt === "string"
      ? readableDate(raw.reviewedAt)
      : last && typeof (last as { at?: unknown }).at === "string"
        ? readableDate((last as { at: string }).at)
        : undefined,
    note: typeof raw.adminNote === "string" ? raw.adminNote : undefined,
    details: typeof raw.details === "string" ? raw.details : undefined,
  };
}

/**
 * Newest first, by the date shown.
 *
 * Old rows carry a localised date string that cannot be compared, so they
 * fall to the end rather than being interleaved wrongly - which is the
 * honest ordering when the data cannot say.
 */
export function sortByNewest(list: ViewApplication[]): ViewApplication[] {
  return [...list].sort((a, b) => {
    const da = Date.parse(a.submitted);
    const dbb = Date.parse(b.submitted);
    if (Number.isNaN(da) && Number.isNaN(dbb)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(dbb)) return -1;
    return dbb - da;
  });
}
