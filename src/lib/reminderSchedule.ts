import { availableTimes, toMinutes, type MassScheduleEntry } from "./schedule";
import { statusOf, type AnnouncementDoc } from "./announcements";

/**
 * What the phone should be told to show, and when.
 *
 * ## Why this is pure
 *
 * Everything here is "given a schedule and a clock, which notifications
 * exist" — no plugin, no Capacitor, no Date.now(). The whole reason
 * reminders are hard is the timing: an hour before a 6:00 AM Mass is
 * 5:00 AM *the previous evening's* tomorrow, a Mass that has already
 * started is not a reminder, and rescheduling must not fire a second
 * copy of something already queued. None of that needs a device to test,
 * and all of it is wrong at least once if it is written inside a
 * component.
 *
 * ## Why local notifications and not push
 *
 * Push means FCM, which means a server holding a service-account key,
 * which means Cloud Functions and the Blaze plan. This project is on
 * Spark. A local notification is scheduled ON the phone and fires
 * whether or not the app is running, whether or not there is signal —
 * which for "Mass starts in an hour" is better than push would be
 * anyway: it works in a church basement with no bars.
 *
 * The honest limit is that only things the phone already KNOWS can be
 * scheduled this way. A Mass time, a feast date, an announcement it has
 * synced: yes. A parish decision made five minutes ago while the app is
 * closed: no, not until the app next opens. That gap is real and is
 * documented where it bites, in notifyOnOpen below.
 */

/** Android allows a limited number of pending alarms; stay well inside it. */
export const MAX_SCHEDULED = 48;

/** How far ahead to schedule Mass reminders. */
export const MASS_HORIZON_DAYS = 7;

const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * Minutes past midnight, from either clock format the app produces.
 *
 * The two halves of this app write times differently and nothing made
 * them agree. The Mass schedule is hand-typed as "6:00 AM"; the
 * announcement form uses `<input type="time">`, which always yields
 * 24-hour "15:00". `toMinutes` only ever understood the first, so every
 * feast and event the parish gave a time to silently fell back to 8am —
 * a reminder at the wrong hour, which is worse than none.
 *
 * Returns NaN for anything it cannot read, and the caller treats that as
 * "no time given" rather than guessing.
 */
