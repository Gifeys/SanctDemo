import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The installed app must never open the page that advertises it.
 *
 * This shipped once: a WebView inside an APK is not a PWA, so the
 * display-mode test said "browser" and the Android app launched on its
 * own landing page. These tests exist so it cannot happen quietly a
 * second time.
 */

const isNativePlatform = vi.fn(() => false);

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
    getPlatform: () => (isNativePlatform() ? "android" : "web"),
  },
}));

// The app is a large tree with Firebase, maps and a camera behind it.
// None of that is what is under test here - the only question is which
// of the two things the root renders - so both sides are stubbed.
vi.mock("../App", () => ({ default: () => <div>THE APP</div> }));
vi.mock("./Landing", () => ({ default: () => <div>THE LANDING PAGE</div> }));
vi.mock("./Spotlight", () => ({
  SpotlightProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import RootGate from "./RootGate";

function renderGate() {
  return render(
    <MemoryRouter>
      <RootGate />
    </MemoryRouter>,
  );
}

/** Replaces matchMedia for one test. */
function setStandalone(standalone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: standalone && query.includes("standalone"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe("RootGate", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    setStandalone(false);
    delete (window.navigator as { standalone?: boolean }).standalone;
  });

  it("gives the installed Android app the app, not the advertisement", () => {
    // The regression that shipped. Capacitor reports native; nothing
    // else does, because a WebView matches no PWA display mode.
    isNativePlatform.mockReturnValue(true);
    renderGate();
    expect(screen.getByText("THE APP")).toBeTruthy();
    expect(screen.queryByText("THE LANDING PAGE")).toBeNull();
  });

  it("gives a plain browser the landing page", () => {
    renderGate();
    expect(screen.getByText("THE LANDING PAGE")).toBeTruthy();
    expect(screen.queryByText("THE APP")).toBeNull();
  });

  it("gives a home-screen PWA the app", () => {
    setStandalone(true);
    renderGate();
    expect(screen.getByText("THE APP")).toBeTruthy();
  });

  it("gives an iOS home-screen launch the app", () => {
    // iOS Safari predates the standard and uses its own flag.
    (window.navigator as { standalone?: boolean }).standalone = true;
    renderGate();
    expect(screen.getByText("THE APP")).toBeTruthy();
  });

  it("falls back to the landing page when the browser cannot be asked", () => {
    // A thrown matchMedia must not take the root down with it.
    window.matchMedia = (() => {
      throw new Error("no matchMedia");
    }) as unknown as typeof window.matchMedia;
    renderGate();
    expect(screen.getByText("THE LANDING PAGE")).toBeTruthy();
  });
});
