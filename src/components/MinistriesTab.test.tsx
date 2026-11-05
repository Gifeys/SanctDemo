import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MembershipDoc } from "../lib/memberships";

/**
 * The warning before applying to a SECOND ministry.
 *
 * Written because the wiring from button to dialog was the one part
 * of this feature with no test behind it, and "it typechecks" is not
 * the same as "it appears". The parish asked for a box that stops you
 * before the form opens; this drives the real component and checks
 * that it does.
 *
 * Everything the tab reaches for is mocked at the module boundary -
 * parish content, photographs, the memberships subscription - because
 * what is under test is the decision to show the dialog, not whether
 * Firestore would hand the data over.
 */
const h = vi.hoisted(() => ({ memberships: [] as MembershipDoc[] }));

vi.mock("../lib/membershipStore", () => ({
  watchMyMemberships: (_uid: string, onRows: (r: MembershipDoc[]) => void) => {
    onRows(h.memberships);
    return () => {};
  },
  watchParishMemberships: () => () => {},
}));
vi.mock("../lib/itemPhoto", () => ({ watchItemPhotos: () => () => {} }));
vi.mock("../lib/useParishContent", () => ({ useParishContent: () => null }));
vi.mock("../lib/useLanguage", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("../lib/firebase", () => ({ auth: { currentUser: { uid: "u1" } }, db: {} }));

import MinistriesTab from "./MinistriesTab";
import { ministriesForParish } from "../data";

const PARISH = { id: "route-mhcp", name: "Mary Help of Christians Parish" };

function membership(itemId: string, ministryName: string): MembershipDoc {
  return {
    uid: "u1",
    churchId: "route-mhcp",
    itemId,
    ministryName,
    registrationType: "new_applicant",
    applicationId: "app-1",
    approvedAt: "2026-01-10T02:00:00.000Z",
    approvedBy: "adminA",
  };
}

function show() {
  render(
    <MinistriesTab
      parish={PARISH as never}
      uid="u1"
      userEmail="juan@example.com"
      onOpenSignIn={() => {}}
      onAddApplication={() => {}}
      myApplications={[]}
    />,
  );
}

/** The parish's ministries, so the test names real ones. */
const MINISTRIES = ministriesForParish("route-mhcp");
const FIRST = MINISTRIES[0];
const SECOND = MINISTRIES[1];

/** Opens a ministry's card so its Apply buttons are on screen. */
async function openCard(name: string) {
  fireEvent.click(await screen.findByText(name));
}

beforeEach(() => { h.memberships = []; });

describe("applying to another ministry while already a member", () => {
  it("has ministries to test against", () => {
    // Guards the fixtures: if the parish list ever empties, every
    // assertion below would pass vacuously.
    expect(FIRST).toBeTruthy();
    expect(SECOND).toBeTruthy();
    expect(FIRST.id).not.toBe(SECOND.id);
  });

  it("warns, and does not open the form, until Continue is pressed", async () => {
    // The parish's requirement in one test: a box BEFORE the form,
    // naming what they already serve in, with a way onward.
    h.memberships = [membership(FIRST.id, FIRST.name)];
    show();
    await openCard(SECOND.name);

    fireEvent.click(await screen.findByRole("button", { name: /apply now/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("You already serve in a ministry");
    expect(dialog.textContent).toContain(FIRST.name);

    // Still the list, not the application form.
    expect(screen.queryByText(/check this over/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("goes back to the list when they cancel", async () => {
    h.memberships = [membership(FIRST.id, FIRST.name)];
    show();
    await openCard(SECOND.name);
    fireEvent.click(await screen.findByRole("button", { name: /apply now/i }));

    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /apply now/i })).toBeTruthy();
  });

  it("does not warn somebody who serves in nothing yet", async () => {
    // A dialog with nothing to warn about is a tap for its own sake.
    show();
    await openCard(SECOND.name);
    fireEvent.click(await screen.findByRole("button", { name: /apply now/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not warn about the ministry being applied to", async () => {
    // Being a member of THIS one is a different case - the card shows
    // a MEMBER badge instead of an Apply button.
    h.memberships = [membership(SECOND.id, SECOND.name)];
    show();
    await openCard(SECOND.name);

    expect(await screen.findByText("Member")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /apply now/i })).toBeNull();
  });

  it("warns on the existing-member door too", async () => {
    // The answer must not depend on which button was pressed.
    h.memberships = [membership(FIRST.id, FIRST.name)];
    show();
    await openCard(SECOND.name);

    fireEvent.click(await screen.findByRole("button", { name: /already a server/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain(FIRST.name);
  });
});
