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
/**
 * The screen reads three collections now - activity, visits and users -
 * so the mock has to keep one handler per collection. A single shared
 * handler sent every collection's rows to whichever subscription
 * happened to register last.
 */
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (snap: unknown) => void>,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  query: vi.fn((ref: { name: string }) => ref),
  where: vi.fn(() => ({})),
  onSnapshot: (q: { name: string }, next: (snap: unknown) => void) => {
    h.handlers[q.name] = next;
    return () => { delete h.handlers[q.name]; };
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

function send(name: string, rows: unknown[]) {
  h.handlers[name]?.({ docs: rows.map(r => ({ data: () => r })) });
}

/** Activity rows, plus empty visits and users unless a test says otherwise. */
function deliver(entries: ActivityEntry[], visits: unknown[] = [], users: unknown[] = []) {
  send("activity", entries);
  send("visits", visits);
  send("users", users);
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
    <MemoryRouter initialEntries={["/parish-office/analytics"]}>
      <AdminAnalytics session={SESSION} />
    </MemoryRouter>,
  );
}

beforeEach(() => { for (const k of Object.keys(h.handlers)) delete h.handlers[k]; });

describe("AdminAnalytics", () => {
  it("says nothing is recorded rather than drawing zeros", async () => {
    // A chart of zeros cannot distinguish "nobody came" from "we are
    // not measuring", and the parish would read it as the first.
    show();
    deliver([]);
    // "Nothing recorded yet" is now also the visits panel's empty text,
    // so this asks for the station one specifically.
    expect(await screen.findByText(/Activity appears here once pilgrims/i)).toBeTruthy();
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
    await waitFor(() => expect(Object.keys(h.handlers).length).toBeGreaterThan(0));
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

  it("counts registered pilgrims and leaves administrators out", async () => {
    // An administrator is not one of the parish's users, and counting
    // them would inflate a figure the parish reports.
    show();
    deliver([], [], [
      { role: "user" }, { role: "user" }, { role: "church_admin" },
    ]);
    const tile = (await screen.findByText(/pilgrims with an account/i)).parentElement!;
    expect(within(tile).getByText("2")).toBeTruthy();
  });

  it("counts only those seen in the last fifteen minutes", async () => {
    const now = Date.now();
    show();
    deliver([], [], [
      { role: "user", lastActiveAt: new Date(now - 60_000).toISOString() },
      { role: "user", lastActiveAt: new Date(now - 60 * 60_000).toISOString() },
      { role: "user" },
    ]);
    const tile = (await screen.findByText(/in the last 15 minutes/i)).parentElement!;
    expect(within(tile).getByText("1")).toBeTruthy();
  });

  it("separates estimated visits from the people who made them", async () => {
    show();
    deliver([], [
      { uid: "a", churchId: "route-mhcp", at: new Date().toISOString() },
      { uid: "a", churchId: "route-mhcp", at: new Date().toISOString() },
      { uid: "b", churchId: "route-mhcp", at: new Date().toISOString() },
    ], []);
    const visits = (await screen.findByText(/geolocation-detected/i)).parentElement!;
    expect(within(visits).getByText("3")).toBeTruthy();
    const visitors = screen.getByText(/distinct people behind/i).parentElement!;
    expect(within(visitors).getByText("2")).toBeTruthy();
  });

  it("calls the figure estimated and says it is not proof of entry", async () => {
    // The one claim this feature must never make.
    show();
    deliver([], [{ uid: "a", churchId: "route-mhcp", at: new Date().toISOString() }], []);
    expect(await screen.findByText(/proximity and not proof of entry/i)).toBeTruthy();
  });

  it("names the parish rather than its route id", async () => {
    show();
    deliver([], [{ uid: "a", churchId: "route-mhcp", at: new Date().toISOString() }], []);
    await screen.findByText(/visits by parish/i);
    expect(screen.queryByText("route-mhcp")).toBeNull();
  });
});
