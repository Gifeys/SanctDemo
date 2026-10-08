import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { signIn, sendSecondFactorLink, resetPassword, AuthError } from "../lib/authFlow";

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
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(email.trim(), password);
      if (result.pendingSecondFactor) {
        await sendSecondFactorLink(email.trim());
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
        <h1 className="mt-3 text-[19px] font-bold font-serif italic">One more step</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
          We sent a one-time sign-in link to <strong>{email}</strong>. Open it on this
          device to finish.
        </p>
        <p className="mt-2 text-[14px] text-[var(--color-brand-secondary)]">
          Your password alone does not open the parish office. The link expires and
          can only be used once.
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

        <button
          type="button"
          onClick={async () => {
            if (!email.trim()) { setError("Enter your email address first."); return; }
            await resetPassword(email.trim());
            // Deliberately the same message whether or not the address is
            // registered: anything else is a way to enumerate accounts.
            setNotice("If an account exists for that address, a reset link is on its way.");
          }}
          className="w-full py-2 text-[14px] font-semibold text-[var(--color-brand-secondary)]"
        >
          Forgot your password?
        </button>
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
