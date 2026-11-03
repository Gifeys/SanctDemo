import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MembershipDoc } from "../lib/memberships";

/**
 * The My Ministries card.
 *
 * The store is mocked at the module boundary: what is under test is
 * what the card shows for a given set of memberships, not whether the
 * rules would hand them over. The rules have their own suite.
 */
const h = vi.hoisted(() => ({
  rows: [] as MembershipDoc[],
  uid: "u1" as string | null,
}));

vi.mock("../lib/firebase", () => ({
  get auth() { return { currentUser: h.uid ? { uid: h.uid } : null }; },
  db: {},
}));
vi.mock("../lib/membershipStore", () => ({
  watchMyMemberships: (_uid: string, onRows: (r: MembershipDoc[]) => void) => {
    onRows(h.rows);
    return () => {};
  },
}));

import MyMinistries from "./MyMinistries";

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

beforeEach(() => { h.rows = []; h.uid = "u1"; });

describe("MyMinistries", () => {
  it("says what to do when the pilgrim serves in nothing", async () => {
    // An empty card that only states its own emptiness is a dead end.
    render(<MyMinistries />);
    expect(await screen.findByText(/not listed in a ministry yet/i)).toBeTruthy();
    expect(screen.getByText(/already serve in one/i)).toBeTruthy();
  });

  it("names each ministry and badges it", async () => {
    h.rows = [m(), m({ itemId: "min-choir", ministryName: "Marian Youth Choir" })];
    render(<MyMinistries />);

    expect(await screen.findByText("Lectors and Commentators")).toBeTruthy();
    expect(screen.getByText("Marian Youth Choir")).toBeTruthy();
    expect(screen.getAllByText("Member")).toHaveLength(2);
  });

  it("holds its order as a second membership arrives", async () => {
    // Sorted by name, so the list does not reshuffle under a finger.
    h.rows = [
      m({ itemId: "min-ushers", ministryName: "Ushers" }),
      m({ itemId: "min-choir", ministryName: "Choir" }),
    ];
    render(<MyMinistries />);

    const names = (await screen.findAllByText(/Ushers|Choir/)).map(n => n.textContent);
    expect(names).toEqual(["Choir", "Ushers"]);
  });

  it("never lists somebody else's membership", async () => {
    // The subscription is already scoped to the uid, and the card
    // filters again. Two cheap guards on a screen that shows a badge.
    h.rows = [m({ uid: "someone-else", ministryName: "Altar Servers" })];
    render(<MyMinistries />);

    expect(await screen.findByText(/not listed in a ministry yet/i)).toBeTruthy();
    expect(screen.queryByText("Altar Servers")).toBeNull();
  });

  it("renders nothing at all when signed out", () => {
    h.uid = null;
    const { container } = render(<MyMinistries />);
    expect(container.firstChild).toBeNull();
  });
});