export function parseAnyTime(value: string): number {
  const twelveHour = toMinutes(value);
  if (!Number.isNaN(twelveHour)) return twelveHour;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

export type ReminderKind = "mass" | "feast" | "event" | "announcement";

export interface Reminder {
  /**
   * Stable across reschedules, and numeric because Android identifies a
   * pending alarm by int. Rescheduling the same Mass must replace its
   * alarm rather than add a second one, so the id is derived from what
   * the reminder IS, not from when it was created.
   */
  id: number;
  kind: ReminderKind;
  title: string;
  body: string;
  /** When the notification should appear. */
  at: Date;
}

export interface ReminderSettings {
  massReminders: boolean;
  /** Minutes before the Mass. 60 is the default the brief asks for. */
  massLeadMinutes: number;
  feastReminders: boolean;
  eventReminders: boolean;
  announcementReminders: boolean;
  /** Status changes on your own applications. */
  applicationUpdates: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  massReminders: true,
  massLeadMinutes: 60,
  feastReminders: true,
  eventReminders: true,
  announcementReminders: true,
  applicationUpdates: true,
};

/** Lead times the settings screen offers, in minutes. */
export const LEAD_CHOICES = [15, 30, 60, 120] as const;

/**
 * A stable 31-bit id from a string.
 *
 * Android's notification id is a signed int, so the hash is masked into
 * that range. Collisions are possible in principle; with a few dozen
 * reminders whose keys are "mass:Sunday:6:00 AM" they are not a
 * practical concern, and the cost of one would be a single reminder
 * replacing another rather than anything worse.
 */
export function reminderId(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000;
}

/**
 * Every Mass in the next week, as real dates.
 *
 * Suspended times are already excluded by availableTimes — a reminder
 * for a Mass the parish has called off is the single worst notification
 * this app could send.
 */
export function upcomingMasses(
  schedule: MassScheduleEntry[],
  now: Date,
  horizonDays: number = MASS_HORIZON_DAYS,
): Array<{ day: string; time: string; at: Date }> {
  const out: Array<{ day: string; time: string; at: Date }> = [];

  for (let offset = 0; offset <= horizonDays; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const dayName = DAYS[date.getDay()];
    const entry = schedule.find(e => e.day === dayName);
    if (!entry) continue;

    for (const time of availableTimes(entry)) {
      const minutes = toMinutes(time);
      if (Number.isNaN(minutes)) continue;

      const at = new Date(date);
      at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      // A Mass that has already begun is not upcoming. Without this the
      // first entry every morning is one that started hours ago.
      if (at.getTime() <= now.getTime()) continue;
      out.push({ day: dayName, time, at });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function massReminders(
  schedule: MassScheduleEntry[],
  parishName: string,
  now: Date,
  settings: ReminderSettings,
  /**
   * Which parish these belong to.
   *
   * Part of the id, and it has to be: the id was keyed on the Mass time
   * alone, so two parishes that both have a 6:00 AM Sunday Mass
   * produced the SAME id and Android replaced one alarm with the other.
   * Following a second parish silently cost you a reminder from the
   * first. Optional only so the single-parish callers and their tests
   * read unchanged.
   */
  parishId = "",
): Reminder[] {
  if (!settings.massReminders) return [];
  const lead = settings.massLeadMinutes;

  return upcomingMasses(schedule, now)
    .map(mass => {
      const at = new Date(mass.at.getTime() - lead * 60_000);
      return {
        // Keyed on the parish AND the moment, so tomorrow's 6 AM
        // reminder keeps its id across every reschedule between now and
        // then, and two parishes at the same hour stay two reminders.
        id: reminderId(`mass:${parishId}:${mass.at.toISOString()}`),
        kind: "mass" as const,
        title: lead >= 60
          ? `Mass in ${lead / 60} hour${lead === 60 ? "" : "s"}`
          : `Mass in ${lead} minutes`,
        body: `${mass.time} Mass at ${parishName}.`,
        at,
      };
    })
    // A reminder whose moment has passed cannot be scheduled. This is the
    // ordinary case for the next Mass when the app is opened inside the
    // lead window - the Mass is still upcoming, its reminder is not.
    .filter(r => r.at.getTime() > now.getTime());
}

/**
 * The morning of a feast or event, and the evening before.
 *
 * Two reminders rather than one: the evening before is when somebody can
 * still change their plans, and the morning of is when they act on it.
 */
export function announcementReminders(
  announcements: AnnouncementDoc[],
  now: Date,
  settings: ReminderSettings,
): Reminder[] {
  const out: Reminder[] = [];

  for (const item of announcements) {
    if (statusOf(item) !== "published") continue;

    const kind: ReminderKind =
      item.type === "Feast" ? "feast" : item.type === "Event" ? "event" : "announcement";

    if (kind === "feast" && !settings.feastReminders) continue;
    if (kind === "event" && !settings.eventReminders) continue;
    if (kind === "announcement" && !settings.announcementReminders) continue;

    const when = item.date ? new Date(item.date) : null;
    if (!when || Number.isNaN(when.getTime())) continue;

    // The time the parish gave, or 8am when they gave none. An all-day
    // notice firing at midnight is a notification nobody reads.
    const minutes = item.time ? parseAnyTime(item.time) : NaN;
    const start = new Date(when);
    if (Number.isFinite(minutes)) {
      start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    } else {
      start.setHours(8, 0, 0, 0);
    }

    const label = kind === "feast" ? "Feast day" : kind === "event" ? "Parish event" : "Parish notice";

    const dayBefore = new Date(start.getTime() - 24 * 60 * 60_000);
    if (dayBefore.getTime() > now.getTime()) {
      out.push({
        id: reminderId(`ann-eve:${item.id}`),
        kind,
        title: `${label} tomorrow`,
        body: item.title,
        at: dayBefore,
      });
    }

    if (start.getTime() > now.getTime()) {
      out.push({
        id: reminderId(`ann-day:${item.id}`),
        kind,
        title: kind === "announcement" ? label : `${label} today`,
        body: item.location ? `${item.title} — ${item.location}` : item.title,
        at: start,
      });
    }
  }

  return out;
}

/**
 * Everything to hand the phone, soonest first and capped.
 *
 * Android limits how many alarms one app may have pending, and a parish
 * with a busy week plus a full Mass schedule can produce more than the
 * cap. Sorting by time before cutting means what survives is the next
 * few days — which is what a reminder is for. The list is rebuilt every
 * time the app opens, so the ones trimmed off the end get scheduled long
 * before they matter.
 */
/**
 * One parish's contribution to the reminder queue.
 *
 * A parish is its times and its notices; the caller is responsible for
 * having fetched both. Bundling them means adding a parish is adding an
 * item to an array rather than threading two more parallel lists
 * through every function below.
 */
export interface ParishReminders {
  parishId: string;
  parishName: string;
  massSchedule: MassScheduleEntry[];
  announcements: AnnouncementDoc[];
}

/**
 * The queue across every parish the pilgrim follows.
 *
 * Merged, then sorted by time, then capped — in that order, and the
 * order matters. Capping each parish separately would hold a slot for
 * next Sunday at a parish across the city while dropping tonight's Mass
 * at their own. What the phone is holding should be whatever happens
 * soonest, wherever it is.
 */
export function buildScheduleForParishes(
  parishes: ParishReminders[],
  now: Date,
  settings: ReminderSettings,
): Reminder[] {
  const all: Reminder[] = [];

  for (const parish of parishes) {
    all.push(
      ...massReminders(parish.massSchedule, parish.parishName, now, settings, parish.parishId),
      ...announcementReminders(parish.announcements, now, settings),
    );
  }

  return all
    .filter(r => r.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

export function buildSchedule(
  massSchedule: MassScheduleEntry[],
  announcements: AnnouncementDoc[],
  parishName: string,
  now: Date,
  settings: ReminderSettings,
): Reminder[] {
  return [
    ...massReminders(massSchedule, parishName, now, settings),
    ...announcementReminders(announcements, now, settings),
  ]
    .filter(r => r.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}
