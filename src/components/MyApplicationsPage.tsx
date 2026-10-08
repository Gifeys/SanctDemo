import { useState } from "react";
import { ArrowLeft, Church, ClipboardList, Clock, Trash2, Users } from "lucide-react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toViewApplication, sortByNewest, type ViewApplication } from "../lib/applicationView";

/**
 * "My Applications", on a screen of its own.
 *
 * It was a card on the Me tab, under the profile and above the
 * notifications, and it grew with every application a pilgrim ever made -
 * so the one screen that is meant to be "your account" became a list you
 * had to scroll past to reach anything. A row that says how many, opening
 * its own page, keeps Me short and gives the list room.
 */

const TONE: Record<string, { bg: string; fg: string }> = {
  pending:      { bg: "var(--color-brand-card-sunk)", fg: "var(--color-brand-text)" },
  under_review: { bg: "#E8EEF8", fg: "#1C2C56" },
  approved:     { bg: "#E4F0E8", fg: "#2F5A41" },
  rejected:     { bg: "#FBE9E4", fg: "#8E3F2C" },
  completed:    { bg: "#EDE7F6", fg: "#4A3B70" },
  unknown:      { bg: "var(--color-brand-card-sunk)", fg: "var(--color-brand-secondary)" },
};

export default function MyApplicationsPage({
  applications,
  onBack,
}: {
  applications: unknown[];
  onBack: () => void;
}) {
  const [withdrawing, setWithdrawing] = useState<ViewApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = sortByNewest(
    applications.map(a => toViewApplication(a as Record<string, unknown>)),
  );

  async function withdraw(app: ViewApplication) {
    setBusy(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "applications", app.id));
      setWithdrawing(null);
    } catch {
      // The rules refuse once the parish has acted, which is the common
      // case for anything not pending - say that rather than "failed".
      setError(
        "That could not be withdrawn. Your parish has already started on it — " +
        "please contact the office instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[var(--color-brand-card)]">
      <div className="px-5 pt-5 pb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-brand-primary)]"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="mt-3 text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          My Applications
        </h1>
        <p className="text-[15px] text-[var(--color-brand-secondary)]">
          {items.length === 0
            ? "Nothing submitted yet."
            : `${items.length} application${items.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {error && (
        <p role="alert" className="mx-4 mb-3 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
          {error}
        </p>
      )}

      <div className="px-4 pb-6">
        {items.length === 0 ? (
          <div className="rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-6 text-center">
            <ClipboardList className="mx-auto w-7 h-7 text-[var(--color-brand-secondary)]" />
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
              Sacraments and ministries are on your parish's dashboard. Anything you
              apply for appears here with its progress.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(app => {
              const tone = TONE[app.status] ?? TONE.unknown;
              const Icon = app.kind === "ministry" ? Users : app.kind === "sacrament" ? Church : ClipboardList;
              return (
                <li key={app.id} className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex items-start gap-2">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-brand-secondary)]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-bold text-[16px] leading-snug text-[var(--color-brand-text)]">
                          {app.title}
                        </span>
                        {app.referenceNumber && (
                          <span className="block font-mono text-[13px] text-[var(--color-brand-secondary)]">
                            {app.referenceNumber}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold whitespace-nowrap"
                          style={{ background: tone.bg, color: tone.fg }}>
                      {app.statusLabel}
                    </span>
                  </div>

                  <dl className="mt-2 text-[14px] space-y-0.5">
                    {app.submitted && (
                      <div className="flex gap-2">
                        <dt className="text-[var(--color-brand-secondary)] w-[7.5rem] shrink-0">Submitted</dt>
                        <dd className="text-[var(--color-brand-text)]">{app.submitted}</dd>
                      </div>
                    )}
                    {app.lastUpdate && (
                      <div className="flex gap-2">
                        <dt className="text-[var(--color-brand-secondary)] w-[7.5rem] shrink-0">Last update</dt>
                        <dd className="text-[var(--color-brand-text)] inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[var(--color-brand-secondary)]" aria-hidden />
                          {app.lastUpdate}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {app.note && (
                    <p className="mt-2 rounded-xl bg-[var(--color-brand-card)] px-3 py-2 text-[14px] leading-relaxed text-[var(--color-brand-text)]">
                      <span className="font-bold">From the parish: </span>{app.note}
                    </p>
                  )}

                  {/* Only when there is nothing structured to show. New
                      submissions keep their answers in formData; this is
                      the old flattened sentence, and printing it beside
                      real fields would repeat them. */}
                  {!app.referenceNumber && app.details && app.details !== app.title && (
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
                      {app.details}
                    </p>
                  )}

                  {/* Withdraw, not delete, and only before the parish has
                      started. Once it is under review the record belongs
                      to their work as much as yours. */}
                  {app.status === "pending" && (
                    <button
                      onClick={() => setWithdrawing(app)}
                      className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-error)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Withdraw
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && (
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
            The parish will contact you at your registered email. Quote your reference
            number if you ring them.
          </p>
        )}
      </div>

      {withdrawing && (
        <div role="dialog" aria-modal="true" aria-label="Withdraw application"
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-[380px] rounded-[22px] bg-[var(--color-brand-card)] p-6">
            <h3 className="text-[18px] font-bold font-serif italic">Withdraw this application?</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
              Your application for <strong>{withdrawing.title}</strong> will be removed and
              your parish will no longer see it. You can apply again later.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setWithdrawing(null)} disabled={busy}
                      className="flex-1 rounded-full border-[1.5px] border-[var(--color-brand-border)] py-3 text-[15px] font-bold">
                Keep it
              </button>
              <button onClick={() => void withdraw(withdrawing)} disabled={busy}
                      className="flex-1 rounded-full bg-[var(--color-brand-error)] text-white py-3 text-[15px] font-bold disabled:opacity-60">
                {busy ? "Withdrawing…" : "Yes, withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
