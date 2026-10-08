import React, { useEffect, useState } from "react";
import { Church, Settings as SettingsIcon, Footprints, Ruler, Star, Award, ClipboardList, FlaskConical, ShieldCheck, User, Bell, ChevronRight } from "lucide-react";
import { UserProgress } from "../types";
import { BADGES } from "../data";
import MyApplications from "./MyApplications";
import EditProfileCard from "./EditProfileCard";
import { auth } from "../lib/firebase";
import { getProfile } from "../lib/userProfile";
import NotificationsCard from "./NotificationsCard";

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
  /** Lets Home's greeting refresh the moment the nickname changes. */
  onNicknameChange?: (nickname: string) => void;
  onOpenApplications: () => void;
  onOpenNotifications: () => void;
  /** For the badge; the page itself owns the list. */
  unreadNotifications: number;
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
  /**
   * The reminder settings card, passed in rather than built here.
   *
   * It needs the parish's Mass schedule and announcements, which this
   * tab has no business knowing about. App already holds both for the
   * scheduler, so it hands the finished card down.
   */
  reminders?: React.ReactNode;
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
  onNicknameChange,
  onOpenApplications,
  onOpenNotifications,
  unreadNotifications,
  reminders,
}: MeTabProps) {
  // The design shows a name and initials. Signed out there is no name to
  // show, so the header says "Pilgrim" rather than an empty avatar — the app
  // works fully without an account and should not imply otherwise.
  const displayName = isLoggedIn && userEmail ? userEmail.split("@")[0] : "Pilgrim";
  // Read once, then kept current by the card below rather than re-read.
  const [photoUrl, setPhotoUrl] = useState<string>("");
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) { setPhotoUrl(""); return; }
    let live = true;
    void getProfile(auth.currentUser.uid).then(p => {
      if (live) setPhotoUrl(p?.photoUrl ?? "");
    });
    return () => { live = false; };
  }, [isLoggedIn]);

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
        {/* The same photograph the profile card below shows. Two avatars
            on one screen disagreeing about who you are reads as a bug -
            and it was one: changing the picture changed the card and left
            this circle on its initials. */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="shrink-0 w-14 h-14 rounded-full object-cover border border-[var(--color-brand-border)]"
          />
        ) : (
          <span
            aria-hidden
            className="shrink-0 w-14 h-14 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] flex items-center justify-center text-[20px] font-bold"
          >
            {initials}
          </span>
        )}
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
        {/* One list, newest first, covering both generations of document
            in the collection: the new ones with a reference number and a
            status from the fixed set, and the older rows whose status is
            free text. MyApplications normalises them rather than this
            screen deciding which is which. */}
        {/* Your picture and the name the app calls you. Above the
            applications, because it is about who you are rather than what
            you have asked the parish for. */}
        <EditProfileCard
          isLoggedIn={isLoggedIn}
          onNicknameChange={onNicknameChange}
          onPhotoChange={setPhotoUrl}
        />

        {/* Two rows rather than two lists. Both of these grow without
            limit - an application is never removed, a notification
            arrives on every status change - and inline they turned the
            one screen that is meant to be "your account" into something
            you scroll past. The count is the part worth seeing here;
            the list gets a page. */}
        {isLoggedIn && (
          <div className="space-y-2.5">
            <SummaryRow
              icon={<ClipboardList className="w-5 h-5" />}
              label="My Applications"
              detail={
                applications.length === 0
                  ? "Nothing submitted yet"
                  : `${applications.length} application${applications.length === 1 ? "" : "s"}`
              }
              onClick={onOpenApplications}
            />
            <SummaryRow
              icon={<Bell className="w-5 h-5" />}
              label="Notifications"
              detail={unreadNotifications > 0
                ? `${unreadNotifications} unread`
                : "Nothing new"}
              badge={unreadNotifications}
              onClick={onOpenNotifications}
            />
          </div>
        )}

        {/* Which reminders this phone should actually show. Above the
            quick links, because it is a setting people come looking for
            after the first Mass they miss - not something to find under
            a list of shortcuts. */}
        {reminders}

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

/**
 * One line that says how many, and opens the list.
 *
 * A chevron and a count, not a preview: a half-shown list invites you to
 * read it here, which is the thing these rows exist to stop.
 */
function SummaryRow({ icon, label, detail, badge, onClick }: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] px-5 py-4 text-left"
    >
      <span className="shrink-0 text-[var(--color-brand-primary)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold text-[var(--color-brand-text)]">{label}</span>
        <span className="block text-[14px] text-[var(--color-brand-secondary)]">{detail}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-[var(--color-brand-primary)] px-2 py-0.5 text-[13px] font-bold text-[var(--color-brand-on-accent)]">
          {badge}
        </span>
      ) : null}
      <ChevronRight className="w-5 h-5 shrink-0 text-[var(--color-brand-secondary)]" aria-hidden />
    </button>
  );
}
