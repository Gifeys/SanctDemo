/**
 * Who actually belongs to a ministry.
 *
 * ## Why this is not a status on the application
 *
 * An application is a request and a record of a decision. A membership
 * is a fact about a person today. They come apart constantly: somebody
 * applies twice over three years, is approved once, later leaves; the
 * applications are all still true and only one of them says anything
 * about now.
 *
 * Keeping them apart is also what makes the Excel "Member" column
 * honest. Reading it off the application status would mark somebody a
 * member because a form was submitted, which is the specific thing the
 * parish asked not to happen.
 *
 * ## Why the id is deterministic
 *
 * `{uid}__{itemId}`. Approving the same person for the same ministry
 * twice overwrites one row rather than making a second, so duplicates
 * are impossible by construction - no query, no dedupe pass, and no
 * race between two admins pressing Approve at the same moment.
 *
 * Double underscore because ministry ids carry single hyphens
 * ("min-altar-servers") and uids are alphanumeric, so the separator
 * cannot appear inside either part.
 *
 * Pure and dependency-free, so every rule here is testable without
 * Firebase.
 */

export const MEMBERSHIPS = "memberships";

export interface MembershipDoc {
  uid: string;
  churchId: string;
  /** "min-altar-servers" */
  itemId: string;
  /** The name as the parish shows it, so a list needs no second lookup. */
  ministryName: string;
  registrationType: RegistrationType;
  /** The application this came from, for the audit trail. */
  applicationId: string;
  approvedAt: string;
  /** The admin who approved it. */
  approvedBy: string;
}

/**
 * How somebody came to be in a ministry.
 *
 * Absent means new_applicant. Every application written before this
 * existed was one, so reading absence that way needs no migration and
 * no backfill.
 */
export type RegistrationType = "new_applicant" | "existing_member";

export function registrationTypeOf(value: unknown): RegistrationType {
  return value === "existing_member" ? "existing_member" : "new_applicant";
}

/** What the parish sees on screen and in the spreadsheet. */
export function registrationTypeLabel(type: RegistrationType): string {
  return type === "existing_member" ? "Existing Member" : "New Applicant";
}

/** The one and only id a membership may have. */
export function membershipId(uid: string, itemId: string): string {
  return `${uid}__${itemId}`;
}

/**
 * Whether this person is an approved member of this ministry.
 *
 * Takes the memberships, never the applications. A caller that reaches
 * for an application's status here is asking the wrong question.
 */
export function isMember(
  memberships: readonly MembershipDoc[],
  uid: string,
  itemId: string,
): boolean {
  return memberships.some(m => m.uid === uid && m.itemId === itemId);
}

/**
 * The ministries to show under "My Ministries".
 *
 * Only approved ones, because that is what a badge claims. A pending
 * application is in the applications list where it belongs and must
 * never appear here - the parish was explicit, and it is the
 * difference between "I asked" and "I am".
 *
 * Sorted by name so the list does not reorder itself when a second
 * membership arrives.
 */
export function myMinistries(
  memberships: readonly MembershipDoc[],
  uid: string,
): MembershipDoc[] {
  return memberships
    .filter(m => m.uid === uid)
    .slice()
    .sort((a, b) => a.ministryName.localeCompare(b.ministryName));
}

/**
 * The warning shown when somebody already in one ministry applies to
 * another.
 *
 * Not a refusal. The parish allows it; this only makes sure nobody
 * applies thinking it will replace what they already have.
 *
 * Returns null when there is nothing to warn about, so the caller
 * renders nothing rather than an empty box.
 */
export function alreadyMemberWarning(
  memberships: readonly MembershipDoc[],
  uid: string,
  applyingToItemId: string,
): string | null {
  const others = myMinistries(memberships, uid)
    .filter(m => m.itemId !== applyingToItemId);
  if (others.length === 0) return null;

  const names = others.map(m => m.ministryName);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    `You are already a verified member of ${list}. ` +
    `You may still apply to another ministry — your existing membership will not change.`
  );
}

/**
 * Whether a decision should grant a membership.
 *
 * Ministries only: a sacrament is an event, not a thing you belong to.
 */
export function grantsMembership(kind: string, status: string): boolean {
  return kind === "ministry" && status === "approved";
}

/**
 * Whether a decision should take one away.
 *
 * Reversing an approval has to remove the badge, or somebody carries a
 * membership the parish has withdrawn. The APPLICATION keeps its
 * history either way - the audit trail is the record of what was
 * decided and when, and nothing here touches it.
 *
 * Only this ministry's membership. Somebody in three ministries who is
 * rejected from a fourth keeps the other three, which is why the id
 * carries the itemId.
 */
export function revokesMembership(kind: string, status: string): boolean {
  return kind === "ministry" && (status === "rejected" || status === "pending" || status === "under_review");
}
