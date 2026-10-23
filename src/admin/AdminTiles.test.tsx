import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminTiles from "./AdminTiles";

function renderBoard() {
  return render(
    <MemoryRouter>
      <AdminTiles parishName="Mary Help of Christians Parish" />
    </MemoryRouter>,
  );
}

describe("AdminTiles", () => {
  it("names the parish, so an admin knows whose office they are in", () => {
    // Two parishes share this portal. A dashboard that just says
    // "Dashboard" is the one where somebody edits the wrong church.
    renderBoard();
    expect(
      screen.getByText(/Mary Help of Christians Parish Dashboard/i),
    ).toBeTruthy();
  });

  it("shows a door for every section the admin can actually open", () => {
    renderBoard();
    for (const label of [
      "Applications",
      "Mass Schedule",
      "Announcements",
      "Ministries",
      "Sacraments",
      "Visitor Activity",
      "Archive",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("has no tile for the pages that were folded into others", () => {
    // "What People Read" and "Open & Closed" each listed ministries AND
    // sacraments, so finishing one job meant visiting both; they are now
    // a page per kind. Feast Days and Events are boards on the
    // Announcements page rather than destinations of their own.
    renderBoard();
    for (const gone of ["What People Read", "Open & Closed", "Feast Days", "Events"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it("finds a section by what the parish calls it, not only by its label", () => {
    // "binyag" is not written on any tile, but it is what somebody is
    // thinking when they go looking for the baptism applications.
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "binyag" } });

    expect(screen.getByText("Applications")).toBeTruthy();
    expect(screen.queryByText("Mass Schedule")).toBeNull();
  });

  it("searches in English too", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mass" } });

    expect(screen.getByText("Mass Schedule")).toBeTruthy();
    expect(screen.queryByText("Archive")).toBeNull();
  });

  it("says so plainly when nothing matches", () => {
    // An empty grid with no explanation reads as a broken page.
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });

    expect(screen.getByText(/Nothing here matches/i)).toBeTruthy();
  });

  it("marks which sections the parish fills in itself", () => {
    // The ribbon carries the one fact that changes what you do next.
    renderBoard();
    expect(screen.getAllByText("Parish").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Automatic").length).toBeGreaterThan(0);
  });

  it("every tile is a real button, not a decorated div", () => {
    // Keyboard users reach the office the same way everyone else does.
    renderBoard();
    const tiles = screen
      .getAllByRole("button")
      .filter(b => b.className.includes("admin-tile"));
    expect(tiles).toHaveLength(7);
  });
});
