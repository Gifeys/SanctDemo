import { describe, it, expect } from "vitest";
import {
  buildSchedule, buildScheduleForParishes, massReminders, announcementReminders,
  upcomingMasses, reminderId, DEFAULT_REMINDER_SETTINGS, MAX_SCHEDULED,
  type ParishReminders, type ReminderSettings,
} from "./reminderSchedule";
import type { MassScheduleEntry } from "./schedule";
import type { AnnouncementDoc } from "./announcements";

const settings = (over: Partial<ReminderSettings> = {}): ReminderSettings => ({
  ...DEFAULT_REMINDER_SETTINGS, ...over,
});

// Wednesday 7 October 2026, 09:00.
const WED_9AM = new Date(2026, 9, 7, 9, 0, 0, 0);

const SCHEDULE: MassScheduleEntry[] = [
  { day: "Wednesday", time: "6:00 AM, 6:00 PM" },
  { day: "Thursday", time: "6:00 AM" },
  { day: "Sunday", time: "6:00 AM, 8:00 AM, 10:30 AM" },
];

describe("which Masses are still to come", () => {
  it("skips the ones that have already started today", () => {
    // 6:00 AM is behind us at 9:00. Listing it would put a reminder for
    // this morning's Mass at the top of the list every afternoon.
    const next = upcomingMasses(SCHEDULE, WED_9AM);
    expect(next[0]!.time).toBe("6:00 PM");
    expect(next[0]!.at.getDate()).toBe(7);
  });

  it("runs on into the following days", () => {
    const next = upcomingMasses(SCHEDULE, WED_9AM);
    expect(next[1]!.day).toBe("Thursday");
    expect(next[1]!.at.getDate()).toBe(8);
  });

  it("is in chronological order, not schedule order", () => {
    const times = upcomingMasses(SCHEDULE, WED_9AM).map(m => m.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("never offers a Mass the parish has suspended", () => {
    // The worst possible notification: sending someone out for a Mass
    // that has been called off.
    const suspended: MassScheduleEntry[] = [
      { day: "Sunday", time: "6:00 AM, 8:00 AM", unavailableTimes: ["8:00 AM"] },
    ];
    const times = upcomingMasses(suspended, WED_9AM).map(m => m.time);
    expect(times).toContain("6:00 AM");
    expect(times).not.toContain("8:00 AM");
  });

  it("is empty for a parish with no schedule rather than guessing one", () => {
    expect(upcomingMasses([], WED_9AM)).toEqual([]);
  });
});

describe("the Mass reminder itself", () => {
  it("lands exactly one hour before, by default", () => {
    const [first] = massReminders(SCHEDULE, "Mary Help", WED_9AM, settings());
    // First upcoming Mass is Wednesday 6:00 PM, so the reminder is 5:00 PM.
    expect(first!.at.getHours()).toBe(17);
    expect(first!.at.getMinutes()).toBe(0);
    expect(first!.title).toBe("Mass in 1 hour");
    expect(first!.body).toContain("6:00 PM");
    expect(first!.body).toContain("Mary Help");
  });

  it("honours a different lead time", () => {
    const [first] = massReminders(SCHEDULE, "Mary Help", WED_9AM, settings({ massLeadMinutes: 30 }));
    expect(first!.at.getHours()).toBe(17);
    expect(first!.at.getMinutes()).toBe(30);
    expect(first!.title).toBe("Mass in 30 minutes");
  });

  it("says 2 hours, not 2 hour", () => {
    const [first] = massReminders(SCHEDULE, "P", WED_9AM, settings({ massLeadMinutes: 120 }));
    expect(first!.title).toBe("Mass in 2 hours");
  });

  it("crosses midnight correctly for an early Mass", () => {
    // Thursday 6:00 AM minus an hour is Thursday 5:00 AM, not Wednesday.
    const thursdayOnly: MassScheduleEntry[] = [{ day: "Thursday", time: "6:00 AM" }];
    const [r] = massReminders(thursdayOnly, "P", WED_9AM, settings());
    expect(r!.at.getDate()).toBe(8);
    expect(r!.at.getHours()).toBe(5);
  });

  it("drops a reminder whose moment has already passed", () => {
    // Opened at 5:30 for a 6:00 PM Mass: the Mass is still upcoming, the
    // one-hour reminder is not. Scheduling it in the past would either
    // fire instantly or be rejected.
    const at530 = new Date(2026, 9, 7, 17, 30);
    const wedEvening: MassScheduleEntry[] = [{ day: "Wednesday", time: "6:00 PM" }];
    const out = massReminders(wedEvening, "P", at530, settings());

    // Tonight's reminder is gone...
    expect(out.find(r => r.at.getDate() === 7)).toBeUndefined();
    // ...but NEXT Wednesday's is correctly still queued. A weekly Mass
    // does not stop existing because tonight's reminder is too late.
    expect(out).toHaveLength(1);
    expect(out[0]!.at.getDate()).toBe(14);
  });

  it("produces nothing at all when switched off", () => {
    expect(massReminders(SCHEDULE, "P", WED_9AM, settings({ massReminders: false }))).toEqual([]);
  });

  it("keeps the same id across reschedules, so alarms replace rather than double", () => {
    // Rebuilt on every app open. If the id moved, a week of opening the
    // app would queue seven alarms for the same Mass.
    const a = massReminders(SCHEDULE, "P", WED_9AM, settings());
    const later = new Date(2026, 9, 7, 10, 0);
    const b = massReminders(SCHEDULE, "P", later, settings());
    expect(b[0]!.id).toBe(a[0]!.id);
  });
});

const feast = (over: Partial<AnnouncementDoc>): AnnouncementDoc => ({
  id: "f1", churchId: "route-mhcp", title: "Feast of Mary Help of Christians",
  date: "2026-10-20", type: "Feast", ...over,
});

describe("feast days, events and notices", () => {
  it("warns the evening before and again on the day", () => {
    const out = announcementReminders([feast({})], WED_9AM, settings());
    expect(out).toHaveLength(2);
    expect(out[0]!.title).toBe("Feast day tomorrow");
    expect(out[1]!.title).toBe("Feast day today");
  });

  it("uses the parish's time when they gave one, in either clock format", () => {
    // The admin's <input type="time"> writes 24-hour "15:00"; the Mass
    // schedule is hand-typed "3:00 PM". Both have to work, and the
    // 24-hour one silently fell back to 8am until this was fixed.
    for (const time of ["15:00", "3:00 PM"]) {
      const out = announcementReminders([feast({ time })], WED_9AM, settings());
      const onTheDay = out.find(r => r.title.includes("today"))!;
      expect(onTheDay.at.getHours()).toBe(15);
    }
  });

  it("falls back to the morning for a time it cannot read", () => {
    const out = announcementReminders([feast({ time: "after lunch" })], WED_9AM, settings());
    expect(out.find(r => r.title.includes("today"))!.at.getHours()).toBe(8);
  });

  it("falls back to the morning rather than midnight", () => {
    // An all-day notice firing at 00:00 is one nobody reads.
    const out = announcementReminders([feast({})], WED_9AM, settings());
    expect(out.find(r => r.title.includes("today"))!.at.getHours()).toBe(8);
  });

  it("names an event's location, because you have to get there", () => {
    const out = announcementReminders(
      [feast({ type: "Event", title: "Youth gathering", location: "Parish hall" })],
      WED_9AM, settings(),
    );
    expect(out.find(r => r.title.includes("today"))!.body).toContain("Parish hall");
  });

  it("never reminds anyone about a draft or an archived notice", () => {
    const hidden = [
      feast({ id: "d", status: "draft" }),
      feast({ id: "a", status: "archived" }),
    ];
    expect(announcementReminders(hidden, WED_9AM, settings())).toEqual([]);
  });

  it("ignores anything already past", () => {
    expect(announcementReminders([feast({ date: "2026-09-01" })], WED_9AM, settings())).toEqual([]);
  });

  it("skips an unparseable date rather than firing at a wrong time", () => {
    expect(announcementReminders([feast({ date: "sometime" })], WED_9AM, settings())).toEqual([]);
  });

  it("each category can be switched off on its own", () => {
    const all = [
      feast({ id: "f", type: "Feast" }),
      feast({ id: "e", type: "Event" }),
      feast({ id: "n", type: "Notice" }),
    ];
    const only = announcementReminders(
      all, WED_9AM,
      settings({ feastReminders: false, eventReminders: false }),
    );
    expect(only.every(r => r.kind === "announcement")).toBe(true);
    expect(only.length).toBeGreaterThan(0);
  });
});

describe("the whole queue", () => {
  it("is in time order and never includes the past", () => {
    const out = buildSchedule(SCHEDULE, [feast({})], "Mary Help", WED_9AM, settings());
    const times = out.map(r => r.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every(t => t > WED_9AM.getTime())).toBe(true);
  });

  it("stays inside Android's pending-alarm budget, keeping the soonest", () => {
    // A busy parish: Mass every day, several times a day, plus notices.
    const busy: MassScheduleEntry[] = [
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    ].map(day => ({ day, time: "6:00 AM, 8:00 AM, 12:00 PM, 5:00 PM, 7:00 PM" }));
    const notices = Array.from({ length: 20 }, (_, i) =>
      feast({ id: `n${i}`, date: "2026-10-12", type: "Notice" }));

    const out = buildSchedule(busy, notices, "P", WED_9AM, settings());
    expect(out.length).toBeLessThanOrEqual(MAX_SCHEDULED);
    // What survives is the near future, which is what a reminder is for.
    const last = out[out.length - 1]!.at.getTime();
    const dropped = 10 * 24 * 60 * 60_000;
    expect(last - WED_9AM.getTime()).toBeLessThan(dropped);
  });

  it("is empty when every category is off", () => {
    const off = settings({
      massReminders: false, feastReminders: false,
      eventReminders: false, announcementReminders: false,
    });
    expect(buildSchedule(SCHEDULE, [feast({})], "P", WED_9AM, off)).toEqual([]);
  });

  it("gives every reminder its own id", () => {
    const out = buildSchedule(SCHEDULE, [feast({})], "P", WED_9AM, settings());
    expect(new Set(out.map(r => r.id)).size).toBe(out.length);
  });
});

describe("the ids themselves", () => {
  it("are stable for the same key", () => {
    expect(reminderId("mass:x")).toBe(reminderId("mass:x"));
  });

  it("differ for different keys", () => {
    expect(reminderId("mass:x")).not.toBe(reminderId("mass:y"));
  });

  it("fit in the positive range Android accepts", () => {
    for (const key of ["mass:2026-10-07", "ann-eve:abc", "", "a".repeat(200)]) {
      const id = reminderId(key);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(2_147_483_647);
    }
  });
});

describe("following more than one parish", () => {
  // Two parishes that both say Mass on Thursday evening, at the same
  // hour. This is the ordinary case in a city, not an edge case.
  const sameHour = (parishId: string, parishName: string): ParishReminders => ({
    parishId,
    parishName,
    massSchedule: [{ day: "Thursday", time: "6:00 PM" }],
    announcements: [],
  });

  it("keeps both when two parishes share a Mass time", () => {
    // The id used to be keyed on the moment alone, so these collided
    // and Android replaced one alarm with the other - following a
    // second parish silently cost you a reminder from the first.
    const out = buildScheduleForParishes(
      [sameHour("route-mhcp", "Mary Help"), sameHour("route-src", "San Roque")],
      WED_9AM,
      settings(),
    );
    const thursday = out.filter(r => r.at.getDate() === 8);
    expect(thursday).toHaveLength(2);
    expect(new Set(thursday.map(r => r.id)).size).toBe(2);
  });

  it("names the parish, so you know which church to walk to", () => {
    const out = buildScheduleForParishes(
      [sameHour("route-mhcp", "Mary Help"), sameHour("route-src", "San Roque")],
      WED_9AM,
      settings(),
    );
    const bodies = out.map(r => r.body).join(" | ");
    expect(bodies).toContain("Mary Help");
    expect(bodies).toContain("San Roque");
  });

  it("merges into one queue in time order, not parish by parish", () => {
    const mine: ParishReminders = {
      parishId: "route-mhcp", parishName: "Mary Help",
      massSchedule: [{ day: "Sunday", time: "6:00 AM" }], announcements: [],
    };
    const theirs: ParishReminders = {
      parishId: "route-src", parishName: "San Roque",
      massSchedule: [{ day: "Thursday", time: "6:00 AM" }], announcements: [],
    };
    const out = buildScheduleForParishes([mine, theirs], WED_9AM, settings());
    // Thursday comes before Sunday, even though its parish was second.
    expect(out[0]!.body).toContain("San Roque");
    const times = out.map(r => r.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("spends the alarm budget on whatever is soonest, wherever it is", () => {
    // Capping per parish would hold slots for next week across the city
    // while dropping tonight's Mass at their own.
    const busy = (id: string): ParishReminders => ({
      parishId: id, parishName: id,
      massSchedule: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        .map(day => ({ day, time: "6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM" })),
      announcements: [],
    });
    const out = buildScheduleForParishes([busy("a"), busy("b"), busy("c")], WED_9AM, settings());
    expect(out.length).toBeLessThanOrEqual(MAX_SCHEDULED);
    const times = out.map(r => r.at.getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
    // Nothing more than a few days out survived the cut.
    expect(out[out.length - 1]!.at.getTime() - WED_9AM.getTime())
      .toBeLessThan(4 * 24 * 60 * 60_000);
  });

  it("one parish is the same as the single-parish build", () => {
    const only: ParishReminders = {
      parishId: "route-mhcp", parishName: "Mary Help",
      massSchedule: SCHEDULE, announcements: [],
    };
    const multi = buildScheduleForParishes([only], WED_9AM, settings());
    const single = buildSchedule(SCHEDULE, [], "Mary Help", WED_9AM, settings());
    expect(multi.map(r => r.at.toISOString())).toEqual(single.map(r => r.at.toISOString()));
  });

  it("is empty when the pilgrim follows nobody", () => {
    expect(buildScheduleForParishes([], WED_9AM, settings())).toEqual([]);
  });
});
