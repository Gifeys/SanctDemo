import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { signIn, AuthError } from "../lib/authFlow";
import { requestCode, submitCode } from "../lib/adminTwoFactor";

/**
 * Parish office sign-in.
 *
 * Administrators always take the second factor, whatever their email
 * verification state: they can change other people's records, so their
 * password on its own is worth more than a pilgrim's. signIn() decides
 * that, not this screen - a login form that chose its own security level
 * would be a login form an attacker could ask nicely.
 */
export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(email.trim(), password);
      if (result.pendingSecondFactor) {
        // A six-digit code by email, not a link. A link moves the
        // person out of the browser they are typing in, and on a
        // shared parish computer it sits in an inbox anybody can open
        // later. A code is read, typed, and spent.
        const asked = await requestCode();
        if (!asked.ok) {
          setError(asked.message ?? "That code could not be sent.");
          return;
        }
        setSentTo(asked.sentTo ?? null);
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <ShieldCheck className="mx-auto w-8 h-8 text-[var(--color-brand-primary)]" />
        <h1 className="mt-3 text-[19px] font-bold font-serif italic">Enter your code</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
          We emailed a six-digit code to <strong>{sentTo ?? email}</strong>.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-left text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        <form
          className="mt-4 text-left"
          onSubmit={async e => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const result = await submitCode(code.trim());
            setBusy(false);
            if (!result.ok) {
              setError(result.message ?? "That code is not right.");
              setCode("");
              return;
            }
            // The token now carries the claim; AdminApp re-reads it.
            window.location.reload();
          }}
        >
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            aria-label="Six-digit code"
            placeholder="000000"
            className="w-full rounded-xl border border-[var(--color-brand-border)] px-4 py-3 text-center text-[26px] font-bold tracking-[0.4em] tabular-nums"
          />

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="mt-3 w-full rounded-full bg-[var(--color-brand-primary)] py-3 text-[16px] font-bold text-[var(--color-brand-on-accent)] disabled:opacity-50"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const again = await requestCode();
            setBusy(false);
            if (!again.ok) setError(again.message ?? "Could not send another code.");
            else setNotice("A new code is on its way.");
          }}
          className="mt-3 text-[14px] font-semibold text-[var(--color-brand-secondary)]"
        >
          Send another code
        </button>

        {notice && (
          <p className="mt-2 text-[14px] text-[var(--color-brand-secondary)]">{notice}</p>
        )}

        <p className="mt-3 text-[14px] text-[var(--color-brand-secondary)]">
          Your password alone does not open the parish office. The code lasts ten
          minutes and can be used once.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-[22px] font-bold font-serif italic text-[var(--color-brand-text)]">Parish office</h1>
      <p className="mt-1 mb-5 text-[15px] text-[var(--color-brand-secondary)]">
        Sign in to review your parish's applications.
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-left text-[15px] text-[var(--color-brand-error)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 text-[14px] text-[var(--color-brand-secondary)]">{notice}</p>
      )}

      <form onSubmit={submit} className="text-left space-y-3.5">
        <div>
          <label htmlFor="ae" className="block text-[14px] font-bold mb-1.5">Email address</label>
          <input id="ae" type="email" required autoComplete="email" value={email}
                 onChange={e => setEmail(e.target.value)}
                 className="w-full rounded-2xl border border-[var(--color-brand-border)] px-4 py-3 text-[15px]" />
        </div>
        <div>
          <label htmlFor="ap" className="block text-[14px] font-bold mb-1.5">Password</label>
          <input id="ap" type="password" required autoComplete="current-password" value={password}
                 onChange={e => setPassword(e.target.value)}
                 className="w-full rounded-2xl border border-[var(--color-brand-border)] px-4 py-3 text-[15px]" />
        </div>

        <button type="submit" disabled={busy}
                className="w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : <><Mail className="w-4 h-4" /> Continue</>}
        </button>

        {/* Not a self-service reset.
            A parish office account is handed out by whoever runs
            SanctiWalk for the diocese, and getting back into one is
            their decision rather than something an email link should
            settle. Saying so is also more honest than a button that
            sends a message to an inbox the secretary may not have. */}
        <p className="w-full pt-2 text-[13px] leading-snug text-[var(--color-brand-muted)]">
          Forgot your password? Contact the SanctiWalk administrator to have it
          reset.
        </p>
      </form>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex items-center justify-center px-5">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-6 text-center">
        {children}
      </div>
    </div>
  );
}
