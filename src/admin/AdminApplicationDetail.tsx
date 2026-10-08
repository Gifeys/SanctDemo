import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Loader2, ShieldAlert, Check, X, Clock, FileCheck } from "lucide-react";
import { db } from "../lib/firebase";
import { setApplicationStatus, STATUS_LABEL, isClosed } from "../lib/applications";
import StatusBadge from "./StatusBadge";
import type { AdminSession } from "./AdminApp";
import type { ApplicationDoc, ApplicationStatus } from "../types";

/**
 * One application, and the decision on it.
 *
 * ## Why a live subscription rather than a single read
 *
 * A parish can have more than one person in the office. Two reviewers on
 * the same application should not each be looking at a snapshot from when
 * they opened it, deciding against a state that has since changed. The
 * document streams, so a decision made elsewhere appears here.
 *
 * ## Why rejection asks and approval does not
 *
 * Approving moves an application forward and can be followed by rejecting
 * it later. Rejecting is what the applicant reads as "no", and it is the
 * one a slip of the thumb should not be able to do. The confirm step is on
 * the irreversible-feeling action only; putting one on every button
 * teaches people to dismiss them.
 */
export default function AdminApplicationDetail({ session }: { session: AdminSession }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<ApplicationDoc | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, "applications", id),
      snap => setApp(snap.exists() ? { id: snap.id, ...(snap.data() as ApplicationDoc) } : "missing"),
      // A denial here is the rules refusing another parish's document, which
      // is the system working. Say so plainly rather than showing a stack.
      () => setApp("missing"),
    );
  }, [id]);

  async function decide(status: ApplicationStatus) {
    // The document, not the union: `app` is also "missing" and null while
    // loading, and neither has an applicant to tell.
    const current = app && app !== "missing" ? app : null;
    if (!id || !current) return;
    setBusy(true);
    setError(null);
    try {
      await setApplicationStatus(id, status, note.trim() || undefined, {
        uid: current.uid,
        churchId: current.churchId,
        what: current.type,
      });
      setNote("");
      setConfirming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that decision.");
    } finally {
      setBusy(false);
    }
  }

  if (app === null) {
    return <Frame onBack={() => navigate("/admin")}>
      <div className="py-16 text-center">
        <Loader2 className="mx-auto w-7 h-7 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    </Frame>;
  }

  if (app === "missing") {
    return <Frame onBack={() => navigate("/admin")}>
      <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-12 text-center px-6">
        <ShieldAlert className="mx-auto w-7 h-7 text-[var(--color-brand-secondary)]" />
        <p className="mt-2 text-[16px] font-bold">This application is not available</p>
        <p className="mt-1 text-[14px] text-[var(--color-brand-secondary)]">
          It may have been removed, or it belongs to another parish.
        </p>
      </div>
    </Frame>;
  }

  const closed = isClosed(app.status);

  return (
    <Frame onBack={() => navigate("/admin")}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold font-serif italic text-[var(--color-brand-text)]">
          {app.type}
        </h1>
        <StatusBadge status={app.status} />
      </div>
      <p className="mt-1 font-mono text-[14px] text-[var(--color-brand-secondary)]">
        {app.referenceNumber ?? app.id}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
          {error}
        </p>
      )}

      <Section title="Applicant">
        <Row label="Name" value={app.applicantName} />
        <Row label="Email" value={app.applicantEmail} />
        <Row label="Parish" value={session.church?.name ?? app.churchId} />
        <Row label="Submitted" value={formatWhen(app.createdAt)} />
      </Section>

      {app.formData && Object.keys(app.formData).length > 0 && (
        <Section title={app.kind === "sacrament" ? "Sacrament details" : "Ministry details"}>
          {Object.entries(app.formData).map(([key, value]) => (
            // Keyed on a Fragment rather than on Row: React 19's types take
            // `key` out of props, so putting it on a plain component is an
            // error unless the component declares it - and a component that
            // declares `key` is lying about what it receives.
            <Fragment key={key}>
              <Row label={humanise(key)} value={renderValue(value)} />
            </Fragment>
          ))}
        </Section>
      )}

      {app.adminNote && (
        <Section title="Office note">
          <p className="text-[15px] leading-relaxed text-[var(--color-brand-text)]">{app.adminNote}</p>
        </Section>
      )}

      {app.history && app.history.length > 0 && (
        <Section title="History">
          <ol className="space-y-2.5">
            {[...app.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-primary)]" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{STATUS_LABEL[h.status] ?? h.status}</span>
                  <span className="block text-[13px] text-[var(--color-brand-secondary)]">{formatWhen(h.at)}</span>
                  {h.note && <span className="block text-[14px] mt-0.5">{h.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Decision">
        {closed && (
          <p className="mb-3 text-[14px] text-[var(--color-brand-secondary)]">
            This application is {STATUS_LABEL[app.status].toLowerCase()}. You can still reopen it
            by putting it back under review.
          </p>
        )}

        <label htmlFor="note" className="block text-[14px] font-bold mb-1.5">
          Note for the record <span className="font-normal text-[var(--color-brand-secondary)]">(optional)</span>
        </label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Why, or what happens next."
          className="w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 text-[15px]"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Action icon={<Clock className="w-4 h-4" />} label="Under review"
                  disabled={busy || app.status === "under_review"}
                  onClick={() => void decide("under_review")} />
          <Action icon={<Check className="w-4 h-4" />} label="Approve" primary
                  disabled={busy || app.status === "approved"}
                  onClick={() => void decide("approved")} />
          <Action icon={<FileCheck className="w-4 h-4" />} label="Completed"
                  disabled={busy || app.status === "completed"}
                  onClick={() => void decide("completed")} />
          <Action icon={<X className="w-4 h-4" />} label="Reject" danger
                  disabled={busy || app.status === "rejected"}
                  onClick={() => setConfirming("rejected")} />
        </div>
      </Section>

      {confirming === "rejected" && (
        <ConfirmDialog
          title="Reject this application?"
          body={`${app.applicantName || "The applicant"} will see this marked as rejected. You can reopen it afterwards, but they may have read it by then.`}
          confirmLabel={busy ? "Rejecting…" : "Yes, reject"}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void decide("rejected")}
        />
      )}
    </Frame>
  );
}

function Frame({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[760px] mx-auto px-4 py-6">
        <button onClick={onBack}
                className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-brand-primary)]">
          <ArrowLeft className="w-4 h-4" /> All applications
        </button>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 py-1.5 border-b border-[var(--color-brand-border)] last:border-0">
      <span className="w-[150px] shrink-0 text-[14px] text-[var(--color-brand-secondary)]">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] text-[var(--color-brand-text)] break-words">{value || "—"}</span>
    </div>
  );
}

function Action({
  label, icon, onClick, disabled, primary, danger,
}: {
  label: string; icon: ReactNode; onClick: () => void;
  disabled?: boolean; primary?: boolean; danger?: boolean;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] font-bold disabled:opacity-40";
  const style = primary
    ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]"
    : danger
      ? "border-[1.5px] border-[var(--color-brand-error)] text-[var(--color-brand-error)]"
      : "border-[1.5px] border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {icon}{label}
    </button>
  );
}

function ConfirmDialog({
  title, body, confirmLabel, busy, onCancel, onConfirm,
}: {
  title: string; body: string; confirmLabel: string; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-[400px] rounded-[22px] bg-[var(--color-brand-card)] p-6">
        <h3 className="text-[18px] font-bold font-serif italic">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">{body}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} disabled={busy}
                  className="flex-1 rounded-full border-[1.5px] border-[var(--color-brand-border)] py-3 text-[15px] font-bold">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
                  className="flex-1 rounded-full bg-[var(--color-brand-error)] text-white py-3 text-[15px] font-bold disabled:opacity-60">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "preferredDate" reads as "Preferred date" rather than as a variable. */
function humanise(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function renderValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
