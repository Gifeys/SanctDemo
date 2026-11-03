import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MembershipDoc } from "../lib/memberships";
import type { UserProfile } from "../types";

/**
 * The My Profile card, and the ministries inside it.
 *
 * The parish asked for the badges here rather than in a card of their
 * own on the Me tab, so the assertion worth having is that they render
 * WITHIN this card - not merely that they render somewhere.
 */
const h = vi.hoisted(() => ({
  rows: [] as MembershipDoc[],
  profile: null as UserProfile | null,
}));

vi.mock("../lib/firebase", () => ({
  auth: { currentUser: { uid: "u1" } },
  db: {},
}));
vi.mock("../lib/userProfile", () => ({
  getProfile: () => Promise.resolve(h.profile),
  updateProfile: vi.fn(() => Promise.resolve()),
}));
vi.mock("../lib/membershipStore", () => ({
  watchMyMemberships: (_uid: string, onRows: (r: MembershipDoc[]) => void) => {
    onRows(h.rows);
    return () => {};
  },
}));

import EditProfileCard from "./EditProfileCard";

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

beforeEach(() => {
  h.rows = [];
  h.profile = {
    uid: "u1",
    email: "juan@example.com",
    fullName: "Juan Dela Cruz",
    nickname: "Juan",
    churchId: "route-mhcp",
  } as UserProfile;
});

describe("My Profile", () => {
  it("shows the pilgrim's ministries inside the card", async () => {
    h.rows = [m(), m({ itemId: "min-choir", ministryName: "Marian Youth Choir" })];
    render(<EditProfileCard isLoggedIn />);

    // Waits on a ministry name rather than on the card's heading.
    //
    // The heading paints one commit before the memberships land, so
    // awaiting it and then reading textContent passed alone and failed
    // under load - the assertion ran against the paint in between.
    // Awaiting the thing being asserted has no such window.
    const ministry = await screen.findByText("Lectors and Commentators");
    expect(await screen.findByText("Marian Youth Choir")).toBeTruthy();
    expect(screen.getAllByText("Member")).toHaveLength(2);

    // Inside the My Profile card, not in a sibling card on the Me tab.
    // This is the part the parish asked for, so it is asserted by node
    // containment rather than by matching the card's classes - which
    // are a styling detail and would make this fail on a reskin.
    const card = screen.getByText("My Profile").parentElement!;
    expect(card.contains(ministry)).toBe(true);
    expect(card.textContent).toContain("My Ministries");
  });

  it("still shows the name and the heading alongside them", async () => {
    // The badges are an addition to this card, not a replacement for
    // what it was already for.
    h.rows = [m()];
    render(<EditProfileCard isLoggedIn />);

    expect(await screen.findByText("Juan")).toBeTruthy();
    expect(screen.getByText("juan@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit nickname/i })).toBeTruthy();
  });

  it("says what to do when the pilgrim serves in nothing yet", async () => {
    render(<EditProfileCard isLoggedIn />);
    expect(await screen.findByText(/not listed in a ministry yet/i)).toBeTruthy();
  });

  it("renders nothing at all when signed out", () => {
    const { container } = render(<EditProfileCard isLoggedIn={false} />);
    expect(container.firstChild).toBeNull();
  });
});
