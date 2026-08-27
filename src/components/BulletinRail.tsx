import type { ReactNode } from "react";
import { CalendarDays, ChevronRight, Users, Sparkles } from "lucide-react";

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
  const now = new Date();
  const upcoming = announcements
    .map(a => ({ ...a, when: new Date(a.date) }))
    .filter(a => !Number.isNaN(a.when.getTime()) && a.when.getTime() >= startOfDay(now))
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  return (
    <section>
      <div className="flex items-baseline justify-between px-1 mb-2.5">
        <h2 className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
          Parish bulletin
        </h2>
        {upcoming.length > 0 && (
          <span className="text-[15px] text-[var(--color-brand-secondary)]">
            {upcoming.length} coming up
          </span>
        )}
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {upcoming.map(item => (
          <article
            role="listitem"
            key={item.id}
            className="snap-center shrink-0 w-[78%] rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-4"
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
          onClick={() => onNavigate("ministries")}
        />
        <RailLink
          icon={<Sparkles className="w-5 h-5" />}
          label="Sacraments"
          hint="Baptism, marriage, confession"
          onClick={() => onNavigate("sacraments")}
        />
      </div>
    </section>
  );
}

function RailLink({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="snap-center shrink-0 w-[62%] rounded-[22px] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-4 text-left"
    >
      <span className="text-[var(--color-brand-primary)]">{icon}</span>
      <span className="mt-2.5 flex items-center gap-1 text-[16px] font-semibold text-[var(--color-brand-text)]">
        {label}
        <ChevronRight className="w-4 h-4" />
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
