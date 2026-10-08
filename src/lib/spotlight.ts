/**
 * Where to put a spotlight cut-out and the card that explains it.
 *
 * ## Why this is separate from the component
 *
 * Placing a callout next to a highlighted button is almost entirely
 * arithmetic, and all of it is wrong at least once: the card runs off
 * the bottom when the target is the tab bar, off the top when it is the
 * header, off the side when the target is in a corner, and the little
 * arrow ends up pointing at nothing. None of that needs a browser to
 * get right, and none of it is testable once it is tangled up in a
 * render.
 *
 * Everything here takes plain rectangles and returns plain numbers.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Breathing room between the cut-out and the thing it is cutting around. */
export const HOLE_PADDING = 8;

/** Gap between the cut-out and the card. */
export const CARD_GAP = 14;

/** Closest the card may come to the edge of the screen. */
export const SCREEN_MARGIN = 12;

/** The arrow's width, used to keep it inside the card's rounded corners. */
export const ARROW_INSET = 22;

export interface Placement {
  /** The hole, already padded. */
  hole: Rect;
  /** Where the card goes. */
  card: { top: number; left: number; width: number };
  /** Which side of the card the arrow sits on. */
  arrow: "top" | "bottom" | "none";
  /** How far along the card's edge the arrow points, in px from its left. */
  arrowOffset: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Grows the target rect by the padding, clipped to the screen.
 *
 * Clipped because a target flush against an edge — the tab bar is — would
 * otherwise produce a hole hanging off the screen, and the dimming
 * around it stops looking like a hole and starts looking like a seam.
 */
export function holeFor(target: Rect, viewport: Viewport): Rect {
  const top = Math.max(0, target.top - HOLE_PADDING);
  const left = Math.max(0, target.left - HOLE_PADDING);
  const right = Math.min(viewport.width, target.left + target.width + HOLE_PADDING);
  const bottom = Math.min(viewport.height, target.top + target.height + HOLE_PADDING);
  return { top, left, width: right - left, height: bottom - top };
}

/**
 * Works out where the card goes relative to the hole.
 *
 * Below the target when it fits, above when it does not. Preferring
 * below is not arbitrary: most of what gets highlighted here is in the
 * upper half of the screen, and a card under the target leaves the
 * target itself unobscured by the hand holding the phone.
 *
 * When neither side fits — a target taller than the gap on both sides,
 * which the full-screen map is — the card is pinned to the bottom and
 * loses its arrow rather than pointing at something it is covering.
 */
export function placeSpotlight(
  target: Rect,
  viewport: Viewport,
  cardHeight: number,
): Placement {
  const hole = holeFor(target, viewport);

  const width = Math.min(viewport.width - SCREEN_MARGIN * 2, 360);
  const left = clamp(
    hole.left + hole.width / 2 - width / 2,
    SCREEN_MARGIN,
    Math.max(SCREEN_MARGIN, viewport.width - width - SCREEN_MARGIN),
  );

  const below = hole.top + hole.height + CARD_GAP;
  const above = hole.top - CARD_GAP - cardHeight;

  let top: number;
  let arrow: Placement["arrow"];

  if (below + cardHeight + SCREEN_MARGIN <= viewport.height) {
    top = below;
    arrow = "top"; // the arrow is on the card's top edge, pointing up
  } else if (above >= SCREEN_MARGIN) {
    top = above;
    arrow = "bottom";
  } else {
    top = Math.max(SCREEN_MARGIN, viewport.height - cardHeight - SCREEN_MARGIN);
    arrow = "none";
  }

  // Pointing at the centre of the hole, but never so close to a corner
  // that it collides with the card's radius.
  const arrowOffset = clamp(
    hole.left + hole.width / 2 - left,
    ARROW_INSET,
    Math.max(ARROW_INSET, width - ARROW_INSET),
  );

  return { hole, card: { top, left, width }, arrow, arrowOffset };
}

/**
 * True when the element is actually on screen.
 *
 * A target that is scrolled out of view, or hidden because its tab is
 * not the active one, still has a rect — an empty one at the origin.
 * Spotlighting that puts a hole in the top-left corner and a card
 * pointing at nothing, which is how a tutorial step looks broken.
 */
export function isUsableTarget(rect: Rect | null | undefined): boolean {
  if (!rect) return false;
  if (rect.width <= 1 || rect.height <= 1) return false;
  return true;
}
