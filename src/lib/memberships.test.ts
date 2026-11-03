import { describe, it, expect } from "vitest";
import {
  membershipId,
  registrationTypeOf,
  registrationTypeLabel,
  isMember,
  myMinistries,
  alreadyMemberWarning,
  grantsMembership,
  revokesMembership,
  type MembershipDoc,
} from "./memberships";

function m(over: Partial<MembershipDoc> = {}): MembershipDoc {
  return {
    uid: "u1",
    churchId: "route-mhcp",
    itemId: "min-lectors",
    ministryName: "Lectors and Commentators",
    registrationType: "new_applicant",
    applicationId: "app-1",
    approvedAt: "2026-01-10T02:00:00.000Z",
    approvedBy: "adminA",
    ...over,
  };
}

describe("registrationTypeOf", () => {
  it("reads an absent type as a new applicant", () => {
    // Every application written before this field existed was one, so
    // this is what makes the feature need no migration.
    expect(registrationTypeOf(undefined)).toBe("new_applicant");
    expect(registrationTypeOf(null)).toBe("new_applicant");
  });

  it("does not let an unknown value through as a member", () => {
    // Anything but the one exact string is the safe reading. A typo in
    // a document must not confer membership.
    expect(registrationTypeOf("existing-member")).toBe("new_applicant");
    expect(registrationTypeOf("EXISTING_MEMBER")).toBe("new_applicant");
    expect(registrationTypeOf(true)).toBe("new_applicant");
    expect(registrationTypeOf("existing_member")).toBe("existing_member");
  });

  it("labels both types for the parish", () => {
    expect(registrationTypeLabel("existing_member")).toBe("Existing Member");
    expect(registrationTypeLabel("new_applicant")).toBe("New Applicant");
  });
});

describe("membershipId", () => {
  it("is the same id for the same person and ministry", () => {
    // This is what makes a double approval overwrite rather than
    // duplicate - including two admins pressing Approve at once.
    expect(membershipId("u1", "min-lectors")).toBe(membershipId("u1", "min-lectors"));
  });

  it("separates the parts with something neither part contains", () => {
    const id = membershipId("abc123", "min-altar-servers");
    expect(id).toBe("abc123__min-altar-servers");
    // Ministry ids carry single hyphens; splitting on the double
    // underscore recovers exactly two parts.
    expect(id.split("__")).toHaveLength(2);
  });

  it("gives one person a separate id per ministry", () => {
    // The reason revoking one membership cannot touch another.
    expect(membershipId("u1", "min-lectors")).not.toBe(membershipId("u1", "min-choir"));
  });
});

describe("isMember", () => {
  it("is true only for that person and that ministry", () => {
    const rows = [m({ uid: "u1", itemId: "min-lectors" })];
    expect(isMember(rows, "u1", "min-lectors")).toBe(true);
    expect(isMember(rows, "u1", "min-choir")).toBe(false);
    expect(isMember(rows, "u2", "min-lectors")).toBe(false);
  });

  it("is false when nobody is a member of anything", () => {
    expect(isMember([], "u1", "min-lectors")).toBe(false);
  });
});

describe("myMinistries", () => {
  it("lists only this person's ministries", () => {
    const rows = [m({ uid: "u1" }), m({ uid: "u2", itemId: "min-choir", ministryName: "Choir" })];
    expect(myMinistries(rows, "u1").map(r => r.itemId)).toEqual(["min-lectors"]);
  });

  it("holds its order as memberships arrive", () => {
    // Sorted by name, so approving a second ministry does not reshuffle
    // the list under somebody's finger.
    const rows = [
      m({ itemId: "min-ushers", ministryName: "Ushers" }),
      m({ itemId: "min-choir", ministryName: "Choir" }),
      m({ itemId: "min-lectors", ministryName: "Lectors" }),
    ];
    expect(myMinistries(rows, "u1").map(r => r.ministryName)).toEqual(["Choir", "Lectors", "Ushers"]);
  });

  it("does not mutate what it was given", () => {
    // It sorts, and the caller's array is very likely React state.
    const rows = [
      m({ itemId: "min-ushers", ministryName: "Ushers" }),
      m({ itemId: "min-choir", ministryName: "Choir" }),
    ];
    myMinistries(rows, "u1");
    expect(rows[0].ministryName).toBe("Ushers");
  });

  it("is empty for somebody who belongs to nothing", () => {
    expect(myMinistries([m({ uid: "u2" })], "u1")).toEqual([]);
  });
});

describe("alreadyMemberWarning", () => {
  it("says nothing to somebody who is in no other ministry", () => {
    expect(alreadyMemberWarning([], "u1", "min-choir")).toBeNull();
  });

  it("does not warn about the ministry being applied to", () => {
    // Re-applying to your own ministry is its own case; this warning is
    // about the ones you are keeping.
    const rows = [m({ itemId: "min-choir", ministryName: "Choir" })];
    expect(alreadyMemberWarning(rows, "u1", "min-choir")).toBeNull();
  });

  it("names the one ministry they already belong to", () => {
    const rows = [m({ itemId: "min-choir", ministryName: "Choir" })];
    const text = alreadyMemberWarning(rows, "u1", "min-lectors")!;
    expect(text).toContain("Choir");
    // It must not read as a refusal - the parish allows this.
    expect(text).toContain("may still apply");
    expect(text).toContain("will not change");
  });

  it("reads as a sentence when they belong to several", () => {
    const rows = [
      m({ itemId: "min-choir", ministryName: "Choir" }),
      m({ itemId: "min-ushers", ministryName: "Ushers" }),
    ];
    expect(alreadyMemberWarning(rows, "u1", "min-lectors")).toContain("Choir and Ushers");
  });

  it("does not warn one person about another person's memberships", () => {
    expect(alreadyMemberWarning([m({ uid: "u2" })], "u1", "min-choir")).toBeNull();
  });
});

describe("grantsMembership", () => {
  it("grants on an approved ministry application", () => {
    expect(grantsMembership("ministry", "approved")).toBe(true);
  });

  it("grants nothing for a sacrament", () => {
    // A sacrament is an event, not something you belong to.
    expect(grantsMembership("sacrament", "approved")).toBe(false);
  });

  it("grants nothing while a decision is still open", () => {
    for (const status of ["pending", "under_review", "rejected", "completed"]) {
      expect(grantsMembership("ministry", status)).toBe(false);
    }
  });
});

describe("revokesMembership", () => {
  it("takes the membership back when an approval is reversed", () => {
    // Otherwise somebody keeps a badge the parish has withdrawn.
    expect(revokesMembership("ministry", "rejected")).toBe(true);
    expect(revokesMembership("ministry", "pending")).toBe(true);
    expect(revokesMembership("ministry", "under_review")).toBe(true);
  });

  it("leaves the membership alone on approval or completion", () => {
    expect(revokesMembership("ministry", "approved")).toBe(false);
    expect(revokesMembership("ministry", "completed")).toBe(false);
  });

  it("never touches memberships over a sacrament decision", () => {
    expect(revokesMembership("sacrament", "rejected")).toBe(false);
  });
});
