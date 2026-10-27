import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import UsersOverTime from "./UsersOverTime";
import type { MonthlyUsers } from "../lib/pageEvents";

const month = (m: string, label: string, users: number): MonthlyUsers =>
  ({ month: m, label, users });

describe("UsersOverTime", () => {
  it("says so plainly when nothing has been recorded", () => {
    // Rather than an axis around an empty box, which reads as broken.
    render(<UsersOverTime data={[]} />);
    expect(screen.getByText(/No usage recorded yet/i)).toBeTruthy();
  });

  it("draws even a single month, rather than refusing to", () => {
    // This used to show a sentence instead, on the reasoning that one
    // point with no line reads as a fault. True, but it meant the
    // parish could never see the graph they had asked for during
    // their first months of use. The caller pads the window; this
    // component's job is to draw whatever it is given.
    render(<UsersOverTime data={[month("2026-10", "Oct 2026", 7)]} />);
    expect(document.querySelector("svg")).toBeTruthy();
  });

  it("draws one point per month", () => {
    render(<UsersOverTime data={[
      month("2026-09", "Sep 2026", 3),
      month("2026-10", "Oct 2026", 9),
      month("2026-11", "Nov 2026", 5),
    ]} />);
    const line = document.querySelector("polyline");
    expect(line?.getAttribute("points")?.split(" ")).toHaveLength(3);
  });

  it("puts a taller month higher up the chart", () => {
    // The one thing a line chart must get right. SVG y grows downward,
    // so the busier month has the SMALLER y.
    render(<UsersOverTime data={[
      month("2026-09", "Sep 2026", 2),
      month("2026-10", "Oct 2026", 20),
    ]} />);
    const [sep, oct] = document.querySelector("polyline")!
      .getAttribute("points")!.split(" ")
      .map(p => Number(p.split(",")[1]));
    expect(oct).toBeLessThan(sep);
  });

  it("describes itself for a screen reader", () => {
    render(<UsersOverTime data={[
      month("2026-09", "Sep 2026", 3),
      month("2026-10", "Oct 2026", 9),
    ]} />);
    expect(screen.getByRole("img", { name: /Sep 2026 to Oct 2026/i })).toBeTruthy();
  });

  it("leads with the most recent month", () => {
    render(<UsersOverTime data={[
      month("2026-09", "Sep 2026", 3),
      month("2026-10", "Oct 2026", 9),
    ]} />);
    // "Oct 2026" is also the last axis label, so this asks for the
    // summary line specifically rather than any mention of it.
    expect(screen.getByText(/most recent/i).textContent).toMatch(/Oct 2026/);
  });

  it("thins the month labels so they cannot collide", () => {
    // Twenty-four "Nov 2026" labels on a 360px screen is a smear.
    const many = Array.from({ length: 24 }, (_, i) =>
      month(`2026-${i}`, `M${i}`, i));
    render(<UsersOverTime data={many} />);
    const labels = [...document.querySelectorAll("text")]
      .filter(t => /^M\d+$/.test(t.textContent ?? ""));
    expect(labels.length).toBeLessThan(many.length);
    expect(labels.length).toBeGreaterThan(1);
  });

  it("survives a month where nobody opened it", () => {
    render(<UsersOverTime data={[
      month("2026-09", "Sep 2026", 0),
      month("2026-10", "Oct 2026", 0),
    ]} />);
    expect(document.querySelector("polyline")).toBeTruthy();
  });
});
