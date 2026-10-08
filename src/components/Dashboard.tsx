import { useEffect, useState } from "react";
import { Bell, ChevronUp } from "lucide-react";
import { Route } from "../types";
import { PARISH_PATRON_IMAGES, PARISH_HEADER_IMAGES, PARISH_HEADER_FACES } from "../data";
import BulletinRail from "./BulletinRail";
import VerseCard from "./VerseCard";
import ParishWelcomeHeader from "./ParishWelcomeHeader";
import MassScheduleCard from "./MassScheduleCard";
import ChurchHistoryCard from "./ChurchHistoryCard";
import { parishThemeStyle } from "../lib/parishTheme";
import { useParishContent } from "../lib/useParishContent";
import { liturgicalDay } from "../lib/liturgical";
import { announcementsForParish, publishedOnly, type AnnouncementDoc } from "../lib/announcements";


interface DashboardProps {
  parish: Route;
  announcements: AnnouncementDoc[];
  onNavigate: (
    tab: "mass" | "history" | "ministries" | "sacraments" | "ar" | "navigator" | "rosary" | "me"
  ) => void;
  onSelectParish: (parishId: string) => void;
  /** Opens the Map tab with a walking route already drawn to this parish. */
  onWalkThere: (parishId: string) => void;
  /** Opens the full-screen parish search. */
  onOpenSearch: () => void;
  /**
   * Given only when this dashboard is showing a parish that is not the
   * pilgrim's own, which is what puts "Back to my parish" on the band.
   */
  onBackToMyParish?: () => void;
  /**
   * Whether this parish's Masses are already being reminded about.
   * Absent on the pilgrim's own parish, which is always on.
   */
  followingThisParish?: boolean;
  onToggleFollowParish?: (follow: boolean) => void;
  /** First name of the signed-in pilgrim; the greeting omits it when absent. */
  firstName?: string;
}

function parishDisplayName(parish: Route): string {
  return parish.name.replace(" Guide", "").replace(" Tour", "");
}

