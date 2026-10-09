import { useEffect, useState, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { auth } from "../lib/firebase";
import { getProfile } from "../lib/userProfile";
import { getChurch } from "../lib/churches";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import AdminApplicationDetail from "./AdminApplicationDetail";
import AdminApplications from "./AdminApplications";
import AdminAnnouncements from "./AdminAnnouncements";
import AdminAnalytics from "./AdminAnalytics";
import AdminAvailability from "./AdminAvailability";
import AdminMassSchedule from "./AdminMassSchedule";
import AdminContent from "./AdminContent";
import type { Church, UserProfile } from "../types";

/**
 * The parish office, at /admin.
 *
 * ## What this gate is and is not
 *
 * It decides what to RENDER. It is not what stops an ordinary pilgrim
 * reading another parish's applications - firestore.rules does that, on
 * Google's servers, for every request whatever the client is. Someone who
 * reaches /admin/dashboard by typing it gets a shell that cannot load a
 * single document.
 *
 * It exists so the person sees an honest "this account is not an
 * administrator" instead of a dashboard full of permission errors, which
 * looks like the app is broken rather than like it is working.
 */
export interface AdminSession {
  user: User;
  profile: UserProfile;
  church: Church | null;
}

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [state, setState] = useState<"loading" | "out" | "not-admin" | "in">("loading");

  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      if (!user) { setSession(null); setState("out"); return; }

      const profile = await getProfile(user.uid);
      if (!profile || profile.role !== "church_admin" || !profile.churchId) {
        setSession(null);
        setState("not-admin");
        return;
      }

      setSession({ user, profile, church: await getChurch(profile.churchId) });
      setState("in");
    });
  }, []);

  if (state === "loading") {
    return (
      <Shell>
        <Loader2 className="mx-auto w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
        <p className="mt-3 text-[15px] text-[var(--color-brand-secondary)]">Checking your access…</p>
      </Shell>
    );
  }

  if (state === "not-admin") {
    return (
      <Shell>
        <ShieldAlert className="mx-auto w-8 h-8 text-[var(--color-brand-error)]" />
        <h1 className="mt-3 text-[19px] font-bold font-serif italic">This is the parish office</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
          Your account is signed in, but it does not administer a parish.
        </p>
        <p className="mt-2 text-[14px] text-[var(--color-brand-secondary)]">
          Parish administrators are appointed by the diocese. If that should be you,
          ask them to set it on your account.
        </p>
        <a href="/" className="mt-5 inline-block w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 font-bold text-[15px]">
          Back to SanctiWalk
        </a>
      </Shell>
    );
  }

  if (state === "out") {
    return (
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="login" element={<Navigate to="/admin" replace />} />
      <Route path="/" element={<AdminDashboard session={session!} />} />
      {/* "view/:id" rather than ":id", so a detail route can never be
          mistaken for the "ministry" / "sacrament" list routes. */}
      <Route path="applications" element={<AdminApplications session={session!} />} />
      <Route path="applications/view/:id" element={<AdminApplicationDetail session={session!} />} />
      <Route path="applications/:kind" element={<AdminApplications session={session!} />} />
      <Route path="announcements" element={<AdminAnnouncements session={session!} />} />
      {/* Feast Days and Events are the same page on a different board;
          see AdminAnnouncements for why they are not three collections. */}
      <Route path="announcements/:board" element={<AdminAnnouncements session={session!} />} />
      <Route path="mass-schedule" element={<AdminMassSchedule session={session!} />} />
      <Route path="content" element={<AdminContent session={session!} />} />
      <Route path="availability" element={<AdminAvailability session={session!} />} />
      <Route path="analytics" element={<AdminAnalytics session={session!} />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] flex items-center justify-center px-5">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-6 text-center">
        {children}
      </div>
    </div>
  );
}
