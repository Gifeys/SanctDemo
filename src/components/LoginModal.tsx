import React, { useRef, useState } from "react";
import { ShieldAlert, CheckCircle, ShieldCheck, UserPlus } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Label above the box, which is how the reference layout does it: the
// caption sits on its own line in muted type and the field below carries
// nothing but the value. It replaces a label punched through the field's
// top border - that notch is fussy at this size, and it put the caption
// and its field on the same visual line, so a column of three of them
// read as one block rather than three labelled things.
function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-1.5 text-[14px] font-semibold text-[var(--color-brand-text)]"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] rounded-xl px-4 py-3.5 text-[16px] text-[var(--color-brand-text)] placeholder:text-[var(--color-brand-secondary)]/70 outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-brand-card)]"
      />
    </div>
  );
}

interface LoginModalProps {
  onLoginSuccess: (email: string, isAdmin: boolean) => void;
  onLogout: () => void;
  isLoggedIn: boolean;
  userEmail: string;
  isAdmin: boolean;
}

export default function LoginModal({ onLoginSuccess, onLogout, isLoggedIn, userEmail, isAdmin }: LoginModalProps) {
  const [activeMode, setActiveMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Switching mode adds or removes a field, so the form changes height
  // under a button that has just taken focus - and the browser then
  // scrolls to keep that button in view, which pushed the emblem and the
  // heading off the top of the screen. Switching forms should show the top
  // of the new one.
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Checked: the session survives closing the app. Unchecked: it ends with
  // it. This is Firebase's own persistence setting, not a stored password.
  const [rememberMe, setRememberMe] = useState(true);

  const handleForgotPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!email) {
      setErrorMsg("Enter your e-mail above first, and we will send a reset link to it.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      // Deliberately the same message whether or not the address is
      // registered: saying "no such account" would tell anyone who asks
      // which e-mails have accounts here.
      setSuccessMsg(`If ${email} has an account, a password reset link is on its way.`);
    } catch (error: any) {
      console.error("Password reset error:", error);
      setErrorMsg(
        error?.code === "auth/invalid-email"
          ? "Please enter a valid e-mail address."
          : "Could not send the reset e-mail. Please try again.",
      );
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please fill out all fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      // Set before signing in, so the very first session honours the choice.
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      if (activeMode === "signup") {
        if (!fullName) {
          setErrorMsg("Please enter your full name.");
          setIsLoading(false);
          return;
        }

        // 1. Create firebase auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Create profile document in Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          fullName: fullName,
          points: 120,
          steps: 640,
          completedStations: [],
          badges: [],
          createdAt: new Date().toISOString()
        });

        setSuccessMsg("Profile registered successfully! Logging you in...");
        // Admin status comes from the "admins" collection (one document per
        // uid, granted only from the Firebase console) — never from the
        // email address, which the person creating the account controls.
        const signupAdminSnap = await getDoc(doc(db, "admins", user.uid));
        const signupIsAdmin = signupAdminSnap.exists();
        setTimeout(() => {
          onLoginSuccess(email, signupIsAdmin);
          setIsLoading(false);
        }, 1500);

      } else {
        // Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Load profile from Firestore if it exists
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          // If no profile, initialize one
          await setDoc(docRef, {
            uid: user.uid,
            email: user.email,
            fullName: email.split("@")[0],
            points: 120,
            steps: 640,
            completedStations: [],
            badges: [],
            createdAt: new Date().toISOString()
          });
        }

        // Admin status comes from the "admins" collection (one document per
        // uid, granted only from the Firebase console) — never from the
        // email address.
        const signinAdminSnap = await getDoc(doc(db, "admins", user.uid));
        const signinIsAdmin = signinAdminSnap.exists();
        setSuccessMsg(`Welcome back, ${signinIsAdmin ? "Parish Administrator" : "Faithful Pilgrim"}!`);
        setTimeout(() => {
          onLoginSuccess(email, signinIsAdmin);
          setIsLoading(false);
        }, 1500);
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      let friendlyMessage = "Authentication failed. Please check your credentials.";
      if (error.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already registered. Please Sign In instead.";
      } else if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        friendlyMessage = "Invalid email or password. Please try again.";
      } else if (error.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid e-mail address.";
      } else if (error.code === "auth/configuration-not-found") {
        // Nothing the person can do about this one, and "check your
        // credentials" blamed them for it. It means e-mail/password
        // sign-in has not been switched on in the Firebase console.
        friendlyMessage =
          "Sign-in is not switched on for this parish app yet. This is a setting on our side, not a problem with your details.";
      } else if (error.code === "auth/network-request-failed") {
        friendlyMessage = "No connection. Check your internet and try again.";
      } else if (error.code === "auth/too-many-requests") {
        friendlyMessage = "Too many attempts. Please wait a moment and try again.";
      }
      setErrorMsg(friendlyMessage);
      setIsLoading(false);
    }
  };

  // Signed in: the account summary, unchanged in substance.
  if (isLoggedIn) {
    return (
      <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
        <div className="px-6 pt-6 pb-10 max-w-[420px] w-full mx-auto space-y-6">
          <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-6 text-center space-y-5 shadow-xs">
            <div className="h-16 w-16 bg-[var(--color-brand-primary)]/10 rounded-full flex items-center justify-center mx-auto text-[var(--color-brand-primary)]">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--color-brand-text)] uppercase tracking-wider">
                Signed in
              </h3>
              <p className="text-[15px] text-[var(--color-brand-secondary)]">
                You are signed in as
              </p>
              <span className="inline-block text-[15px] font-mono font-bold text-[var(--color-brand-text)] bg-[var(--color-brand-card-sunk)] px-4 py-1.5 rounded-full border border-[var(--color-brand-border)] mt-2 break-all">
                {userEmail}
              </span>
            </div>

            {isAdmin && (
              <div className="p-4 bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] rounded-2xl text-[15px] leading-relaxed text-left space-y-1.5">
                <span className="font-bold block uppercase tracking-wider text-sm">Admin Privilege Unlocked</span>
                <p className="text-[15px] text-[var(--color-brand-secondary)]">
                  You now have authorization to edit parish history details, add or remove parish bulletin
                  announcements, and moderate pilgrim logs in the <strong>Admin Portal</strong>.
                </p>
              </div>
            )}

            <button
              onClick={onLogout}
              className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 active:scale-98 transition-all text-[15px] font-bold uppercase tracking-wider rounded-full border border-red-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const signingUp = activeMode === "signup";

  return (
    <div
      ref={scrollRef}
      className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto"
    >
      <div className="px-6 pt-4 pb-10 max-w-[420px] w-full mx-auto">
        {/* Emblem, then a short heading, then one line under it - the
            order the reference layout uses. The emblem is the diocese
            crest rather than a padlock or a shield: this is the way into
            one particular diocese's app, and its own mark says that,
            where a generic security glyph would only say "a form". */}
        <header className="text-center pt-6 pb-7">
          <div className="mx-auto mb-5 h-[72px] w-[72px] rounded-full bg-[var(--color-brand-primary)]/8 border border-[var(--color-brand-border)] grid place-items-center">
            {signingUp ? (
              <UserPlus className="w-8 h-8 text-[var(--color-brand-primary)]" />
            ) : (
              <img
                src="/ui/diocese-crest.png"
                alt=""
                className="w-10 h-10 object-contain"
              />
            )}
          </div>

          <h2 className="text-[30px] leading-[1.15] font-extrabold tracking-tight text-[var(--color-brand-text)]">
            {signingUp ? "Create account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-[15px] text-[var(--color-brand-secondary)]">
            {signingUp
              ? "Set up your pilgrim profile to get started."
              : "Sign in to continue to your parish."}
          </p>
        </header>

        <form onSubmit={handleAuth} className="space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-2 text-[15px]">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-start gap-2 text-[15px]">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {signingUp && (
            <Field
              label="Full name"
              type="text"
              value={fullName}
              onChange={setFullName}
              placeholder="Juan dela Cruz"
              autoComplete="name"
            />
          )}

          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="example@email.com"
            autoComplete="email"
          />

          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Your Password"
            autoComplete={signingUp ? "new-password" : "current-password"}
          />

          <div className="flex items-center justify-between gap-3 text-[15px]">
            <label className="flex items-center gap-2 text-[var(--color-brand-secondary)] select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-brand-primary)]"
              />
              <span>Remember me</span>
            </label>

            {!signingUp && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-primary)] transition-colors"
              >
                Forgot Password?
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] disabled:opacity-60 text-white text-[16px] font-bold rounded-full transition-colors active:scale-[0.99]"
          >
            {isLoading ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
          </button>
        </form>

        {/* "Or", then a full-width outlined alternative - the reference
            layout's own pattern for a second way in.

            In the reference that slot holds Google, Apple and Facebook.
            Those need providers enabled and configured in Firebase and
            none are, so buttons there would be three things that look
            tappable and do nothing. What genuinely exists is the other
            mode, so that is what the slot carries. */}
        <div className="flex items-center gap-3 my-6">
          <span className="h-px flex-1 bg-[var(--color-brand-border)]" />
          <span className="text-[14px] text-[var(--color-brand-secondary)]">Or</span>
          <span className="h-px flex-1 bg-[var(--color-brand-border)]" />
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveMode(signingUp ? "signin" : "signup");
            setErrorMsg("");
            setSuccessMsg("");
            scrollRef.current?.scrollTo({ top: 0 });
          }}
          className="w-full py-3.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-full text-[15px] font-semibold text-[var(--color-brand-text)] hover:border-[var(--color-brand-primary)] transition-colors"
        >
          {signingUp ? "Sign in to an existing account" : "Create a new account"}
        </button>

        <p className="mt-6 text-[14px] leading-relaxed text-[var(--color-brand-secondary)] text-center">
          Admin access to the parish office portal is granted by parish staff and
          cannot be self-assigned.
        </p>
      </div>
    </div>
  );
}
