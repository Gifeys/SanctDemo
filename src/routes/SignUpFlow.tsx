import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Loader2, Mail, Search, ShieldCheck } from "lucide-react";
import { signUp, resendVerificationEmail, refreshEmailVerified, AuthError } from "../lib/authFlow";
import { listChurches } from "../lib/churches";
import type { Church } from "../types";

/**
 * Account creation, as three steps rather than one long form.
 *
 * ## Why it is split
 *
 * The fields belong to three different decisions - who you are, which
 * parish you belong to, and proving the address works - and a parish list
 * of thirty-one entries sitting underneath a password field makes the whole
 * thing read as paperwork. Split, each screen asks one question and the
 * progress bar says how much is left.
 *
 * ## Why the church is chosen before the account exists
 *
 * churchId is written with the profile at creation, and the rules refuse to
 * let an account change it afterwards. Asking later would mean either a
 * profile with no parish - which cannot submit anything, since every
 * application takes its church from the profile - or a second write the
 * rules would reject.
 *
 * ## Why email verification is a step and not a footnote
 *
 * The account is already created by the time this screen appears; the
 * person can close the tab and sign in later. The step exists because a
 * verification email that arrives with no explanation is indistinguishable
 * from spam, and because the second factor at login is a link to this same
 * address - so an address nobody can read locks the account.
 */

type Step = 1 | 2 | 3;

