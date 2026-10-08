import { describe, it, expect } from "vitest";
import {
  loadFollowed, saveFollowed, isFollowing, withFollowed, remindableParishes,
  MAX_FOLLOWED,
} from "./followedParishes";

const HOME = "route-mhcp";
const AWAY = "route-src";

describe("following another parish", () => {
  it("adds one", () => {
    expect(withFollowed([], AWAY, true, HOME)).toEqual([AWAY]);
  });

  it("removes one", () => {
    expect(withFollowed([AWAY], AWAY, false, HOME)).toEqual([]);
  });

  it("does not add the same parish twice", () => {
    expect(withFollowed([AWAY], AWAY, true, HOME)).toEqual([AWAY]);
  });

  it("refuses to store your own parish", () => {
    // It is always included. Storing it would give two places an
    // opinion about where you belong, and the first bug would be a
    // pilgrim who moved parish and kept being woken by the old one.
    expect(withFollowed([], HOME, true, HOME)).toEqual([]);
  });

  it("retires the oldest when full rather than silently refusing", () => {
    const full = ["a", "b", "c", "d", "e"];
    const out = withFollowed(full, "f", true, HOME);
    expect(out).toHaveLength(MAX_FOLLOWED);
    expect(out).toContain("f");
    expect(out).not.toContain("a");
  });

  it("does not mutate the list it was given", () => {
    const before = [AWAY];
    withFollowed(before, "other", true, HOME);
    expect(before).toEqual([AWAY]);
  });
});

describe("which parishes get reminders", () => {
  it("is your own, even when you follow nothing", () => {
    expect(remindableParishes([], HOME)).toEqual([HOME]);
  });

  it("puts yours first, so the cap trims the others before it", () => {
    expect(remindableParishes([AWAY], HOME)).toEqual([HOME, AWAY]);
  });

  it("never lists a parish twice", () => {
    expect(remindableParishes([HOME, AWAY, AWAY], HOME)).toEqual([HOME, AWAY]);
  });

  it("copes with no home parish chosen yet", () => {
    expect(remindableParishes([AWAY], null)).toEqual([AWAY]);
    expect(remindableParishes([], null)).toEqual([]);
  });
});

describe("storage", () => {
  it("round-trips", () => {
    saveFollowed([AWAY]);
    expect(loadFollowed()).toEqual([AWAY]);
    expect(isFollowing(loadFollowed(), AWAY)).toBe(true);
  });

  it("ignores junk rather than passing it on as a parish id", () => {
    localStorage.setItem("sanctiwalk.followedParishes", JSON.stringify([1, null, "ok", ""]));
    expect(loadFollowed()).toEqual(["ok"]);
  });

  it("survives a corrupt value", () => {
    localStorage.setItem("sanctiwalk.followedParishes", "{not json");
    expect(loadFollowed()).toEqual([]);
  });
});