// "in 3 hours", "in 25 minutes" — coarse enough to stay readable, fine
// enough that a pilgrim glancing at the dashboard can tell whether to
// hurry. Recomputed every 30s by the caller so it never goes stale while
// the dashboard is left open.
export function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "starting now";

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 1) return "in under a minute";
  if (totalMinutes < 60) return `in ${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;

  const hours = Math.round(totalMinutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export default function Dashboard({
  parish, announcements, onNavigate, firstName, onOpenSearch, onBackToMyParish,
  followingThisParish, onToggleFollowParish,
}: DashboardProps) {
  const parishName = parishDisplayName(parish);
  const [now, setNow] = useState(() => new Date());

  // Keeps the date and the Mass card fresh without needing the pilgrim to
  // reopen the tab.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Admin-managed overlay: photo, description, Mass times, history, colour.
  // Null for every parish nobody has edited, which is all of them until
  // someone does — and the compiled data in data.ts carries those.
  const managed = useParishContent(parish.id);
  const today = liturgicalDay(now);

  // The parish's own words win; the calendar's named feast is the fallback.
  // Both may be absent — most days of the year are not a feast — and that is
  // a reason to show nothing, not to invent something.
  const commemorates = managed?.commemoratesText?.trim() || today.feast;

  return (
    <div
      className="home-bright home-bright__ground flex-1 flex flex-col text-left"
      style={parishThemeStyle(parish.id)}
    >
      {/* The bright theme is scoped to THIS element, not to :root. Every
          component below — including shared ones like BulletinRail — picks up
          the new palette through the same role tokens, while Map, Pray, Me
          and Scan stay warm paper. Rolling the theme app-wide later means
          moving the block in index.css to :root, not editing components.

          The parish's own three colours ride in on the same element, so the
          whole screen wears its livery: the navy was never the app's colour,
          it was Mary Help's, and San Roque's screen was wearing another
          parish's blue. */}

      {/* The welcome band from the design: the patron image behind the
          greeting, the date, the parish name and where it is. It replaces a
          date row plus a collapsing photo card, which read as a list item
          rather than as arriving at the parish's own page. */}
      <ParishWelcomeHeader
        parishName={parishName}
        location={parish.location}
        imageUrl={managed?.photoUrl ?? PARISH_HEADER_IMAGES[parish.id] ?? PARISH_PATRON_IMAGES[parish.id]}
        // Only for the parish's own photograph. An admin-uploaded one has
        // nobody to say where the face is, so it keeps the plain crop.
        imageFaceY={managed?.photoUrl ? undefined : PARISH_HEADER_FACES[parish.id]}
        firstName={firstName}
        onSearch={onOpenSearch}
        onBackToMyParish={onBackToMyParish}
        now={now}
      />

      {/* Reminders for a parish that is not your own.
          Offered here, on that parish's own screen, and only when you
          are away from yours - it is the moment the question makes
          sense, and it is the one place the answer is unambiguous
          about WHICH parish is meant. Looking at a parish does not
          sign you up for anything; this switch does, and nothing else
          does.

          The caller decides when to pass the handler, and it keys that
          on the SAME home parish the reminders are built from. Tying
          it to "Back to my parish" instead looked right and was not:
          that button keys off the signed-in profile, which is null
          when signed out, so the switch never appeared for anyone who
          had not logged in. */}
      {onToggleFollowParish && (
        <div className="px-4 pt-3">
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-4 cursor-pointer">
            <Bell className="w-5 h-5 shrink-0 text-[var(--color-brand-primary)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold leading-snug text-[var(--color-brand-text)]">
                Remind me about this parish
              </span>
              <span className="block text-[14px] leading-snug text-[var(--color-brand-secondary)]">
                {followingThisParish
                  ? `You will be reminded before Mass at ${parishName} as well as your own.`
                  : `Mass times and feast days here, alongside your own parish's.`}
              </span>
            </span>
            <input
              type="checkbox"
              className="availability-switch"
              aria-label={`Remind me about ${parishName}`}
              checked={followingThisParish ?? false}
              onChange={e => onToggleFollowParish(e.target.checked)}
            />
          </label>
        </div>
      )}

      {managed?.description && (
        <div className="px-5 pt-1.5">
          <p className="text-[16px] leading-relaxed text-[var(--color-brand-text)]">
            {managed.description}
          </p>
        </div>
      )}

      <div className="home-sheet px-4 pb-4">
        <div className="home-sheet__handle" aria-hidden="true">
          <ChevronUp className="w-6 h-6" />
        </div>

        <div className="home-motif home-motif--pin">
        <h2 className="home-section-title">
          Parish
          <br />
          Bulletin
        </h2>

        {/* The bulletin reads top to bottom: the verse, then what the
            parish has announced, then the two ways in. The verse is the
            thing that changes every day, so it leads and stays put —
            inside the old rail it was one card among four and had to be
            swiped away to reach the others. */}
        <div className="home-verse">
          <VerseCard />
        </div>

        {/* Scoped to the parish being shown, not to the pilgrim's own.
            Searching your way onto San Roque's dashboard and reading Mary
            Help's announcements there was the bug this closes. The legacy
            diocese-wide ones - the documents with no churchId at all -
            still appear everywhere; see lib/announcements.ts.

            Published only - a draft the parish is still writing, and
            anything they have archived, must never reach a home screen. */}
        <BulletinRail
          announcements={publishedOnly(announcementsForParish(announcements, parish.id))}
          onNavigate={onNavigate}
        />

        </div>

        <div className="home-motif home-motif--calendar">
        <h2 className="home-section-title">
          Mass
          <br />
          Schedule
        </h2>
        <MassScheduleCard
          routeId={parish.id}
          now={now}
        />

        {/* What the day commemorates — the parish's own words if they have
            written any, otherwise the named solemnity or feast the calendar
            supplies.

            Shown only when there is something to say. Falling back to the
            liturgical day NAME printed the Mass card's own title a second
            time, word for word, which is noise rather than information; on an
            ordinary Wednesday with no feast the card simply is not there. */}
        {commemorates && (
          <div className="mt-3 rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
            <h4 className="text-[19px] font-bold italic text-[var(--color-brand-text)]">
              Commemorates
            </h4>
            <p className="mt-1.5 text-[16px] leading-relaxed text-[var(--color-brand-secondary)]">
              {commemorates}
            </p>
          </div>
        )}

        </div>

        <div className="home-motif home-motif--cross">
        <h2 className="home-section-title">
          Church
          <br />
          History
        </h2>
        <ChurchHistoryCard
          routeId={parish.id}
          parishName={parishName}
          onOpenHistory={() => onNavigate("history")}
        />
        </div>

        {/* The Verse of the Day card now lives on Pray, at the client's
            request. It was the last thing on a long Home scroll, where it
            sat under the church history and was rarely reached; on Pray it
            is beside the day's mysteries, which is the screen a pilgrim
            opens to read something. verses.ts is unchanged and is now
            imported by PrayScreen instead. */}
      </div>
    </div>
  );
}
