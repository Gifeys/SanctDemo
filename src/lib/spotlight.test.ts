import { describe, it, expect } from "vitest";
import {
  placeSpotlight, holeFor, isUsableTarget,
  HOLE_PADDING, SCREEN_MARGIN, ARROW_INSET,
  type Rect,
} from "./spotlight";

// A phone, which is the only shape this ever runs on.
const PHONE = { width: 390, height: 844 };
const CARD = 150;

const rect = (over: Partial<Rect> = {}): Rect => ({
  top: 300, left: 100, width: 120, height: 48, ...over,
});

describe("the hole", () => {
  it("is the target with room around it", () => {
    const hole = holeFor(rect(), PHONE);
    expect(hole.top).toBe(300 - HOLE_PADDING);
    expect(hole.left).toBe(100 - HOLE_PADDING);
    expect(hole.width).toBe(120 + HOLE_PADDING * 2);
    expect(hole.height).toBe(48 + HOLE_PADDING * 2);
  });

  it("does not hang off the screen for something flush against an edge", () => {
    // The tab bar sits on the bottom edge. Padding it blindly puts the
    // hole partly off-screen and the dimming reads as a seam.
    const tabBar = rect({ top: 796, left: 0, width: 390, height: 48 });
    const hole = holeFor(tabBar, PHONE);
    expect(hole.left).toBe(0);
    expect(hole.top + hole.height).toBe(PHONE.height);
    expect(hole.left + hole.width).toBe(PHONE.width);
  });
});

describe("where the card goes", () => {
  it("sits below the target when there is room", () => {
    const p = placeSpotlight(rect({ top: 200 }), PHONE, CARD);
    expect(p.card.top).toBeGreaterThan(200);
    expect(p.arrow).toBe("top");
  });

  it("goes above when the target is near the bottom", () => {
    // The commonest case in this app: every tutorial step about the tab
    // bar. Below would run off the screen.
    const tabBar = rect({ top: 780, left: 20, width: 70, height: 50 });
    const p = placeSpotlight(tabBar, PHONE, CARD);
    expect(p.card.top + CARD).toBeLessThan(780);
    expect(p.arrow).toBe("bottom");
  });

  it("never runs off the top or the bottom", () => {
    for (const top of [0, 50, 400, 700, 800, 840]) {
      const p = placeSpotlight(rect({ top, height: 44 }), PHONE, CARD);
      expect(p.card.top).toBeGreaterThanOrEqual(SCREEN_MARGIN);
      expect(p.card.top + CARD).toBeLessThanOrEqual(PHONE.height - SCREEN_MARGIN + 1);
    }
  });

  it("drops the arrow rather than pointing at something it covers", () => {
    // A target taller than the screen minus the card - the map fills the
    // whole view - leaves nowhere to sit beside it.
    const wholeScreen = rect({ top: 0, left: 0, width: 390, height: 844 });
    const p = placeSpotlight(wholeScreen, PHONE, CARD);
    expect(p.arrow).toBe("none");
  });
});

describe("staying on screen sideways", () => {
  it("centres under the target when it can", () => {
    const p = placeSpotlight(rect({ left: 135, width: 120 }), PHONE, CARD);
    const cardCentre = p.card.left + p.card.width / 2;
    expect(Math.abs(cardCentre - 195)).toBeLessThan(1);
  });

  it("does not run off the left for a target in the corner", () => {
    const p = placeSpotlight(rect({ left: 4, width: 48 }), PHONE, CARD);
    expect(p.card.left).toBeGreaterThanOrEqual(SCREEN_MARGIN);
  });

  it("does not run off the right either", () => {
    const p = placeSpotlight(rect({ left: 330, width: 48 }), PHONE, CARD);
    expect(p.card.left + p.card.width).toBeLessThanOrEqual(PHONE.width - SCREEN_MARGIN);
  });

  it("fits a narrow phone", () => {
    const narrow = { width: 320, height: 568 };
    const p = placeSpotlight(rect({ top: 100 }), narrow, CARD);
    expect(p.card.width).toBeLessThanOrEqual(narrow.width - SCREEN_MARGIN * 2);
    expect(p.card.left).toBeGreaterThanOrEqual(SCREEN_MARGIN);
  });
});

describe("the arrow", () => {
  it("points at the middle of the target", () => {
    const p = placeSpotlight(rect({ left: 135, width: 120 }), PHONE, CARD);
    const arrowX = p.card.left + p.arrowOffset;
    expect(Math.abs(arrowX - 195)).toBeLessThan(1);
  });

  it("stays clear of the card's rounded corners", () => {
    // A target hard against the screen edge would otherwise put the
    // arrow on the corner radius, where it reads as a glitch.
    for (const left of [0, 6, 360, 384]) {
      const p = placeSpotlight(rect({ left, width: 40 }), PHONE, CARD);
      expect(p.arrowOffset).toBeGreaterThanOrEqual(ARROW_INSET);
      expect(p.arrowOffset).toBeLessThanOrEqual(p.card.width - ARROW_INSET);
    }
  });
});

describe("targets worth spotlighting", () => {
  it("rejects one that is not on screen", () => {
    // An element on an inactive tab still has a rect: an empty one at
    // the origin. Spotlighting it puts a hole in the corner and a card
    // pointing at nothing.
    expect(isUsableTarget({ top: 0, left: 0, width: 0, height: 0 })).toBe(false);
    expect(isUsableTarget(null)).toBe(false);
    expect(isUsableTarget(undefined)).toBe(false);
  });

  it("accepts a real one", () => {
    expect(isUsableTarget(rect())).toBe(true);
  });
});
