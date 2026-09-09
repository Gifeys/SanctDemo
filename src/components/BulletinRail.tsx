import { useState, type ReactNode } from "react";
import { useDragSafeClicks } from "../lib/useDragSafeClicks";
import { CalendarDays, ChevronRight, ChevronDown, Users, Sparkles } from "lucide-react";
import { MINISTRIES, SACRAMENTS } from "../data";

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
/** Which section card is open, if any. */
type OpenSection = "ministries" | "sacraments" | null;

export default function BulletinRail({ announcements, onNavigate }: BulletinRailProps) {
  // Without this, swiping the rail opens whichever card the finger started on.
  const dragSafe = useDragSafeClicks();
  const [open, setOpen] = useState<OpenSection>(null);
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
            className="card-rail__card rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-4 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]"
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
          hint="Join a group at this parish"
          expanded={open === "ministries"}
          onClick={() => setOpen(v => (v === "ministries" ? null : "ministries"))}
        />
        <RailLink
          icon={<Sparkles className="w-5 h-5" />}
          label="Sacraments"
          hint="Baptism, marriage, confession"
          expanded={open === "sacraments"}
          onClick={() => setOpen(v => (v === "sacraments" ? null : "sacraments"))}
        />
      </div>

      {/* The detail opens BELOW the rail, not inside the card.
          The rail is a horizontal scroller with overflow-y: hidden — a card
          that grew downward would simply be clipped — and its cards are a
          fixed width, so a card that grew sideways would break the swipe.
          Opening underneath keeps both, and keeps the pilgrim's place: they
          see what a ministry actually is without being thrown onto another
          tab and having to find their way back. */}
      {open && (
        <SectionDetail
          section={open}
          onClose={() => setOpen(null)}
          onOpenTab={() => onNavigate(open)}
        />
      )}
    </section>
  );
}

/**
 * The expanded panel under the rail: what this parish actually offers.
 *
 * Names and descriptions come from the compiled lists, so it is the real
 * thing rather than a teaser — a pilgrim deciding whether to join a ministry
 * needs to know which ministries exist, and that is a short list, not a
 * separate screen's worth of reading.
 */
function SectionDetail({
  section,
  onClose,
  onOpenTab,
}: {
  section: "ministries" | "sacraments";
  onClose: () => void;
  onOpenTab: () => void;
}) {
  const items =
    section === "ministries"
      ? MINISTRIES.map(m => ({ id: m.id, name: m.name, description: m.description }))
      : SACRAMENTS.map(s => ({ id: s.id, name: s.name, description: s.description }));

  const heading = section === "ministries" ? "Ministries at this parish" : "Sacraments offered";

  return (
    <div className="mt-3 rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h3 className="text-[17px] font-bold text-[var(--color-brand-text)]">{heading}</h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[14px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-secondary)]"
        >
          Close
        </button>
      </div>

      <ul className="mt-2 divide-y divide-[var(--color-brand-border)]">
        {items.map(item => (
          <li key={item.id} className="px-4 py-3">
            <p className="text-[16px] font-semibold text-[var(--color-brand-text)]">{item.name}</p>
            <p className="mt-0.5 text-[15px] leading-snug text-[var(--color-brand-secondary)]">
              {item.description}
            </p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOpenTab}
        className="w-full flex items-center justify-center gap-1.5 border-t border-[var(--color-brand-border)] py-3.5 text-[16px] font-semibold text-[var(--color-brand-primary)]"
      >
        {section === "ministries" ? "Apply to a ministry" : "Request a sacrament"}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function RailLink({
  icon,
  label,
  hint,
  expanded,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Announced as a disclosure rather than a link, because that is now what
      // it is — it opens a panel on this screen instead of navigating away.
      aria-expanded={expanded}
      data-expanded={expanded}
      className="card-rail__link rounded-[22px] bg-[var(--color-brand-card)] border p-4 text-left transition-colors border-[var(--color-brand-border)] data-[expanded=true]:border-[var(--color-brand-primary)]"
    >
      <span className="text-[var(--color-brand-primary)]">{icon}</span>
      <span className="mt-2.5 flex items-center gap-1 text-[16px] font-semibold text-[var(--color-brand-text)]">
        {label}
        {/* The chevron turns to point at the panel it opened, so the card
            shows its own state rather than looking unchanged after a tap. */}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : "-rotate-90"}`}
        />
      </span>
      <span className="mt-0.5 block text-[15px] leading-snug text-[var(--color-brand-secondary)]">{hint}</span>
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
