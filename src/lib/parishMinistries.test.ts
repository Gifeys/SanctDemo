import { describe, expect, it } from "vitest";
import {
  MINISTRIES,
  ministriesForParish,
  parishHasConfirmedMinistries,
} from "../data";

describe("ministriesForParish", () => {
  it("gives Mary Help of Christians its own full list", () => {
    // That list came from the parish itself, so it is the one case
    // where showing all of them is right.
    expect(ministriesForParish("route-mhcp")).toEqual(MINISTRIES);
  });

  it("gives San Roque only the altar servers", () => {
    // The cathedral has confirmed that one and nothing else. Offering
    // the other fourteen would invite applications to groups the
    // parish has never been asked about, and the application would
    // arrive at an office with no such ministry to receive it.
    const got = ministriesForParish("route-src");
    expect(got.map(m => m.id)).toEqual(["min-altar-servers"]);
  });

  it("gives a parish nobody has asked nothing at all", () => {
    // An empty list is the honest answer. Falling back to another
    // parish's ministries is the bug this function exists to stop.
    expect(ministriesForParish("route-holy-trinity")).toEqual([]);
    expect(ministriesForParish(undefined)).toEqual([]);
  });

  it("never invents a ministry that is not in the catalogue", () => {
    for (const id of ["route-mhcp", "route-src"]) {
      for (const m of ministriesForParish(id)) {
        expect(MINISTRIES).toContainEqual(m);
      }
    }
  });

  it("keeps the catalogue order, so the list does not reshuffle", () => {
    const order = ministriesForParish("route-mhcp").map(m => m.id);
    expect(order).toEqual(MINISTRIES.map(m => m.id));
  });
});

describe("parishHasConfirmedMinistries", () => {
  it("separates 'none yet' from 'we never asked'", () => {
    // The screen needs to tell these apart: a parish we have spoken to
    // that runs nothing reads differently from one we have not spoken
    // to at all, and both show an empty list.
    expect(parishHasConfirmedMinistries("route-mhcp")).toBe(true);
    expect(parishHasConfirmedMinistries("route-src")).toBe(true);
    expect(parishHasConfirmedMinistries("route-holy-trinity")).toBe(false);
    expect(parishHasConfirmedMinistries(undefined)).toBe(false);
  });
});
