import { describe, it, expect } from "vitest";
import {
  closedIds, isOpenForApplications, withAvailability, summarise, closedMessage,
} from "./availability";
import type { ParishContent } from "./parishContent";

const content = (closedApplications?: string[]): ParishContent =>
  (closedApplications ? { closedApplications } : {});

describe("absent means open", () => {
  // The whole design rests on this. 29 of the 31 parishes have no
  // parishContent document at all, and if "no document" read as "nothing
  // available" every ministry in the diocese would have closed the day
  // this shipped.
  it("a parish with no document at all is open for everything", () => {
    expect(isOpenForApplications(null, "min-choir")).toBe(true);
    expect(isOpenForApplications(undefined, "sac-baptism")).toBe(true);
  });

  it("a parish with a document but no availability field is open", () => {
    expect(isOpenForApplications({ description: "A parish" }, "min-choir")).toBe(true);
  });

  it("an empty closed list is open", () => {
    expect(isOpenForApplications(content([]), "min-choir")).toBe(true);
    expect(closedIds(content([]))).toEqual([]);
  });
});

describe("closing and opening", () => {
  it("closes exactly the one named", () => {
    const c = content(["min-choir"]);
    expect(isOpenForApplications(c, "min-choir")).toBe(false);
    expect(isOpenForApplications(c, "min-altar-servers")).toBe(true);
  });

  it("closing adds the id", () => {
    expect(withAvailability([], "min-choir", false)).toEqual(["min-choir"]);
  });

  it("opening removes it", () => {
    expect(withAvailability(["min-choir", "sac-baptism"], "min-choir", true))
      .toEqual(["sac-baptism"]);
  });

  it("closing something already closed does not add it twice", () => {
    // A double-tap on the switch, or two tabs open. A field that grows a
    // duplicate every time is a field that eventually cannot be read.
    expect(withAvailability(["min-choir"], "min-choir", false)).toEqual(["min-choir"]);
  });

  it("opening something already open is a no-op", () => {
    expect(withAvailability(["sac-baptism"], "min-choir", true)).toEqual(["sac-baptism"]);
  });

  it("does not mutate the list it was given", () => {
    const before = ["min-choir"];
    withAvailability(before, "sac-baptism", false);
    expect(before).toEqual(["min-choir"]);
  });

  it("keeps the list sorted, so two admins' writes do not churn the document", () => {
    expect(withAvailability(["sac-baptism"], "min-choir", false))
      .toEqual(["min-choir", "sac-baptism"]);
  });
});

describe("the dashboard summary", () => {
  it("counts open and closed against the catalogue, not against the list", () => {
    // The closed list names two; the parish has four ministries. Counting
    // the list alone would report "2 ministries" and lose the other two.
    const out = summarise(content(["b", "d"]), ["a", "b", "c", "d"]);
    expect(out).toEqual({ open: 2, closed: 2 });
  });

  it("a parish that has closed nothing has everything open", () => {
    expect(summarise(null, ["a", "b", "c"])).toEqual({ open: 3, closed: 0 });
  });

  it("ignores a closed id that is not in the catalogue", () => {
    // A ministry removed from data.ts after a parish closed it. It must
    // not count against anything.
    expect(summarise(content(["gone"]), ["a", "b"])).toEqual({ open: 2, closed: 0 });
  });
});

describe("what the pilgrim is told", () => {
  it("says applications are closed, not that the ministry is gone", () => {
    const msg = closedMessage("ministry", "Choir");
    expect(msg).toContain("Choir");
    expect(msg).toMatch(/currently closed/i);
    expect(msg).toMatch(/check again later/i);
  });

  it("names the parish office as the way round it", () => {
    expect(closedMessage("sacrament", "Baptism")).toMatch(/parish office/i);
  });
});
