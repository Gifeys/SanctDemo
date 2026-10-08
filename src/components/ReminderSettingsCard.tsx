import { useState } from "react";
import { useLanguage } from "../lib/useLanguage";
import { t } from "../lib/ui";
import { Bell, Church, PartyPopper, CalendarDays, Megaphone, ClipboardList, MapPin } from "lucide-react";
import { notifyNow } from "../lib/deviceNotifications";
import { LEAD_CHOICES, type ReminderSettings } from "../lib/reminderSchedule";
import type { PermissionState } from "../lib/deviceNotifications";

/**
 * Which reminders this phone should show.
 *
 * ## Why the permission ask is a button and not automatic
 *
 * Android 13 and later require the user to grant notifications, and a
 * prompt thrown at someone the second they open an app is the one they
 * refuse — after which it cannot be asked again from inside the app at
 * all. Asked from a screen that has just explained what the reminders
 * are for, the answer means something.
 *
 * ## Why the count is shown
 *
 * "Reminders are on" is a claim. "12 reminders set" is the app showing
 * its work, and it is the difference between a pilgrim trusting this to
 * wake them for the 6 AM Mass and checking their own alarm anyway.
 */
export default function ReminderSettingsCard({
  settings, update, permission, enable, scheduled, supported,
  otherParishes = [], onToggleParish,
}: {
  settings: ReminderSettings;
  update: (patch: Partial<ReminderSettings>) => void;
  permission: PermissionState;
  enable: () => Promise<PermissionState>;
  scheduled: number;
  supported: boolean;
  /**
   * Every parish that can be reminded about, besides the pilgrim's own.
   *
   * Their own is always on and is deliberately not in this list — a
   * switch that cannot be turned off is not a switch.
   *
   * This started as a card on the parish's own dashboard, which was
   * wrong twice over: it put one reminder control on Home while every
   * other one lived here, and it meant the only way to follow a parish
   * was to go and look at it first.
   */
  otherParishes?: Array<{ id: string; name: string; following: boolean }>;
  onToggleParish?: (parishId: string, follow: boolean) => void;
}) {
  const { language } = useLanguage();
  const [tested, setTested] = useState(false);

  return (
    <div className="bg-[var(--color-brand-card-sunk)] rounded-[22px] border border-[var(--color-brand-border)] p-5">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans">
        <Bell className="w-4 h-4" /> {t("rem.title", language)}
      </h4>

      {!supported ? (
        // The browser has no alarms to set. Said plainly rather than
        // showing switches that would quietly do nothing.
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          Reminders work in the installed SanctiWalk app on your phone. In a web
          browser there is nothing to set an alarm with.
        </p>
      ) : permission !== "granted" ? (
        <>
          <p className="text-[15px] leading-relaxed text-[var(--color-brand-text)]">
            Let SanctiWalk remind you before Mass, and tell you about feast days,
            parish news and your applications — even when the app is closed.
          </p>
          {permission === "denied" ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
              Notifications are switched off for SanctiWalk. Android only asks once,
              so this has to be turned back on in{" "}
              <strong>Settings → Apps → SanctiWalk → Notifications</strong>.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void enable()}
              className="mt-4 w-full rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] py-3 text-[15px] font-bold"
            >
              {t("rem.turnOn", language)}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 text-[15px] text-[var(--color-brand-secondary)]">
            {scheduled > 0
              ? `${scheduled} reminder${scheduled === 1 ? "" : "s"} set on this phone.`
              : "Nothing to remind you about just yet."}
          </p>

          <Row
            icon={<Church className="w-4 h-4" />}
            label={t("rem.beforeMass", language)}
            hint={t("rem.beforeMassHint", language)}
            on={settings.massReminders}
            onChange={v => update({ massReminders: v })}
          />

          {settings.massReminders && (
            <div className="mb-4 pl-7">
              <p className="mb-2 text-[14px] font-bold text-[var(--color-brand-secondary)]">
                {t("rem.howLongBefore", language)}
              </p>
              <div className="flex flex-wrap gap-2">
                {LEAD_CHOICES.map(minutes => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={settings.massLeadMinutes === minutes}
                    onClick={() => update({ massLeadMinutes: minutes })}
                    className={`apply-chip${settings.massLeadMinutes === minutes ? " is-on" : ""}`}
                  >
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Row
            icon={<PartyPopper className="w-4 h-4" />}
            label={t("rem.feastDays", language)}
            hint={t("rem.feastHint", language)}
            on={settings.feastReminders}
            onChange={v => update({ feastReminders: v })}
          />
          <Row
            icon={<CalendarDays className="w-4 h-4" />}
            label={t("rem.events", language)}
            on={settings.eventReminders}
            onChange={v => update({ eventReminders: v })}
          />
          <Row
            icon={<Megaphone className="w-4 h-4" />}
            label={t("rem.announcements", language)}
            on={settings.announcementReminders}
            onChange={v => update({ announcementReminders: v })}
          />
          <Row
            icon={<ClipboardList className="w-4 h-4" />}
            label={t("rem.applications", language)}
            hint={t("rem.applicationsHint", language)}
            on={settings.applicationUpdates}
            onChange={v => update({ applicationUpdates: v })}
            last
          />

          {/* Parishes besides their own. Always shown when there are
              any, following or not: this is the only place the choice
              is offered now, so hiding it until something is already
              followed would make the feature unreachable. */}
          {otherParishes.length > 0 && onToggleParish && (
            <div className="mt-4 pt-4 border-t border-[var(--color-brand-border)]">
              <p className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-secondary)]">
                <MapPin className="w-4 h-4" /> {t("rem.otherParishes", language)}
              </p>
              <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-brand-secondary)]">
                {t("rem.otherParishesHint", language)}
              </p>
              {otherParishes.map(parish => (
                <Row
                  key={parish.id}
                  icon={<Church className="w-4 h-4" />}
                  label={parish.name}
                  on={parish.following}
                  onChange={next => onToggleParish(parish.id, next)}
                  last
                />
              ))}
            </div>
          )}

          {/* Proof, on demand.
              "Reminders are on" is a claim somebody has to take on
              trust until the next Mass. One tap that puts a real
              notification in the tray settles it in a second, and it is
              also the quickest way to find out that Android's own
              per-app switch is off. */}
          <button
            type="button"
            onClick={() => {
              setTested(true);
              void notifyNow(
                "Reminders are working",
                "This is what a parish reminder looks like.",
              );
              window.setTimeout(() => setTested(false), 4000);
            }}
            className="mt-4 w-full rounded-full border-[1.5px] border-[var(--color-brand-border)] py-3 text-[15px] font-bold text-[var(--color-brand-text)]"
          >
            {tested ? t("rem.testSent", language) : t("rem.test", language)}
          </button>

          {/* The honest limit, said once rather than discovered. */}
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-brand-secondary)]">
            Mass, feast and event reminders are set on this phone, so they arrive
            even with no signal. News about your applications reaches you when you
            next open the app.
          </p>
        </>
      )}
    </div>
  );
}

function Row({
  icon, label, hint, on, onChange, last,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  on: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 ${last ? "" : "mb-4"} cursor-pointer`}>
      <span className="text-[var(--color-brand-primary)] shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug text-[var(--color-brand-text)]">
          {label}
        </span>
        {hint && (
          <span className="block text-[14px] text-[var(--color-brand-secondary)]">{hint}</span>
        )}
      </span>
      <input
        type="checkbox"
        className="availability-switch"
        aria-label={label}
        checked={on}
        onChange={e => onChange(e.target.checked)}
      />
    </label>
  );
}
