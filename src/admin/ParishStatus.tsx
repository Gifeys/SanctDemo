import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Church, Sparkles, Users } from "lucide-react";
import { db } from "../lib/firebase";
import { MINISTRIES, SACRAMENTS } from "../data";
import { useParishContent } from "../lib/useParishContent";
import { summarise } from "../lib/availability";
import { availableTimes } from "../lib/schedule";
import {
  FEAST_TYPE, publishedOnly, upcomingAnnouncements, formatWhen,
  type AnnouncementDoc,
} from "../lib/announcements";

/**
 * What the parish looks like to a pilgrim right now.
 *
 * ## Why this is separate from the application counts above it
 *
 * Those answer "how much work is in". This answers "what have we got
 * switched on" — and the two get confused. An admin who closed the choir
 * three weeks ago and forgot has no way to notice from a list of
 * applications, because the symptom is applications that never arrive.
 *
 * Every tile links to the page that changes it, so noticing and fixing
 * are one click apart.
 */
export default function ParishStatus({ churchId }: { churchId: string }) {
  const navigate = useNavigate();
  const managed = useParishContent(churchId);
  const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);

  useEffect(() => {
    const q = query(collection(db, "announcements"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setAnnouncements(snap.docs.map(d => ({ ...(d.data() as AnnouncementDoc), id: d.id }))),
      // Not fatal. This panel is a summary; an admin whose announcements
      // fail to load should still see their availability.
      () => setAnnouncements([]),
    );
  }, [churchId]);

  const ministries = summarise(managed, MINISTRIES.map(m => m.id));
  const sacraments = summarise(managed, SACRAMENTS.map(s => s.id));

  const schedule = managed?.massSchedule ?? [];
  const suspended = schedule.reduce(
    (n, entry) => n + (entry.unavailableTimes?.length ?? 0), 0,
  );
  const running = schedule.reduce((n, entry) => n + availableTimes(entry).length, 0);

  const nextFeast = upcomingAnnouncements(
    publishedOnly(announcements).filter(a => a.type === FEAST_TYPE),
  )[0];

  return (
    <section className="mt-7">
      <h2 className="mb-3 text-[17px] font-bold font-serif italic text-[var(--color-brand-text)]">
        Parish status
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          icon={<Users className="w-4 h-4" />}
          label="Ministries"
          onClick={() => navigate("/admin/availability")}
          good={`${ministries.open} accepting applications`}
          bad={ministries.closed > 0 ? `${ministries.closed} not available` : null}
        />
        <Card
          icon={<Sparkles className="w-4 h-4" />}
          label="Sacraments"
          onClick={() => navigate("/admin/availability")}
          good={`${sacraments.open} open for applications`}
          bad={sacraments.closed > 0 ? `${sacraments.closed} not available` : null}
        />
        <Card
          icon={<Church className="w-4 h-4" />}
          label="Mass schedule"
          onClick={() => navigate("/admin/mass-schedule")}
          good={
            schedule.length === 0
              ? "Using the times built into the app"
              : `${running} Mass${running === 1 ? "" : "es"} a week`
          }
          bad={suspended > 0 ? `${suspended} suspended` : null}
        />
        <Card
          icon={<CalendarDays className="w-4 h-4" />}
          label="Next feast day"
          onClick={() => navigate("/admin/announcements/feasts")}
          good={
            nextFeast
              ? `${nextFeast.title}${nextFeast.when ? ` — ${formatWhen(nextFeast.when)}` : ""}`
              : "None published"
          }
          bad={null}
        />
      </div>
    </section>
  );
}

function Card({
  icon, label, good, bad, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  good: string;
  /** The part an admin needs to notice. Absent when there is nothing off. */
  bad: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 transition-colors hover:border-[var(--color-brand-primary)]"
    >
      <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
        <span className="text-[var(--color-brand-primary)]">{icon}</span>
        {label}
      </span>
      <span className="mt-1.5 flex items-center gap-2 text-[16px] font-bold text-[var(--color-brand-text)]">
        <Dot on /> {good}
      </span>
      {/* Only rendered when something is off. A permanent "0 not
          available" line trains people to stop reading this row. */}
      {bad && (
        <span className="mt-1 flex items-center gap-2 text-[15px] font-bold text-[var(--color-brand-secondary)]">
          <Dot on={false} /> {bad}
        </span>
      )}
    </button>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: on ? "var(--color-brand-success)" : "var(--color-brand-border)" }}
    />
  );
}
