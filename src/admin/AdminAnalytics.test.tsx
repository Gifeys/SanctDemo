import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActivityEntry } from "../lib/analytics";

/**
 * The visitor activity screen.
 *
 * Reaching it in a browser needs an account whose role is church_admin,
 * and the rules deliberately make that a value no client can write, so
 * there is no way to produce one outside the Firebase console.
 * Rendering it directly is the honest alternative to "it compiles".
 *
 * Firestore is mocked at the module boundary: what is under test is what
 * the screen does with a parish's activity, not whether the rules would
 * hand it over. The rules have their own suite.
 */
const h = vi.hoisted(() => ({
  handler: { current: null as ((snap: unknown) => void) | null },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: (_q: unknown, next: (snap: unknown) => void) => {
    h.handler.current = next;
    return () => { h.handler.current = null; };
  },
}));
vi.mock("../lib/firebase", () => ({ db: {}, auth: { currentUser: { uid: "adminA" } } }));
vi.mock("../lib/authFlow", () => ({ signOutNow: vi.fn() }));

import AdminAnalytics from "./AdminAnalytics";
import type { AdminSession } from "./AdminApp";

const SESSION = {
  user: { uid: "adminA" },
  profile: { uid: "adminA", role: "church_admin", churchId: "route-mhcp", fullName: "Admin" },
  church: { id: "route-mhcp", name: "Mary Help of Christians Parish" },
} as unknown as AdminSession;

function deliver(entries: ActivityEntry[]) {
  h.handler.current?.({ docs: entries.map(e => ({ data: () => e })) });
}

function entry(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    uid: "u1",
    kind: "station_visit",
    summary: "Checked in at station st-1",
    churchId: "route-mhcp",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function show() {
  render(
    <MemoryRouter initialEntries={["/admin/analytics"]}>
      <AdminAnalytics session={SESSION} />
    </MemoryRouter>,
  );
}

beforeEach(() => { h.handler.current = null; });

describe("AdminAnalytics", () => {
  it("says nothing is recorded rather than drawing zeros", async () => {
    // A chart of zeros cannot distinguish "nobody came" from "we are
    // not measuring", and the parish would read it as the first.
    show();
    deliver([]);
    expect(await screen.findByText(/nothing recorded yet/i)).toBeTruthy();
  });

  it("counts distinct people, not events", async () => {
    show();
    deliver([entry({ uid: "a" }), entry({ uid: "a" }), entry({ uid: "b" })]);

    // "People" labels both the figure tile and a column of the daily
    // table, so the tile is found by its hint rather than its label.
    const tile = (await screen.findByText("distinct signed-in visitors")).parentElement!;
    expect(within(tile).getByText("2")).toBeTruthy();

    const events = screen.getByText("recorded events").parentElement!;
    expect(within(events).getByText("3")).toBeTruthy();
  });

  it("names stations rather than printing their ids", async () => {
    // "st-altar-mayor" is not an answer to "which part of my church do
    // people stop at".
    show();
    deliver([entry({ summary: "Checked in at station mhcp-altar" })]);

    await screen.findByText(/most visited stations/i);
    expect(screen.getByText("Main Altar & Tabernacle")).toBeTruthy();
    expect(screen.queryByText("mhcp-altar")).toBeNull();
  });

  it("surfaces an error from the database rather than an empty page", async () => {
    show();
    await waitFor(() => expect(h.handler.current).not.toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("never lists who visited", async () => {
    // The screen receives uids and must not render one. A parish asking
    // how many came is not asking who came.
    show();
    deliver([entry({ uid: "pilgrim-uid-7777" })]);

    await screen.findByText("distinct signed-in visitors");
    expect(screen.queryByText(/pilgrim-uid-7777/)).toBeNull();
  });
});
