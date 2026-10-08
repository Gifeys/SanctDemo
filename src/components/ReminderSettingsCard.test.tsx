import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReminderSettingsCard from "./ReminderSettingsCard";
import { DEFAULT_REMINDER_SETTINGS } from "../lib/reminderSchedule";

const base = {
  settings: DEFAULT_REMINDER_SETTINGS,
  update: vi.fn(),
  enable: vi.fn(),
  scheduled: 12,
  supported: true,
  permission: "granted" as const,
};

const PARISHES = [
  { id: "route-src", name: "San Roque Cathedral Parish", following: false },
  { id: "route-xyz", name: "Another Parish", following: true },
];

describe("following another parish", () => {
  // This control used to live on the parish's own dashboard. It moved
  // here because every other reminder setting is here, and because the
  // only way to follow a parish was otherwise to go and look at it
  // first. These tests are the ones that would have caught it becoming
  // unreachable in the move.
  it("offers every parish besides your own, followed or not", () => {
    render(<ReminderSettingsCard {...base} otherParishes={PARISHES} onToggleParish={vi.fn()} />);
    expect(screen.getByText("Other parishes")).toBeTruthy();
    expect(screen.getByLabelText("San Roque Cathedral Parish")).toBeTruthy();
    expect(screen.getByLabelText("Another Parish")).toBeTruthy();
  });

  it("shows which ones are already on", () => {
    render(<ReminderSettingsCard {...base} otherParishes={PARISHES} onToggleParish={vi.fn()} />);
    expect((screen.getByLabelText("San Roque Cathedral Parish") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Another Parish") as HTMLInputElement).checked).toBe(true);
  });

  it("reports the parish and the direction when switched", () => {
    const onToggleParish = vi.fn();
    render(<ReminderSettingsCard {...base} otherParishes={PARISHES} onToggleParish={onToggleParish} />);
    fireEvent.click(screen.getByLabelText("San Roque Cathedral Parish"));
    expect(onToggleParish).toHaveBeenCalledWith("route-src", true);
  });

  it("turns one off again", () => {
    const onToggleParish = vi.fn();
    render(<ReminderSettingsCard {...base} otherParishes={PARISHES} onToggleParish={onToggleParish} />);
    fireEvent.click(screen.getByLabelText("Another Parish"));
    expect(onToggleParish).toHaveBeenCalledWith("route-xyz", false);
  });

  it("says nothing at all when there is nowhere else to follow", () => {
    render(<ReminderSettingsCard {...base} otherParishes={[]} onToggleParish={vi.fn()} />);
    expect(screen.queryByText("Other parishes")).toBeNull();
  });

  it("is not offered before notifications are allowed", () => {
    // Switches that cannot produce a notification are switches that do
    // nothing, and the screen says why instead.
    render(
      <ReminderSettingsCard
        {...base}
        permission="prompt"
        otherParishes={PARISHES}
        onToggleParish={vi.fn()}
      />,
    );
    expect(screen.queryByText("Other parishes")).toBeNull();
    expect(screen.getByText(/Turn on reminders/i)).toBeTruthy();
  });

  it("says plainly that a browser cannot set alarms", () => {
    render(<ReminderSettingsCard {...base} supported={false} otherParishes={PARISHES} onToggleParish={vi.fn()} />);
    expect(screen.getByText(/installed SanctiWalk app/i)).toBeTruthy();
  });
});
