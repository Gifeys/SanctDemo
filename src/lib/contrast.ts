// Contrast maths, so an admin choosing a parish colour cannot accidentally
// make the app unreadable.
//
// The palette in index.css was tuned pairing by pairing to clear WCAG AA.
// Letting someone pick an arbitrary colour throws that away unless the
// consequences are computed rather than hoped for — a pale gold that looks
// lovely in a colour picker renders white-on-white in a nave, to a
// congregation that includes people in their seventies.
//
// Pure and dependency-free so it can be tested directly.

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Parses "#RGB" or "#RRGGBB". Returns null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(value)) return null

  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** Relative luminance, per WCAG 2.1. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const WHITE: Rgb = { r: 250, g: 248, b: 244 } // --color-brand-on-accent
const INK: Rgb = { r: 20, g: 23, b: 31 } // --color-brand-text
const PAPER: Rgb = { r: 250, g: 248, b: 244 } // --color-brand-card

/**
 * The text colour to place ON a chosen background — whichever of ink or paper
 * reads better against it.
 *
 * This is what makes an admin colour picker safe rather than a hazard: the
 * admin chooses the background, the app chooses the text, and the pairing is
 * never left to chance.
 */
export function readableTextOn(background: Rgb): { hex: string; ratio: number } {
  const onInk = contrastRatio(background, INK)
  const onWhite = contrastRatio(background, WHITE)
  return onInk >= onWhite
    ? { hex: '#14171F', ratio: onInk }
    : { hex: '#FAF8F4', ratio: onWhite }
}

export interface ColourVerdict {
  ok: boolean
  /** Best achievable contrast for text placed on this colour. */
  onColourRatio: number
  /** Contrast of this colour used as text on the app's paper background. */
  asTextRatio: number
  /** Plain-language reason, or null when the colour is fine. */
  problem: string | null
}

/**
 * Whether a parish colour is safe to use.
 *
 * Two separate jobs are checked, because a brand colour does both in this app
 * and a colour can pass one and fail the other. A deep navy makes a fine
 * button but is barely distinguishable as a heading on paper; a pale gold
 * reads as a heading but gives a button no readable label.
 */
export function checkParishColour(hex: string): ColourVerdict {
  const rgb = parseHex(hex)
  if (!rgb) {
    return {
      ok: false,
      onColourRatio: 0,
      asTextRatio: 0,
      problem: 'That is not a valid colour. Use a hex value such as #1C2C56.',
    }
  }

  const onColour = readableTextOn(rgb).ratio
  const asText = contrastRatio(rgb, PAPER)

  // 4.5:1 is AA for normal text — the floor this app already holds itself to.
  if (onColour < 4.5) {
    return {
      ok: false,
      onColourRatio: onColour,
      asTextRatio: asText,
      problem: `Buttons in this colour would have hard-to-read labels (${onColour.toFixed(
        1,
      )}:1, needs 4.5:1). Try a darker or more saturated shade.`,
    }
  }

  if (asText < 4.5) {
    return {
      ok: false,
      onColourRatio: onColour,
      asTextRatio: asText,
      problem: `Headings in this colour would be too faint on the page background (${asText.toFixed(
        1,
      )}:1, needs 4.5:1). Try a darker shade.`,
    }
  }

  return { ok: true, onColourRatio: onColour, asTextRatio: asText, problem: null }
}