export default function SignUpFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Step 2
  const [churches, setChurches] = useState<Church[]>([]);
  const [churchQuery, setChurchQuery] = useState("");
  const [churchId, setChurchId] = useState("");

  // Step 3
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    void listChurches().then(setChurches);
  }, []);

  const filteredChurches = useMemo(() => {
    const q = churchQuery.trim().toLowerCase();
    if (!q) return churches;
    return churches.filter(c =>
      c.name.toLowerCase().includes(q) || (c.location ?? "").toLowerCase().includes(q));
  }, [churches, churchQuery]);

  function validateStepOne(): string | null {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!email.trim()) return "Please enter your email address.";
    if (password.length < 6) return "Please choose a password of at least 6 characters.";
    if (password !== confirm) return "The two passwords do not match.";
    // Loose on purpose. A number the parish can ring is the goal, and a
    // strict pattern mostly catches people writing a real number in a
    // format the regex did not expect.
    if (phoneNumber.trim() && phoneNumber.replace(/\D/g, "").length < 7) {
      return "That phone number looks too short.";
    }
    return null;
  }

  async function createAccount() {
    setError(null);
    setBusy(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        churchId,
        phoneNumber: phoneNumber.trim() || undefined,
        nickname: nickname.trim() || undefined,
      });
      setStep(3);
      setNotice("We've sent you a verification email.");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function checkVerified() {
    setBusy(true);
    setError(null);
    const ok = await refreshEmailVerified();
    setVerified(ok);
    if (!ok) setNotice("Not verified yet. Open the email and tap the link, then check again.");
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex flex-col items-center px-5 py-8">
      <div className="w-full max-w-[460px]">

        <button
          type="button"
          onClick={() => (step === 1 ? navigate("/") : setStep((step - 1) as Step))}
          className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-brand-primary)] mb-5"
          // Step 3 is past the point of no return: the account exists.
          disabled={step === 3}
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 1 ? "Back to SanctiWalk" : "Back"}
        </button>

        <h1 className="text-[27px] leading-tight font-bold font-serif italic text-[var(--color-brand-text)]">
          Create your account
        </h1>
        <p className="mt-1 text-[15px] text-[var(--color-brand-secondary)]">
          Step {step} of 3 — {step === 1 ? "your details" : step === 2 ? "your parish" : "verify your email"}
        </p>

        {/* Three segments rather than a percentage: the person can see how
            many screens are left, which a bar alone does not tell them. */}
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map(n => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                n <= step ? "bg-[var(--color-brand-primary)]" : "bg-[var(--color-brand-border)]"
              }`}
            />
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        {step === 1 && (
          <form
            className="mt-6 space-y-4"
            onSubmit={e => {
              e.preventDefault();
              const problem = validateStepOne();
              if (problem) { setError(problem); return; }
              setError(null);
              setStep(2);
            }}
          >
            <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" required
                   hint="As the parish office should record it on your applications." />
            <Field label="Nickname" value={nickname} onChange={setNickname} autoComplete="nickname"
                   hint="What the app calls you on your home screen. Leave it blank to use your first name." />
            <Field label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field
              label="Phone number"
              type="tel"
              value={phoneNumber}
              onChange={setPhoneNumber}
              autoComplete="tel"
              hint="So the parish can reach you. Include the country code, for example +63 912 345 6789."
            />
            <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required
                   hint="At least 6 characters." />
            <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />

            <button type="submit" className="w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3.5 font-bold text-[16px]">
              Continue
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="mt-6">
            <label className="block text-[14px] font-bold text-[var(--color-brand-text)] mb-1.5">
              Which parish do you belong to?
            </label>
            <p className="text-[14px] text-[var(--color-brand-secondary)] mb-3">
              Your applications go to this parish's office. It cannot be changed afterwards,
              so pick the one you actually attend.
            </p>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-brand-secondary)]" />
              <input
                value={churchQuery}
                onChange={e => setChurchQuery(e.target.value)}
                placeholder="Search parishes"
                aria-label="Search parishes"
                className="w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] pl-10 pr-4 py-3 text-[15px]"
              />
            </div>

            <div className="mt-3 max-h-[46vh] overflow-y-auto rounded-2xl border border-[var(--color-brand-border)] divide-y divide-[var(--color-brand-border)]">
              {filteredChurches.length === 0 && (
                <p className="px-4 py-6 text-center text-[15px] text-[var(--color-brand-secondary)]">
                  No parish matches "{churchQuery}".
                </p>
              )}
              {filteredChurches.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChurchId(c.id)}
                  aria-pressed={churchId === c.id}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 ${
                    churchId === c.id ? "bg-[var(--color-brand-card-sunk)]" : "bg-[var(--color-brand-card)]"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-[var(--color-brand-text)] truncate">{c.name}</span>
                    {c.location && (
                      <span className="block text-[13px] text-[var(--color-brand-secondary)] truncate">{c.location}</span>
                    )}
                  </span>
                  {/* A tick, not just a highlight: colour alone is not a
                      status anyone can rely on. */}
                  {churchId === c.id && <Check className="w-5 h-5 shrink-0 text-[var(--color-brand-primary)]" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!churchId || busy}
              onClick={createAccount}
              className="mt-5 w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3.5 font-bold text-[16px] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</>) : "Create account"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-6 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-card-sunk)] text-[var(--color-brand-primary)]">
              {verified ? <ShieldCheck className="w-7 h-7" /> : <Mail className="w-7 h-7" />}
            </span>

            <h2 className="text-[19px] font-bold font-serif italic text-[var(--color-brand-text)]">
              {verified ? "Your email is verified" : "Check your email"}
            </h2>

            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
              {verified
                ? "You're all set. You can sign in now."
                : <>We sent a link to <strong>{email}</strong>. Open it to confirm this address is yours.</>}
            </p>

            {!verified && (
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
                This matters more than usual here: signing in sends a one-time link to this
                same address as your second security step, so it has to be an inbox you can reach.
              </p>
            )}

            {notice && !verified && (
              <p className="mt-3 text-[14px] text-[var(--color-brand-secondary)]">{notice}</p>
            )}

            <div className="mt-5 space-y-2.5">
              {!verified && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={checkVerified}
                    className="w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} I've verified — check again
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await resendVerificationEmail();
                        setNotice("Sent again. It can take a minute to arrive.");
                      } catch (err) {
                        setError(err instanceof AuthError ? err.message : "Could not resend just now.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="w-full rounded-full border-[1.5px] border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] py-3 font-bold text-[15px] disabled:opacity-50"
                  >
                    Resend the email
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => navigate("/")}
                className={verified
                  ? "w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 font-bold text-[15px]"
                  : "w-full py-3 text-[15px] font-semibold text-[var(--color-brand-secondary)]"}
              >
                {verified ? "Go to SanctiWalk" : "I'll verify later"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", hint, required, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-bold text-[var(--color-brand-text)] mb-1.5">
        {label}{!required && <span className="font-normal text-[var(--color-brand-secondary)]"> (optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 text-[15px] text-[var(--color-brand-text)]"
      />
      {hint && <p className="mt-1.5 text-[13px] text-[var(--color-brand-secondary)]">{hint}</p>}
    </div>
  );
}
