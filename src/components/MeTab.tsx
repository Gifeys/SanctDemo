import React from "react";
import { Church, Settings as SettingsIcon, Footprints, Ruler, Star, Award, ClipboardList, FlaskConical, ShieldCheck, User } from "lucide-react";
import { UserProgress } from "../types";
import { BADGES } from "../data";
import { isMinistryApplication, statusPresentation } from "../lib/ministryApplication";

type Application = {
  id: string;
  type: string;
  applicant: string;
  details: string;
  date: string;
  status: string;
  // Present on ministry applications only. See lib/ministryApplication.ts.
  ministryName?: string;
  parishName?: string;
  submittedAt?: string;
};

interface MeTabProps {
  isLoggedIn: boolean;
  userEmail: string;
  isAdmin: boolean;
  userProgress: UserProgress;
  applications: Application[];
  onLoginSuccess: (email: string, isAdmin: boolean) => void;
  onLogout: () => void;
  onOpenChangeParish: () => void;
  onOpenRosarySettings: () => void;
  onOpenAdmin: () => void;
  onOpenSimulator: () => void;
  /** Opens the sign-in screen. */
  onOpenSignIn: () => void;
  /** The pilgrim's home parish, shown under their name in the header. */
  parishName?: string;
}

// The bottom nav's fifth tab — assembled entirely from state the app
// already tracks (sign-in, applications, prayer/visit progress). No new
// account system, just one place to find what used to be scattered across
// the hamburger menu.
export default function MeTab({
  isLoggedIn,
  userEmail,
  isAdmin,
  userProgress,
  applications,
  onLoginSuccess,
  onLogout,
  onOpenChangeParish,
  onOpenRosarySettings,
  onOpenAdmin,
  onOpenSimulator,
  onOpenSignIn,
  parishName,
}: MeTabProps) {
  // The design shows a name and initials. Signed out there is no name to
  // show, so the header says "Pilgrim" rather than an empty avatar — the app
  // works fully without an account and should not imply otherwise.
  // Ministry applications carry the four-status lifecycle and their own
  // fields; everything else in the collection (sacrament bookings) does not.
  const ministryApplications = applications.filter(isMinistryApplication);
  const otherApplications = applications.filter(app => !isMinistryApplication(app));

  const displayName = isLoggedIn && userEmail ? userEmail.split("@")[0] : "Pilgrim";
  const initials = displayName
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("") || "P";

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">

      <div className="px-5 pt-6 pb-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
            Pilgrim profile
          </p>
          <h1 className="mt-1.5 text-[24px] font-bold tracking-tight text-[var(--color-brand-text)] capitalize truncate">
            {displayName}
          </h1>
          {parishName && (
            <p className="mt-0.5 text-[16px] text-[var(--color-brand-secondary)] truncate">{parishName}</p>
          )}
        </div>
        <span
          aria-hidden
          className="shrink-0 w-14 h-14 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] flex items-center justify-center text-[20px] font-bold"
        >
          {initials}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-4 font-sans">
        {/* The "Your Pilgrimage" card — steps, km walked, points and stamp
            badges — is gone at the client's request.

            Worth recording why it is no loss. "640 steps · 0.42 km" were the
            literal seed values in App.tsx, and nothing could ever change
            them: the only code that adds steps is handleStationVisited, whose
            sole caller is MapTab — a component no longer rendered anywhere in
            the app. So every pilgrim on every device saw exactly 640 steps
            and 0.42 km, for ever, however far they walked.

            A progress card that cannot track progress is worse than no card,
            and this one was stating two measurements of a walk that never
            happened. If step tracking is built later, it returns with real
            numbers behind it.

            userProgress is untouched — badges and points are still awarded by
            the quiz and still stored. */}
        {/* Applications — the pilgrim's own submissions (sacrament bookings,
            ministry sign-ups, station stamps). Firestore rules already scope
            this list to the signed-in uid (or everything, for an admin), so
            it renders as-is. */}
        {isLoggedIn && (
          <div className="bg-[var(--color-brand-card-sunk)] rounded-[22px] border border-[var(--color-brand-border)] p-5 space-y-3">
            <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-[var(--color-brand-secondary)]" /> My Application
            </h4>

            {ministryApplications.length === 0 ? (
              <p className="text-[15px] text-[var(--color-brand-secondary)]">
                No ministry application submitted yet. Ministries are under your
                parish dashboard.
              </p>
            ) : (
              <div className="space-y-3">
                {ministryApplications.map((app) => {
                  const status = statusPresentation(app.status);
                  return (
                    <div
                      key={app.id}
                      className="bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] p-3.5 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="font-bold text-[var(--color-brand-text)] text-[15px] leading-snug">
                          {/* Older rows predate the structured fields, so
                              fall back to the summary rather than showing a
                              blank line. */}
                          {app.ministryName ?? app.details}
                        </h5>
                        <span
                          className={`text-sm font-bold px-2 py-0.5 rounded-full border shrink-0 ${status.className}`}
                        >
                          {status.dot} {status.label}
                        </span>
                      </div>

                      <dl className="text-[15px] space-y-0.5">
                        {app.parishName && (
                          <div className="flex gap-2">
                            <dt className="text-[var(--color-brand-secondary)] w-[7.5rem] shrink-0">Parish</dt>
                            <dd className="text-[var(--color-brand-text)]">{app.parishName}</dd>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <dt className="text-[var(--color-brand-secondary)] w-[7.5rem] shrink-0">Date submitted</dt>
                          <dd className="text-[var(--color-brand-text)]">{app.date}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}

                <p className="text-[15px] text-[var(--color-brand-secondary)] leading-relaxed">
                  We will contact you through your registered email regarding your
                  application.
                </p>
              </div>
            )}

            {/* Sacrament bookings and the rest still belong to the pilgrim
                and were visible here before, so they stay - under their own
                heading rather than mixed in with ministry applications,
                which have their own four statuses. */}
            {otherApplications.length > 0 && (
              <div className="pt-3 border-t border-[var(--color-brand-border)] space-y-2.5">
                <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans">
                  Other Submissions
                </h4>
                {otherApplications.map((app) => (
                  <div key={app.id} className="border-b border-[var(--color-brand-card)]/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <h5 className="font-bold text-[var(--color-brand-text)] text-[15px]">{app.type}</h5>
                      <span className="text-sm font-bold text-[var(--color-brand-secondary)] bg-[var(--color-brand-card)] px-2 py-0.5 rounded-full shrink-0">
                        {app.status}
                      </span>
                    </div>
                    <p className="text-[15px] text-[var(--color-brand-text)] mt-0.5">{app.details}</p>
                    <p className="text-sm text-[var(--color-brand-secondary)] mt-0.5">{app.date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick links */}
        <div className="space-y-2">
          {/* Sign-in is a row here rather than a whole screen embedded at
              the top of Me. Inline, LoginModal brought its own "Pilgrim
              Profile" header, so Me showed two competing profile headers
              stacked on each other. */}
          <button
            onClick={isLoggedIn ? onLogout : onOpenSignIn}
            className="w-full bg-[var(--color-brand-card-sunk)] p-4 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-3 hover:border-[var(--color-brand-primary)] text-left transition-colors text-[16px] font-semibold text-[var(--color-brand-text)]"
          >
            <User className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            <span className="flex-1 truncate">{isLoggedIn ? "Sign out" : "Sign in"}</span>
            {isLoggedIn && (
              <span className="text-[14px] font-normal text-[var(--color-brand-secondary)] truncate max-w-[45%]">
                {userEmail}
              </span>
            )}
          </button>

          <button
            onClick={onOpenChangeParish}
            className="w-full bg-[var(--color-brand-card-sunk)] p-4 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-3 hover:border-[var(--color-brand-primary)] text-left transition-colors text-[16px] font-semibold text-[var(--color-brand-text)]"
          >
            <Church className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            <span>Change Parish</span>
          </button>
          <button
            onClick={onOpenRosarySettings}
            className="w-full bg-[var(--color-brand-card-sunk)] p-4 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-3 hover:border-[var(--color-brand-primary)] text-left transition-colors text-[16px] font-semibold text-[var(--color-brand-text)]"
          >
            <SettingsIcon className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            <span>Rosary Settings</span>
          </button>

          {/* Moved here from the removed sidebar. The simulator is a demo
              tool and says so, rather than sitting unlabelled among the
              pilgrim's own settings. */}
          <button
            onClick={onOpenSimulator}
            className="w-full bg-[var(--color-brand-card-sunk)] p-4 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-3 hover:border-[var(--color-brand-primary)] text-left transition-colors text-[16px] font-semibold text-[var(--color-brand-text)]"
          >
            <FlaskConical className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            <span className="flex-1">Location Simulator</span>
            <span className="text-[14px] font-normal text-[var(--color-brand-secondary)]">Demo tool</span>
          </button>

          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-full bg-[var(--color-brand-card-sunk)] p-4 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-3 hover:border-[var(--color-brand-primary)] text-left transition-colors text-[16px] font-semibold text-[var(--color-brand-text)]"
            >
              <ShieldCheck className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Admin Panel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
