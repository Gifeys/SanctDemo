import React, { useState } from "react";
import { Sparkles, KeyRound, Mail, ShieldAlert, CheckCircle, ShieldCheck, User, ArrowRight, UserPlus } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

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
        friendlyMessage = "Please enter a valid email address.";
      }
      setErrorMsg(friendlyMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      {/* Sleek Apple-Style Page Header */}
      <div className="px-6 pt-8 pb-4 shrink-0 text-left">
        <span className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest block font-sans">
          Pilgrim Profile
        </span>
        <h2 className="text-3xl font-black text-[var(--color-brand-text)] tracking-tight mt-0.5 uppercase font-sans">
          {isLoggedIn ? "My Session" : activeMode === "signin" ? "Sign In" : "Register"}
        </h2>
        <p className="text-[15px] text-[var(--color-brand-secondary)] mt-1.5 leading-relaxed font-sans max-w-xs">
          {isLoggedIn
            ? "Manage your active SanctiWalk identity and sync your pilgrimage points securely."
            : "Connect your SanctiWalk profile to log steps, complete catechesis, and collect historical stamp badges."
          }
        </p>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-start">
        {isLoggedIn ? (
          <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-6 text-center space-y-5 shadow-xs">
            <div className="h-16 w-16 bg-[var(--color-brand-primary)]/10 rounded-full flex items-center justify-center mx-auto text-[var(--color-brand-secondary)]">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--color-brand-text)] font-sans uppercase tracking-wider">
                Active Pilgrim Session
              </h3>
              <p className="text-[15px] text-[var(--color-brand-secondary)] font-sans">
                You are currently signed in as:
              </p>
              <span className="inline-block text-[15px] font-mono font-bold text-[var(--color-brand-text)] bg-[var(--color-brand-card)] px-4 py-1.5 rounded-full border border-[var(--color-brand-border)] mt-2">
                {userEmail}
              </span>
            </div>

            {isAdmin && (
              <div className="p-4 bg-[var(--color-brand-card)]/30 border border-[var(--color-brand-border)] text-[var(--color-brand-text)] rounded-2xl text-[15px] leading-relaxed font-sans text-left space-y-1.5">
                <span className="font-bold text-[var(--color-brand-text)] block uppercase tracking-wider text-sm">Admin Privilege Unlocked</span>
                <p className="text-[15px] text-[var(--color-brand-secondary)]">You now have authorization to edit parish history details, add/remove parish bulletin announcements, and moderate pilgrim logs in the <strong>Admin Portal</strong>.</p>
              </div>
            )}

            <button
              onClick={onLogout}
              className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 active:scale-98 transition-all text-[15px] font-bold uppercase tracking-wider rounded-full border border-red-200"
            >
              Log Out pilgrim profile
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sliding Tab Control */}
            <div className="bg-[var(--color-brand-card)] p-1 rounded-2xl flex items-center">
              <button
                onClick={() => { setActiveMode("signin"); setErrorMsg(""); setSuccessMsg(""); }}
                className={`flex-1 py-2 text-[15px] font-bold rounded-xl transition-all uppercase ${
                  activeMode === "signin" 
                    ? "bg-[var(--color-brand-card)] text-[var(--color-brand-text)] shadow-xs" 
                    : "text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-text)]"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setActiveMode("signup"); setErrorMsg(""); setSuccessMsg(""); }}
                className={`flex-1 py-2 text-[15px] font-bold rounded-xl transition-all uppercase ${
                  activeMode === "signup" 
                    ? "bg-[var(--color-brand-card)] text-[var(--color-brand-text)] shadow-xs" 
                    : "text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-text)]"
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-5 shadow-xs space-y-4">
              <h3 className="text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest pl-1 font-sans">
                {activeMode === "signin" ? "Access Devotee Account" : "Register Devotee Passport"}
              </h3>

              {successMsg && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-2xl flex items-center gap-2 text-[15px] font-sans">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-2 text-[15px] font-sans">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4 text-[15px]">
                {/* Full Name for registration */}
                {activeMode === "signup" && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider pl-1">
                      Full Name / Devotee Handle
                    </label>
                    <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-3 flex items-center gap-2.5 transition-all focus-within:border-[var(--color-brand-primary)]">
                      <User className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                      <input
                        type="text"
                        placeholder="Juana dela Cruz"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-transparent outline-none text-[15px] text-[var(--color-brand-text)]"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider pl-1 font-sans">
                    Email Address
                  </label>
                  <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-3 flex items-center gap-2.5 transition-all focus-within:border-[var(--color-brand-primary)]">
                    <Mail className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                    <input
                      type="email"
                      placeholder="pilgrim@sti.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent outline-none text-[15px] text-[var(--color-brand-text)]"
                      required
                    />
                  </div>
                </div>

                {/* Password PIN */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider pl-1 font-sans">
                    Password
                  </label>
                  <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-3 flex items-center gap-2.5 transition-all focus-within:border-[var(--color-brand-primary)]">
                    <KeyRound className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent outline-none text-[15px] text-[var(--color-brand-text)]"
                      required
                    />
                  </div>
                </div>

                {/* Beautiful dynamic login button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] disabled:opacity-50 text-white active:scale-95 transition-all text-[15px] font-bold uppercase tracking-widest rounded-full shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <span>Processing Authorization...</span>
                  ) : (
                    <>
                      <span>{activeMode === "signin" ? "Authenticate Passport" : "Register Profile"}</span>
                      {activeMode === "signin" ? <ArrowRight className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* iOS Style Info Card */}
            <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-4 space-y-2 text-[15px] text-[var(--color-brand-secondary)] shadow-xs">
              <strong className="block text-[var(--color-brand-text)] font-bold uppercase tracking-wider text-sm font-sans">Registration Info:</strong>
              <div className="space-y-1.5 font-sans leading-relaxed">
                <p>Register with any standard email to create a pilgrim profile. Administrative access to the parish office portal is granted individually by parish staff and cannot be self-assigned.</p>
                <p>All authenticated credentials map directly to securely sandboxed Firestore sessions.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
