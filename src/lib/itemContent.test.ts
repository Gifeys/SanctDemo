import { describe, it, expect } from "vitest";
import {
  resolveMinistry, resolveSacrament, mergeItemContent, hasParishContent,
  linesToList, listToLines,
} from "./itemContent";
import { MINISTRIES, SACRAMENTS } from "../data";
import type { ParishContent } from "./parishContent";

const MINISTRY = MINISTRIES[0]!;
const SACRAMENT = SACRAMENTS.find(s => s.id === "sac-baptism")!;

const withContent = (itemId: string, content: object): ParishContent =>
  ({ itemContent: { [itemId]: content } });

describe("a parish that has written nothing", () => {
  // 29 of the 31 parishes. They must keep showing the text the app
  // shipped with, not fall back to blank sections.
  it("still shows the compiled description and requirements", () => {
    const out = resolveSacrament(null, SACRAMENT.id)!;
    expect(out.about).toBe(SACRAMENT.description);
    expect(out.requirements).toEqual(SACRAMENT.requirements);
    expect(out.schedule).toBe(SACRAMENT.scheduleDetails);
  });

  it("offers no process or reminders rather than inventing them", () => {
    const out = resolveSacrament(null, SACRAMENT.id)!;
    expect(out.process).toEqual([]);
    expect(out.reminders).toEqual([]);
    expect(out.contact).toBe("");
  });

  it("is reported as unedited", () => {
    expect(hasParishContent(null, SACRAMENT.id)).toBe(false);
  });
});

describe("a parish that has written something", () => {
  it("their words replace the app's", () => {
    const out = resolveSacrament(
      withContent(SACRAMENT.id, { about: "Baptisms here are on Saturdays." }),
      SACRAMENT.id,
    )!;
    expect(out.about).toBe("Baptisms here are on Saturdays.");
  });

  it("editing one field leaves the rest falling back", () => {
    // The commonest case, and the one that would break if a partial
    // write blanked everything it did not mention.
    const out = resolveSacrament(withContent(SACRAMENT.id, { schedule: "Saturdays, 9 AM" }), SACRAMENT.id)!;
    expect(out.schedule).toBe("Saturdays, 9 AM");
    expect(out.about).toBe(SACRAMENT.description);
    expect(out.requirements).toEqual(SACRAMENT.requirements);
  });

  it("an empty list does not blank a correct one", () => {
    // Opening the editor and saving without typing writes []. Treating
    // that as "there are no requirements" would delete the parish's own
    // list.
    const out = resolveSacrament(withContent(SACRAMENT.id, { requirements: [] }), SACRAMENT.id)!;
    expect(out.requirements).toEqual(SACRAMENT.requirements);
  });

  it("whitespace does not count as written", () => {
    const out = resolveSacrament(withContent(SACRAMENT.id, { about: "   " }), SACRAMENT.id)!;
    expect(out.about).toBe(SACRAMENT.description);
  });

  it("one parish's writing does not reach another ministry", () => {
    const content = withContent(MINISTRY.id, { about: "Ours" });
    expect(resolveMinistry(content, MINISTRIES[1]!.id)!.about).toBe(MINISTRIES[1]!.description);
  });
});

describe("saving", () => {
  it("keeps only what was typed", () => {
    const out = mergeItemContent(null, "sac-baptism", {
      about: "  Some words  ",
      requirements: [],
      schedule: "",
      process: ["Apply", "Wait"],
    });
    expect(out["sac-baptism"]).toEqual({ about: "Some words", process: ["Apply", "Wait"] });
  });

  it("drops the item entirely when everything is cleared", () => {
    // Otherwise every item an admin ever opened leaves an empty object
    // behind, and hasParishContent starts lying.
    const before = withContent("sac-baptism", { about: "Old" });
    const out = mergeItemContent(before, "sac-baptism", { about: "", process: [] });
    expect(out).not.toHaveProperty("sac-baptism");
  });

  it("does not disturb the other items", () => {
    const before: ParishContent = {
      itemContent: { "sac-baptism": { about: "B" }, "min-choir": { about: "C" } },
    };
    const out = mergeItemContent(before, "sac-baptism", { about: "New" });
    expect(out["min-choir"]).toEqual({ about: "C" });
    expect(out["sac-baptism"]).toEqual({ about: "New" });
  });

  it("does not mutate what it was given", () => {
    const before: ParishContent = { itemContent: { "sac-baptism": { about: "B" } } };
    mergeItemContent(before, "sac-baptism", { about: "New" });
    expect(before.itemContent!["sac-baptism"]).toEqual({ about: "B" });
  });
});

describe("the textarea-to-list conversion", () => {
  it("one item per line, blank lines dropped", () => {
    // People leave a blank line between paragraphs out of habit, and a
    // list with a gap in it looks broken.
    expect(linesToList("One\n\n  Two  \n\nThree\n")).toEqual(["One", "Two", "Three"]);
  });

  it("round-trips", () => {
    expect(linesToList(listToLines(["A", "B"]))).toEqual(["A", "B"]);
    expect(listToLines(undefined)).toBe("");
  });
});
