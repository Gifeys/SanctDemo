import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { completeSecondFactor, isSecondFactorLink, AuthError } from "../lib/authFlow";
import { getProfile } from "../lib/userProfile";

/**
 * Where the second-factor email link lands.
 *
 * Firebase needs the address back to complete the link. On the device that
 * asked for it that came from localStorage, so this screen usually finishes
 * on its own and the person just sees it land. The form only appears when
 * the link is opened somewhere else - a desktop inbox, say, after
 * requesting it on a phone - which is the one case localStorage cannot
 * cover.
 *
 * Asking for the address in that case is not a weakness: holding the link
 * and knowing the address it was sent to is the factor.
 */
export default function FinishSignIn() {
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "need-email" | "done" | "failed">("working");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function finish(withEmail?: string) {
    setState("working");
    setError(null);
    try {
      const user = await completeSecondFactor(withEmail);
      const profile = await getProfile(user.uid);
      setState("done");
      // An admin's own destination is the parish office, not the pilgrim
      // app - they signed in to review applications.
      navigate(profile?.role === "church_admin" ? "/admin" : "/", { replace: true });
    } catch (err) {
      const message = err instanceof AuthError ? err.message : "That link could not be used.";
      // The one recoverable failure: we simply do not know the address.
      if (message.startsWith("Please enter the email")) {
        setState("need-email");
      } else {
        setError(message);
        setState("failed");
      }
    }
  }

  useEffect(() => {
    if (!isSecondFactorLink()) {
      setError("This page is for finishing a sign-in link. There is nothing to finish here.");
      setState("failed");
      return;
    }
    void finish();
    // Runs once, for the link in the address bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex items-center justify-center px-5">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-6 text-center">

        {state === "working" && (
          <>
            <Loader2 className="mx-auto w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
            <h1 className="mt-3 text-[19px] font-bold font-serif italic">Signing you in…</h1>
            <p className="mt-1 text-[15px] text-[var(--color-brand-secondary)]">One moment.</p>
          </>
        )}

        {state === "done" && (
          <>
            <ShieldCheck className="mx-auto w-8 h-8 text-[var(--color-brand-success)]" />
            <h1 className="mt-3 text-[19px] font-bold font-serif italic">You're signed in</h1>
          </>
        )}

        {state === "need-email" && (
          <form
            onSubmit={e => { e.preventDefault(); void finish(email.trim()); }}
            className="text-left"
          >
            <h1 className="text-[19px] font-bold font-serif italic text-center">Confirm your email</h1>
            <p className="mt-2 mb-4 text-[15px] leading-relaxed text-[var(--color-brand-secondary)] text-center">
              You opened this link on a different device. Enter the address you signed in with
              and we'll finish.
            </p>
            <label htmlFor="fe" className="block text-[14px] font-bold mb-1.5">Email address</label>
            <input
              id="fe"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-brand-border)] px-4 py-3 text-[15px]"
            />
            <button type="submit" className="mt-4 w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 font-bold text-[15px]">
              Finish signing in
            </button>
          </form>
        )}

        {state === "failed" && (
          <>
            <ShieldAlert className="mx-auto w-8 h-8 text-[var(--color-brand-error)]" />
            <h1 className="mt-3 text-[19px] font-bold font-serif italic">We couldn't finish</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">{error}</p>
            <p className="mt-2 text-[14px] text-[var(--color-brand-secondary)]">
              Sign-in links can only be used once, and expire. Start again and we'll send a new one.
            </p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="mt-5 w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 font-bold text-[15px]"
            >
              Back to SanctiWalk
            </button>
          </>
        )}
      </div>
    </div>
  );
}
