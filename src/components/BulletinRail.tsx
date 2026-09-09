import type { ReactNode } from "react";
import { useDragSafeClicks } from "../lib/useDragSafeClicks";
import { CalendarDays, ChevronRight, Users, Sparkles } from "lucide-react";
import { MINISTRIES, SACRAMENTS } from "../data";

/**
 * Stands in until the parish supplies photographs.
 *
 * An illustration, not a stock photo: a picture of some other church's
 * altar servers in Mary Help of Christians' card would read as a picture of
 * THIS parish. Same principle as scheduleVerified in data.ts - show the
 * placeholder, never the plausible-looking wrong thing.
 */
const PLACEHOLDER_PHOTO = "/parish/placeholder-ministry.svg";

export interface Announcement {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
}

interface BulletinRailProps {
  announcements: Announcement[];
  onNavigate: (tab: "ministries" | "sacraments" | "mass") => void;
}

/**
 * The parish bulletin — a horizontally swiping rail on Home.
 *
 * Fed by the announcements the admin panel already writes to Firestore, so
 * this is live parish data rather than a second menu. The three section cards
 * follow at the end so the rail is never empty before anyone has posted
 * anything — a bulletin board with nothing on it reads as broken, not as
 * quiet.
 *
 * Announcements are sorted soonest-first and past ones are dropped: a
 * bulletin still showing last month's fiesta is worse than a short one.
 */
export default function BulletinRail({ announcements, onNavigate }: BulletinRailProps) {
  // Without this, swiping the rail opens whichever card the finger started on.
  const dragSafe = useDragSafeClicks();
  const now = new Date();
  const upcoming = announcements
    .map(a => ({ ...a, when: new Date(a.date) }))
    .filter(a => !Number.isNaN(a.when.getTime()) && a.when.getTime() >= startOfDay(now))
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  return (
    <section>
      {/* The section TITLE belongs to the caller, not to this component.
          Home now heads it with a large display heading, and a second
          "Parish bulletin" directly beneath read as a stutter. What stays is
          the count, which is the part that actually changes. */}
      <div className="flex items-baseline justify-end px-1 mb-2.5">
        <span className="text-[15px] text-[var(--color-brand-secondary)]">
          {upcoming.length > 0 ? `${upcoming.length} coming up` : "Nothing posted yet"}
        </span>
      </div>

      <div
        className="card-rail"
        role="list"
        {...dragSafe}
      >
        {/* Said plainly rather than left looking empty. Past announcements
            are filtered out, so a bulletin whose events have all been and
            gone shows this instead of three stale dates. */}
        {upcoming.length === 0 && (
          <p
            role="listitem"
            // Narrower than a real card: it is one sentence, and at full card
            // width it pushed the ministry card - the useful one - off screen.
            className="card-rail__note rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-4 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]"
          >
            No upcoming events posted for this parish yet. New announcements appear here first.
          </p>
        )}

        {upcoming.map(item => (
          <article
            role="listitem"
            key={item.id}
            className="card-rail__card rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-4"
          >
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold px-2.5 py-1 rounded-md bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]">
              <CalendarDays className="w-3.5 h-3.5" />
              {item.type}
            </span>
            <h3 className="mt-2.5 text-[16px] font-semibold leading-snug text-[var(--color-brand-text)]">
              {item.title}
            </h3>
            <p className="mt-1 text-[15px] text-[var(--color-brand-secondary)]">
              {formatWhen(item.when, now)}
              {item.time ? ` · ${item.time}` : ""}
            </p>
          </article>
        ))}

        <RailLink
          icon={<Users className="w-5 h-5" />}
          label="Ministries"
          hint="Join a group ministry in this parish."
          caption={MINISTRIES[0]?.name}
          imageUrl={PLACEHOLDER_PHOTO}
          onClick={() => onNavigate("ministries")}
        />
        <RailLink
          icon={<Sparkles className="w-5 h-5" />}
          label="Sacraments"
          hint="Baptism, marriage and confession, arranged with the parish office."
          caption={SACRAMENTS[0]?.name}
          imageUrl={PLACEHOLDER_PHOTO}
          onClick={() => onNavigate("sacraments")}
        />
      </div>
    </section>
  );
}

/**
 * One section card in the rail: a photograph, then the label and what it is.
 *
 * The description lives INSIDE the card rather than in a panel underneath.
 * An earlier version opened the detail below the rail, and the client was
 * right to reject it: on a phone that panel sits below the fold, so the thing
 * the tap revealed is the one thing you cannot see.
 */
function RailLink({
  icon,
  label,
  hint,
  caption,
  imageUrl,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  /** Named over the photograph — an example of what is inside. */
  caption?: string;
  imageUrl?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-rail__link overflow-hidden rounded-[22px] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-left transition-colors hover:border-[var(--color-brand-primary)]"
    >
      {imageUrl && (
        <span className="relative block">
          <img src={imageUrl} alt="" className="w-full h-[116px] object-cover" loading="lazy" />
          {caption && (
            <>
              {/* A scrim, not a shadow: what sits behind the caption is a
                  photograph nobody has chosen yet, so its brightness cannot
                  be assumed. */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent"
              />
              <span className="absolute left-3 right-3 bottom-2 block text-[14px] font-semibold leading-snug text-white">
                {caption}
              </span>
            </>
          )}
        </span>
      )}

      <span className="block p-4">
        <span className="flex items-center gap-2 text-[16px] font-semibold text-[var(--color-brand-text)]">
          <span className="text-[var(--color-brand-primary)]">{icon}</span>
          {label}
          <ChevronRight className="w-4 h-4 ml-auto text-[var(--color-brand-secondary)]" />
        </span>
        <span className="mt-1 block text-[15px] leading-snug text-[var(--color-brand-secondary)]">
          {hint}
        </span>
      </span>
    </button>
  );
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Tomorrow", "Saturday", or a date once it is more than a week off. */
function formatWhen(when: Date, now: Date): string {
  const days = Math.round((startOfDay(when) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return when.toLocaleDateString("en-US", { weekday: "long" });
  return when.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
