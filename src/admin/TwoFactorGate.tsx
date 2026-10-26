import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { requestCode, submitCode } from "../lib/adminTwoFactor";
import { signOutNow } from "../lib/authFlow";

/**
 * The code step, as a gate rather than a screen.
 *
 * ## Why this is not in AdminLogin
 *
 * It was, and it stopped nobody. signInWithEmailAndPassword signs the
 * account in to Firebase the moment the password is right;
 * onAuthStateChanged in AdminApp then fires, sets its state to "in",
 * and REPLACES the login component - code prompt and all. The second
 * factor was a screen the portal navigated straight past.
 *
 * So it lives where the decision is made. AdminApp will not render the
 * portal until the token carries proof, and this is what obtains it.
 *
 * ## What counts as proof
 *
 * A custom claim, `admin2fa`, holding the second the code was
 * accepted. The server sets it; a browser cannot. AdminApp requires it
 * to be NEWER than this sign-in, so a fresh password entry always
 * needs a fresh code - a claim from last week does not let somebody
 * who has just stolen a password walk in.
 */
export default function TwoFactorGate({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Asked for once, as soon as the gate appears. The person has
  // already given a correct password; making them press another
  // button before anything is sent only adds a step.
  useEffect(() => {
    let live = true;
    void (async () => {
      const asked = await requestCode();
      if (!live) return;
      if (asked.ok) setSentTo(asked.sentTo ?? null);
      else setError(asked.message ?? "That code could not be sent.");
    })();
    return () => { live = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex items-center justify-center px-5">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-6 text-center">
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
          className="mt-4"
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
            // submitCode refreshed the token, so the claim is present
            // now. A reload sends AdminApp through its gate again,
            // which this time lets it past.
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

        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const again = await requestCode();
              setBusy(false);
              if (again.ok) setNotice("A new code is on its way.");
              else setError(again.message ?? "Could not send another code.");
            }}
            className="text-[14px] font-semibold text-[var(--color-brand-secondary)]"
          >
            Send another code
          </button>
          <button
            type="button"
            onClick={() => void signOutNow()}
            className="text-[14px] font-semibold text-[var(--color-brand-secondary)]"
          >
            Sign out
          </button>
        </div>

        {notice && (
          <p className="mt-2 text-[14px] text-[var(--color-brand-secondary)]">{notice}</p>
        )}

        <p className="mt-3 text-[14px] text-[var(--color-brand-secondary)]">
          Your password alone does not open the parish office. The code lasts ten
          minutes and can be used once.
        </p>
      </div>
    </div>
  );
}
