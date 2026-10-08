import { ClipboardList, Church, Users, Clock } from "lucide-react";
import { toViewApplication, sortByNewest, type ViewApplication } from "../lib/applicationView";

/**
 * "My Applications" — what the pilgrim submitted and where it has got to.
 *
 * ## Why the reference number is prominent
 *
 * It is the only thing a parish office can look someone up by over the
 * phone. Buried in small print it may as well not exist, so it sits under
 * the title in a monospaced face that survives being read aloud.
 *
 * ## Why the status is a word and a tint, never a tint alone
 *
 * "Approved" and "Rejected" are the two most consequential words the app
 * says to anyone. A colour-blind reader, a printed page or a bright day in
 * a church porch all take the colour away; the word has to carry it.
 */

const TONE: Record<string, { bg: string; fg: string }> = {
  pending:      { bg: "var(--color-brand-card-sunk)", fg: "var(--color-brand-text)" },
  under_review: { bg: "#E8EEF8", fg: "#1C2C56" },
  approved:     { bg: "#E4F0E8", fg: "#2F5A41" },
  rejected:     { bg: "#FBE9E4", fg: "#8E3F2C" },
  completed:    { bg: "#EDE7F6", fg: "#4A3B70" },
  unknown:      { bg: "var(--color-brand-card-sunk)", fg: "var(--color-brand-secondary)" },
};

export default function MyApplications({ applications }: { applications: unknown[] }) {
  const items = sortByNewest(
    applications.map(a => toViewApplication(a as Record<string, unknown>)),
  );

  return (
    <div className="bg-[var(--color-brand-card-sunk)] rounded-[22px] border border-[var(--color-brand-border)] p-5 space-y-3">
      <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans flex items-center gap-1.5">
        <ClipboardList className="w-4 h-4" /> My Applications
      </h4>

      {items.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          Nothing submitted yet. Sacraments and ministries are on your parish's
          dashboard, and anything you apply for appears here with its progress.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map(app => <Card key={app.id} app={app} />)}
          </ul>
          <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
            The parish will contact you at your registered email. Quote your reference
            number if you ring them.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ app }: { app: ViewApplication }) {
  const tone = TONE[app.status] ?? TONE.unknown;
  const Icon = app.kind === "ministry" ? Users : app.kind === "sacrament" ? Church : ClipboardList;

  return (
    <li className="bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-brand-secondary)]" aria-hidden />
          <span className="min-w-0">
            <span className="block font-bold text-[15px] leading-snug text-[var(--color-brand-text)]">
              {app.title}
            </span>
            {app.referenceNumber && (
              <span className="block font-mono text-[13px] text-[var(--color-brand-secondary)]">
                {app.referenceNumber}
              </span>
            )}
          </span>
        </span>

        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold whitespace-nowrap"
          style={{ background: tone.bg, color: tone.fg }}
        >
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
        <p className="mt-2 rounded-xl bg-[var(--color-brand-card-sunk)] px-3 py-2 text-[14px] leading-relaxed text-[var(--color-brand-text)]">
          <span className="font-bold">From the parish: </span>{app.note}
        </p>
      )}

      {/* Only when there is nothing structured to show. New submissions
          keep their answers in formData; this is the old flattened
          sentence, and printing it alongside real fields would repeat
          them. */}
      {!app.referenceNumber && app.details && app.details !== app.title && (
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
          {app.details}
        </p>
      )}
    </li>
  );
}
