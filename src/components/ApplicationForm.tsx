import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Loader2 } from "lucide-react";
import {
  ministrySteps, sacramentSteps, reviewRows, toFormData, validateStep,
  type Answers, type Field, type Step,
} from "../lib/applicationForm";
import { submitApplication, SubmitError } from "../lib/applications";

/**
 * Applying, on a screen of its own.
 *
 * ## Why this is not a form under the description
 *
 * It was, for both ministries and sacraments, and for sacraments it was
 * worse than that - Apply scrolled you to a form at the bottom of the
 * page that asked, again, which sacrament you wanted. Reading about
 * something and applying for it are two different jobs, and a page that
 * does both makes the second one feel like a footnote to the first.
 *
 * Taking over the screen also gives the form somewhere to put its steps,
 * its validation and its review, none of which fit underneath a
 * description without burying the thing you were reading.
 *
 * ## Why a review step
 *
 * The parish acts on what is submitted, and an applicant cannot edit it
 * afterwards - the rules forbid it, on purpose. So the last chance to
 * catch a mistyped number has to be here.
 */
export default function ApplicationForm({
  kind,
  itemId,
  itemName,
  parishName,
  defaults,
  onClose,
  onSubmitted,
}: {
  kind: "ministry" | "sacrament";
  itemId: string;
  itemName: string;
  parishName: string;
  /** From the signed-in account, so nobody retypes what the app knows. */
  defaults?: { fullName?: string; email?: string; mobile?: string };
  onClose: () => void;
  /** Lets the host tab refresh its own list. */
  onSubmitted?: () => void;
}) {
  const steps = useMemo(
    () => (kind === "ministry" ? ministrySteps(itemId, itemName) : sacramentSteps(itemName)),
    [kind, itemId, itemName],
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => ({
    fullName: defaults?.fullName ?? "",
    mobile: defaults?.mobile ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Each step starts at the top. Without this, step three opens scrolled
  // to wherever step two's last field was.
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [index]);

  const reviewing = index === steps.length;
  const step = steps[index];

  function set(name: string, value: string | string[] | boolean) {
    setAnswers(a => ({ ...a, [name]: value }));
    // Clearing as they fix it, rather than making them press Continue
    // again to find out whether they have.
    setErrors(e => (e[name] ? { ...e, [name]: "" } : e));
  }

  function next() {
    if (!step) return;
    const found = validateStep(step, answers);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setIndex(i => i + 1);
  }

  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      const saved = await submitApplication({
        kind,
        itemId,
        type: itemName,
        applicantName: String(answers.fullName ?? "").trim(),
        formData: {
          ...toFormData(steps, answers),
          // Kept alongside the answers, as the old forms did, so the
          // parish's export and detail view keep reading what they read.
          [kind === "ministry" ? "ministryId" : "sacramentId"]: itemId,
          [kind === "ministry" ? "ministryName" : "sacramentName"]: itemName,
          parishName,
        },
      });
      setReference(saved.referenceNumber);
      onSubmitted?.();
    } catch (err) {
      setFailed(
        err instanceof SubmitError
          ? err.message
          : "That could not be sent. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return <Submitted reference={reference} itemName={itemName} parishName={parishName} onClose={onClose} />;
  }

  return (
    <div className="apply-screen">
      <header className="apply-screen__bar">
        <button
          type="button"
          onClick={() => (index === 0 ? onClose() : setIndex(i => i - 1))}
          className="apply-screen__back"
        >
          <ArrowLeft className="w-4 h-4" />
          {index === 0 ? "Back" : "Previous"}
        </button>
        <p className="apply-screen__count">
          {reviewing ? "Review" : `Step ${index + 1} of ${steps.length + 1}`}
        </p>
      </header>

      <div className="apply-screen__body">
        <p className="apply-screen__eyebrow">
          {kind === "ministry" ? "Ministry application" : "Sacrament application"}
        </p>
        <h1 className="apply-screen__title">{itemName}</h1>
        <p className="apply-screen__parish">{parishName}</p>

        {/* A bar, not a number alone. Four steps is short, but not
            knowing whether it is four or fourteen is what makes people
            abandon a form on the first screen. */}
        <div className="apply-progress" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={`apply-progress__seg${i <= index ? " is-done" : ""}`} />
          ))}
          <span className={`apply-progress__seg${reviewing ? " is-done" : ""}`} />
        </div>

        {reviewing ? (
          <Review
            steps={steps}
            answers={answers}
            busy={busy}
            failed={failed}
            onEdit={() => setIndex(0)}
            onSubmit={() => void submit()}
          />
        ) : (
          <>
            <h2 className="apply-step__title">{step!.title}</h2>
            {step!.blurb && <p className="apply-step__blurb">{step!.blurb}</p>}

            <div className="mt-4 space-y-5">
              {step!.fields.map(field => (
                <FieldInput
                  key={field.name}
                  field={field}
                  value={answers[field.name]}
                  error={errors[field.name]}
                  onChange={v => set(field.name, v)}
                />
              ))}
            </div>

            <button type="button" onClick={next} className="apply-primary mt-7">
              {index === steps.length - 1 ? "Review your application" : "Continue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  field, value, error, onChange,
}: {
  field: Field;
  value: string | string[] | boolean | undefined;
  error?: string;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const id = `f-${field.name}`;
  const described = [field.help ? `${id}-help` : null, error ? `${id}-err` : null]
    .filter(Boolean).join(" ") || undefined;

  if (field.kind === "confirm") {
    return (
      <div>
        <label className="flex items-start gap-3 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
          <input
            type="checkbox"
            checked={value === true}
            aria-describedby={described}
            onChange={e => onChange(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--color-brand-primary)]"
          />
          <span>{field.label}</span>
        </label>
        {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
      </div>
    );
  }

  if (field.kind === "choices") {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="apply-label">
          {field.label}
          {!field.required && <span className="apply-optional"> — optional</span>}
        </legend>
        {field.help && <p id={`${id}-help`} className="apply-help">{field.help}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {(field.options ?? []).map(option => {
            const on = chosen.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? chosen.filter(c => c !== option) : [...chosen, option])
                }
                className={`apply-chip${on ? " is-on" : ""}`}
              >
                {on && <Check className="w-3.5 h-3.5" />}
                {option}
              </button>
            );
          })}
        </div>
        {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
      </fieldset>
    );
  }

  const common = {
    id,
    value: typeof value === "string" ? value : "",
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    "aria-describedby": described,
    "aria-invalid": error ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    className: `apply-input${error ? " is-bad" : ""}`,
  };

  return (
    <div>
      <label htmlFor={id} className="apply-label">
        {field.label}
        {!field.required && <span className="apply-optional"> — optional</span>}
      </label>
      {field.help && <p id={`${id}-help`} className="apply-help">{field.help}</p>}
      {field.kind === "textarea"
        ? <textarea {...common} rows={4} />
        : <input {...common} type={field.kind === "tel" ? "tel" : field.kind === "date" ? "date" : "text"} />}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-[14px] font-semibold text-[var(--color-brand-error)]">
      {children}
    </p>
  );
}

function Review({
  steps, answers, busy, failed, onEdit, onSubmit,
}: {
  steps: Step[];
  answers: Answers;
  busy: boolean;
  failed: string | null;
  onEdit: () => void;
  onSubmit: () => void;
}) {
  const rows = reviewRows(steps, answers);
  return (
    <>
      <h2 className="apply-step__title">Check this over</h2>
      <p className="apply-step__blurb">
        Once it is sent you cannot change it yourself — the parish is working from
        it. Ring the office if something needs correcting.
      </p>

      {failed && (
        <p role="alert" className="mt-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
          {failed}
        </p>
      )}

      <dl className="mt-4 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] divide-y divide-[var(--color-brand-border)]">
        {rows.map(row => (
          <div key={row.label} className="px-4 py-3">
            <dt className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
              {row.label}
            </dt>
            <dd className="mt-0.5 text-[16px] leading-relaxed text-[var(--color-brand-text)] break-words">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <button type="button" onClick={onSubmit} disabled={busy} className="apply-primary mt-6">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {busy ? "Sending…" : "Submit application"}
      </button>
      <button type="button" onClick={onEdit} disabled={busy} className="apply-secondary mt-2.5">
        Change something
      </button>
    </>
  );
}

function Submitted({
  reference, itemName, parishName, onClose,
}: { reference: string; itemName: string; parishName: string; onClose: () => void }) {
  return (
    <div className="apply-screen">
      <div className="apply-screen__body text-center">
        <CheckCircle2 className="mx-auto w-14 h-14 text-[var(--color-brand-success)]" />
        <h1 className="mt-3 text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          Application sent
        </h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[var(--color-brand-text)]">
          Your application for <strong>{itemName}</strong> is with {parishName}.
        </p>

        <div className="mt-5 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-5">
          <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
            Your reference
          </p>
          {/* Big and monospaced because its job is to be read down a
              telephone to a parish secretary. */}
          <p className="mt-1 font-mono text-[22px] font-bold tracking-wide text-[var(--color-brand-text)]">
            {reference}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
            Status: <strong className="text-[var(--color-brand-text)]">Pending</strong>. You
            will be told here when the parish has looked at it — it is under
            My Applications on the Me tab.
          </p>
        </div>

        <button type="button" onClick={onClose} className="apply-primary mt-6">
          Done
        </button>
      </div>
    </div>
  );
}
