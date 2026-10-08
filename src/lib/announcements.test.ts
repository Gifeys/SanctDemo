import { describe, it, expect } from "vitest";
import {
  announcementsForParish, upcomingAnnouncements, formatWhen,
  onBoard, publishedOnly, statusOf,
  type AnnouncementDoc,
} from "./announcements";

const ann = (over: Partial<AnnouncementDoc>): AnnouncementDoc => ({
  id: "a1", title: "Feast Mass", date: "2026-10-20", type: "Mass",
  churchId: "route-mhcp", ...over,
});

const NOW = new Date("2026-10-07T09:00:00");

describe("which parish's bulletin an announcement belongs on", () => {
  const all = [
    ann({ id: "mine", churchId: "route-mhcp" }),
    ann({ id: "theirs", churchId: "route-src" }),
    // Written before parishes were isolated. It has no owner, so it keeps
    // the meaning it had: everyone's.
    ann({ id: "legacy", churchId: undefined }),
  ];

  it("shows this parish's own and the ownerless legacy ones", () => {
    expect(announcementsForParish(all, "route-mhcp").map(a => a.id))
      .toEqual(["mine", "legacy"]);
  });

  it("never shows another parish's", () => {
    expect(announcementsForParish(all, "route-src").map(a => a.id))
      .toEqual(["theirs", "legacy"]);
  });

  it("a parish with nothing of its own still sees the legacy ones", () => {
    expect(announcementsForParish(all, "route-elsewhere").map(a => a.id))
      .toEqual(["legacy"]);
  });
});

describe("what the deck shows and in what order", () => {
  it("drops anything whose day has passed", () => {
    const items = [
      ann({ id: "gone", date: "2026-09-30" }),
      ann({ id: "soon", date: "2026-10-12" }),
    ];
    expect(upcomingAnnouncements(items, NOW).map(a => a.id)).toEqual(["soon"]);
  });

  it("keeps one happening today — a fiesta this afternoon is not past", () => {
    const items = [ann({ id: "today", date: "2026-10-07" })];
    expect(upcomingAnnouncements(items, NOW).map(a => a.id)).toEqual(["today"]);
  });

  it("soonest first", () => {
    const items = [
      ann({ id: "late", date: "2026-12-25" }),
      ann({ id: "early", date: "2026-10-09" }),
      ann({ id: "middle", date: "2026-11-01" }),
    ];
    expect(upcomingAnnouncements(items, NOW).map(a => a.id))
      .toEqual(["early", "middle", "late"]);
  });

  it("keeps undated notices, at the end rather than guessed at", () => {
    const items = [
      ann({ id: "undated", date: "" }),
      ann({ id: "dated", date: "2026-10-09" }),
    ];
    expect(upcomingAnnouncements(items, NOW).map(a => a.id))
      .toEqual(["dated", "undated"]);
  });

  it("treats an unparseable date as undated rather than dropping the notice", () => {
    const items = [ann({ id: "junk", date: "sometime soon" })];
    const out = upcomingAnnouncements(items, NOW);
    expect(out.map(a => a.id)).toEqual(["junk"]);
    expect(out[0]!.when).toBeNull();
  });

  it("reads the legacy long-form dates the seeded announcements carry", () => {
    const items = [ann({ id: "legacy", date: "December 25, 2026" })];
    const out = upcomingAnnouncements(items, NOW);
    expect(out[0]!.when).not.toBeNull();
  });
});

describe("when it says the thing happens", () => {
  it("names the near days rather than dating them", () => {
    expect(formatWhen(new Date("2026-10-07T18:00:00"), NOW)).toBe("Today");
    expect(formatWhen(new Date("2026-10-08T07:00:00"), NOW)).toBe("Tomorrow");
  });

  it("uses the weekday inside the week", () => {
    expect(formatWhen(new Date("2026-10-10T07:00:00"), NOW)).toBe("Saturday");
  });

  it("dates anything more than a week off", () => {
    expect(formatWhen(new Date("2026-12-25T07:00:00"), NOW)).toBe("December 25");
  });
});

describe("drafts, published and archived", () => {
  const a = (over: Partial<AnnouncementDoc>): AnnouncementDoc =>
    ann({ id: "x", ...over });

  it("anything written before this field existed counts as published", () => {
    // Otherwise every bulletin in the diocese would have emptied the
    // day the field shipped.
    expect(statusOf(a({ status: undefined }))).toBe("published");
    expect(publishedOnly([a({ id: "legacy", status: undefined })])).toHaveLength(1);
  });

  it("a draft never reaches a pilgrim", () => {
    const out = publishedOnly([
      a({ id: "live", status: "published" }),
      a({ id: "draft", status: "draft" }),
      a({ id: "old", status: "archived" }),
    ]);
    expect(out.map(x => x.id)).toEqual(["live"]);
  });
});

describe("the three boards", () => {
  const a = (type: string): AnnouncementDoc => ann({ id: type, type });

  it("feast days and events each show only their own", () => {
    expect(onBoard(a("Feast"), "feasts")).toBe(true);
    expect(onBoard(a("Event"), "feasts")).toBe(false);
    expect(onBoard(a("Event"), "events")).toBe(true);
    expect(onBoard(a("Mass"), "events")).toBe(false);
  });

  it("the announcements board shows everything, feasts included", () => {
    // A secretary looking for "the thing I posted on Tuesday" should not
    // have to remember which chip they gave it.
    for (const type of ["Mass", "Feast", "Event", "Notice"]) {
      expect(onBoard(a(type), "announcements")).toBe(true);
    }
  });
});
