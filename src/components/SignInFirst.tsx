import { ArrowLeft, LogIn } from "lucide-react";

/**
 * The wall in front of an application for someone who is not signed in.
 *
 * ## Why a screen and not a line of red text
 *
 * The security rules refuse an application that carries no uid, and My
 * Applications has nowhere to show one either. So this is not a
 * validation failure to be reported under a field - it is a thing that
 * has to happen first, and it deserves the same screen the form would
 * have had.
 *
 * It says why, too. "Please sign in" with no reason reads as the app
 * collecting accounts; the real reason is that the parish replies to
 * you, and you need somewhere to read the reply.
 */
export default function SignInFirst({
  what,
  onSignIn,
  onBack,
}: {
  /** The ministry or sacrament they were trying to apply for. */
  what: string;
  onSignIn: () => void;
  onBack: () => void;
}) {
  return (
    <div className="apply-screen">
      <header className="apply-screen__bar">
        <button type="button" onClick={onBack} className="apply-screen__back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </header>

      <div className="apply-screen__body">
        <h1 className="apply-screen__title">Sign in to apply</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-brand-text)]">
          Applying for <strong>{what}</strong> needs an account, for two reasons: the
          parish replies to you by email, and your application appears under
          <strong> My Applications</strong> so you can follow what happens to it.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          It takes a moment, and everything you have read so far stays where it is.
        </p>

        <button type="button" onClick={onSignIn} className="apply-primary mt-6">
          <LogIn className="w-4 h-4" /> Sign in
        </button>
      </div>
    </div>
  );
}
