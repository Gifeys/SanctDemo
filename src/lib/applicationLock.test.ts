import { describe, expect, it } from "vitest";

import {
  LOCKING_STATUSES,
  TERMINAL_STATUSES,
  blockedMessage,
  isRestricted,
  releasesLock,
  stillHoldsLock,
} from "./applicationLock";
import { APPLICATION_STATUSES } from "../types";

describe("which statuses hold the lock", () => {
  it("holds it while the parish is still deciding", () => {
    expect(stillHoldsLock("pending")).toBe(true);
    expect(stillHoldsLock("under_review")).toBe(true);
  });

  it("releases it on approval, so a member may join another ministry", () => {
    // Requirement 3: being approved for one is not a reason to be
    // barred from asking about another.
    expect(releasesLock("approved")).toBe(true);
    expect(stillHoldsLock("approved")).toBe(false);
  });

  it("releases it on rejection, immediately", () => {
    expect(releasesLock("rejected")).toBe(true);
  });

  it("treats completed as terminal", () => {
    expect(releasesLock("completed")).toBe(true);
  });

  it("accounts for every status there is", () => {
    // A status added later and forgotten would fall through both
    // lists, and the lock would be held or released by accident.
    for (const status of APPLICATION_STATUSES) {
      expect(stillHoldsLock(status) || releasesLock(status)).toBe(true);
    }
  });

  it("never both holds and releases", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(stillHoldsLock(status) && releasesLock(status)).toBe(false);
    }
    expect(LOCKING_STATUSES.some(s => TERMINAL_STATUSES.includes(s))).toBe(false);
  });
});

describe("what the restriction applies to", () => {
  it("restricts ministries", () => {
    expect(isRestricted("ministry")).toBe(true);
  });

  it("leaves sacraments alone", () => {
    // Requirement 2. Somebody arranging a baptism has no reason to be
    // blocked from asking about a wedding.
    expect(isRestricted("sacrament")).toBe(false);
  });

  it("does not restrict something it has never heard of", () => {
    // Fail open for an unknown kind: a new kind of application should
    // not be silently blocked by a rule written before it existed.
    expect(isRestricted("retreat")).toBe(false);
  });
});

describe("blockedMessage", () => {
  it("says why, and when it lifts", () => {
    const text = blockedMessage("Lectors");
    expect(text).toMatch(/Lectors/);
    expect(text).toMatch(/once they have decided/i);
  });

  it("reads sensibly without a name", () => {
    expect(blockedMessage()).toMatch(/your application/i);
    expect(blockedMessage()).not.toMatch(/undefined/);
  });

  it("does not blame the pilgrim", () => {
    expect(blockedMessage("Choir")).not.toMatch(/you cannot|not allowed|denied/i);
  });
});
