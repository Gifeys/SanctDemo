import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Loader2, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import StatusBadge from "./StatusBadge";
import AdminNav from "./AdminNav";
import { signOutNow } from "../lib/authFlow";
import type { AdminSession } from "./AdminApp";
import { isArchived } from "../lib/applicationFilters";
import ParishStatus from "./ParishStatus";
import type { ApplicationDoc, ApplicationStatus } from "../types";

/**
 * The parish office dashboard.
 *
 * The query filters on churchId, and so do the security rules. Both, on
 * purpose: the filter is what makes the screen correct, the rule is what
 * makes it safe. Without the rule a changed filter would leak another
 * parish; without the filter the rule would simply deny the read and the
 * admin would see an error instead of their own work.
 */
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export default function AdminDashboard({ session }: { session: AdminSession }) {
  const navigate = useNavigate();
  const [apps, setApps] = useState<ApplicationDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const churchId = session.profile.churchId;

  useEffect(() => {
    const q = query(collection(db, "applications"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setApps(snap.docs.map(d => ({ id: d.id, ...(d.data() as ApplicationDoc) }))),
      err => setError(err.message),
    );
  }, [churchId]);

  const counts = useMemo(() => {
    const base: Record<ApplicationStatus, number> = {
      pending: 0, under_review: 0, approved: 0, rejected: 0, completed: 0,
    };
    for (const a of apps ?? []) base[a.status] = (base[a.status] ?? 0) + 1;
    return base;
  }, [apps]);

  /**
   * The totals a parish office actually asks about.
   *
   * Counted over OPEN applications only. These tiles answer "how much
   * work is in", and a completed baptism is not work that is in - it was
   * inflating every figure on this screen, so a parish that had dealt
   * with everything still saw the same four it started the month with
   * and had no way to tell the difference.
   *
   * "This month" is the exception and stays over everything: it is a
   * record of what arrived, not of what is outstanding, and a month's
   * intake that shrank as the office worked through it would be useless.
   */
  const totals = useMemo(() => {
    const now = new Date();
    let open = 0, ministry = 0, sacrament = 0, thisMonth = 0, archived = 0;
    for (const a of apps ?? []) {
      const d = a.createdAt ? new Date(a.createdAt) : null;
      if (d && !Number.isNaN(d.getTime())
          && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        thisMonth++;
      }

      if (isArchived(a.status)) { archived++; continue; }

      open++;
      if (a.kind === "ministry") ministry++;
      else if (a.kind === "sacrament") sacrament++;
    }
    return { open, ministry, sacrament, thisMonth, archived };
  }, [apps]);

  const openApps = useMemo(
    () => (apps ?? []).filter(a => !isArchived(a.status)),
    [apps],
  );

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <header className="bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-5 py-5">
        <p className="text-[13px] font-bold uppercase tracking-wider opacity-80">Parish office</p>
        <h1 className="text-[24px] font-bold font-serif italic">
          {session.church?.name ?? churchId}
        </h1>
        <p className="mt-0.5 text-[14px] opacity-90">{session.profile.fullName || session.user.email}</p>
        {/* Just Sign out here now. Announcements and the rest moved into
            the labelled nav below, where they read as sections of the
            office rather than as two buttons beside the way out. */}
        <button
          onClick={() => void signOutNow()}
          className="mt-3 rounded-full border border-white/40 px-4 py-1.5 text-[14px] font-semibold"
        >
          Sign out
        </button>
      </header>

      <main className="px-4 py-5 max-w-[900px] mx-auto">
        <AdminNav />

        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        {/* Volume first - what came in and of what kind - then the
            status breakdown below. A parish asks "how many" before it
            asks "how many pending". */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Tile label="Still open" value={apps === null ? "—" : totals.open}
                onClick={() => navigate("/admin/applications")} />
          <Tile label="Ministries" value={apps === null ? "—" : totals.ministry}
                onClick={() => navigate("/admin/applications/ministry")} />
          <Tile label="Sacraments" value={apps === null ? "—" : totals.sacrament}
                onClick={() => navigate("/admin/applications/sacrament")} />
          <Tile label="This month" value={apps === null ? "—" : totals.thisMonth}
                onClick={() => navigate("/admin/applications")} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["pending", "under_review", "approved"] as ApplicationStatus[]).map(s => (
            <div key={s} className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
              <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
                {STATUS_LABEL[s]}
              </p>
              <p className="mt-1 text-[28px] font-bold text-[var(--color-brand-text)]">
                {apps === null ? "—" : counts[s]}
              </p>
            </div>
          ))}

          {/* Completed and rejected together, and a way in. They are off
              every other figure on this screen, so there has to be
              somewhere they visibly went - a number that simply dropped
              reads as data lost. */}
          <Tile label="Archived" value={apps === null ? "—" : totals.archived}
                onClick={() => navigate("/admin/applications/archive")} />
        </div>

        {/* What the parish currently looks like to a pilgrim, as opposed
            to how much work is in the tray. An admin who has closed the
            choir and suspended the 8am Mass should be able to see both
            without opening two pages. */}
        <ParishStatus churchId={churchId} />

        <div className="mt-7 mb-3 flex items-baseline justify-between gap-3">
          {/* "Needing attention", not "Recent". The list under it is now
              the open ones, and a finished application is still recent. */}
          <h2 className="text-[17px] font-bold font-serif italic">Needing attention</h2>
          <button
            onClick={() => navigate("/admin/applications")}
            className="text-[15px] font-bold text-[var(--color-brand-primary)]"
          >
            Open the full table
          </button>
        </div>

        {apps === null && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto w-6 h-6 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        )}

        {apps !== null && openApps.length === 0 && (
          <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-10 text-center">
            <Inbox className="mx-auto w-7 h-7 text-[var(--color-brand-secondary)]" />
            <p className="mt-2 text-[15px] font-bold">Nothing waiting</p>
            <p className="mt-1 text-[14px] text-[var(--color-brand-secondary)]">
              {apps.length === 0
                ? "Applications from your parishioners appear here as they are submitted."
                : `Everything has been dealt with. ${totals.archived} ${totals.archived === 1 ? "application is" : "applications are"} in the archive.`}
            </p>
          </div>
        )}

        {apps !== null && openApps.length > 0 && (
          <div className="overflow-x-auto rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[13px] uppercase tracking-wider text-[var(--color-brand-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Reference</th>
                  <th className="px-4 py-3 font-bold">Applicant</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-brand-border)]">
                {openApps.map(a => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open ${a.type ?? a.kind} from ${a.applicantName ?? "applicant"}`}
                    onClick={() => navigate(`/admin/applications/view/${a.id}`)}
                    onKeyDown={e => {
                      // The row is the target, so it has to answer the
                      // keyboard the way a link would.
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/admin/applications/view/${a.id}`);
                      }
                    }}
                    className="cursor-pointer hover:bg-[var(--color-brand-card-sunk)] focus:bg-[var(--color-brand-card-sunk)] outline-none"
                  >
                    <td className="px-4 py-3 font-mono text-[13px]">{a.referenceNumber ?? a.id}</td>
                    <td className="px-4 py-3">{a.applicantName ?? "—"}</td>
                    <td className="px-4 py-3">{a.type ?? a.kind}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * One headline number, and a way into the list behind it.
 *
 * Clickable because a count a parish cannot act on is trivia: "12
 * pending" should be one tap from the twelve.
 */
function Tile({ label, value, onClick }: { label: string; value: number | string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 hover:bg-[var(--color-brand-card-sunk)]"
    >
      <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-bold text-[var(--color-brand-text)]">{value}</p>
    </button>
  );
}
