import { describe, it, expect } from "vitest";
import {
  massAnswer, historyAnswer, itemAnswer, distanceAnswer, contactAnswer,
  reminderAnswer, findMassTime, unknownAnswer, NO_INFORMATION,
} from "./sanctiAnswers";
import type { MassScheduleEntry } from "./schedule";
import type { ResolvedItem } from "./itemContent";

const SCHEDULE: MassScheduleEntry[] = [
  { day: "Sunday", time: "6:00 AM, 8:00 AM, 6:00 PM" },
  { day: "Wednesday", time: "6:00 PM" },
];

describe("Sancti never invents a Mass time", () => {
  // The failure that sends somebody to a locked church.
  it("says it does not know rather than guessing a schedule", () => {
    const out = massAnswer("Mary Help", []);
    expect(out.text).toMatch(/don't have the Mass schedule/i);
    expect(out.text).toMatch(/parish office/i);
    expect(out.text).not.toMatch(/\d:\d\d/);
  });

  it("reads back exactly what the parish entered", () => {
    const out = massAnswer("Mary Help", SCHEDULE);
    expect(out.text).toContain("Sunday: 6:00 AM, 8:00 AM, 6:00 PM");
    expect(out.text).toContain("Wednesday: 6:00 PM");
  });

  it("names a suspended Mass as suspended instead of dropping it", () => {
    // Leaving it out would tell a regular at the 8am that there is no
    // 8am, when the truth is that it is off this month.
    const out = massAnswer("Mary Help", [
      { day: "Sunday", time: "6:00 AM, 8:00 AM", unavailableTimes: ["8:00 AM"] },
    ]);
    expect(out.text).toContain("Sunday: 6:00 AM");
    expect(out.text).toMatch(/Suspended just now: Sunday 8:00 AM/);
  });

  it("handles a parish whose every Mass is suspended", () => {
    const out = massAnswer("Mary Help", [
      { day: "Sunday", time: "6:00 AM", unavailableTimes: ["6:00 AM"] },
    ]);
    expect(out.text).toMatch(/suspended at the moment/i);
  });
});

describe("Sancti never invents a reminder", () => {
  it("refuses a Mass that does not exist, and says what does", () => {
    const out = reminderAnswer("Mary Help", SCHEDULE, "7:00 PM");
    expect(out.text).toMatch(/isn't a 7:00 PM Mass/i);
    expect(out.text).toContain("6:00 PM");
  });

  it("confirms one that does, naming the day", () => {
    const out = reminderAnswer("Mary Help", SCHEDULE, "8:00 AM");
    expect(out.text).toMatch(/Sunday 8:00 AM/);
  });

  it("will not promise anything with no schedule at all", () => {
    expect(reminderAnswer("Mary Help", [], "6:00 PM").text).toMatch(/can't set that reminder/i);
  });

  it("asks which Mass when no time was given", () => {
    expect(reminderAnswer("Mary Help", SCHEDULE).text).toMatch(/Which Mass/i);
  });

  it("will not match a suspended Mass", () => {
    const suspended: MassScheduleEntry[] = [
      { day: "Sunday", time: "6:00 PM", unavailableTimes: ["6:00 PM"] },
    ];
    expect(findMassTime(suspended, "6:00 PM")).toBeNull();
  });
});

describe("Sancti never invents requirements", () => {
  const item = (over: Partial<ResolvedItem>): ResolvedItem => ({
    id: "sac-baptism", name: "Holy Baptism", about: "About baptism.",
    requirements: [], schedule: "", process: [], reminders: [],
    responsibilities: [], contact: "", ...over,
  });

  it("says the parish has not listed them rather than making a list", () => {
    const out = itemAnswer(item({}), true);
    expect(out.text).toMatch(/hasn't listed the requirements/i);
    expect(out.text).not.toMatch(/•/);
  });

  it("lists the parish's own when there are some", () => {
    const out = itemAnswer(item({ requirements: ["PSA birth certificate"] }), true);
    expect(out.text).toContain("• PSA birth certificate");
  });

  it("says applications are closed instead of offering the form", () => {
    const out = itemAnswer(item({}), false);
    expect(out.text).toMatch(/closed at the moment/i);
    expect(out.followUp).toBeUndefined();
  });

  it("falls back cleanly for something it has no record of", () => {
    expect(itemAnswer(null, true).text).toBe(NO_INFORMATION);
  });
});

describe("history and contact", () => {
  it("will not summarise a history it does not have", () => {
    expect(historyAnswer("Mary Help").text).toMatch(/hasn't added its history/i);
  });

  it("repeats the parish's own words", () => {
    expect(historyAnswer("Mary Help", "Founded in 1952.").text).toBe("Founded in 1952.");
  });

  it("will not invent a phone number", () => {
    expect(contactAnswer("Mary Help").text).toMatch(/don't have contact details/i);
  });
});

describe("distance", () => {
  it("asks for location rather than guessing", () => {
    expect(distanceAnswer("Mary Help", null, false).text).toMatch(/location/i);
  });

  it("reports metres close by and kilometres further out", () => {
    expect(distanceAnswer("Mary Help", 450, true).text).toContain("450 m");
    expect(distanceAnswer("Mary Help", 4200, true).text).toContain("4.2 km");
  });

  it("only offers a walking time when walking is plausible", () => {
    expect(distanceAnswer("Mary Help", 800, true).text).toMatch(/minutes' walk/);
    expect(distanceAnswer("Mary Help", 9000, true).text).not.toMatch(/walk/);
  });
});

describe("not understanding", () => {
  it("says what it can do instead of apologising vaguely", () => {
    const out = unknownAnswer();
    expect(out.text).toMatch(/map/i);
    expect(out.text).toMatch(/Mass times/i);
  });
});
