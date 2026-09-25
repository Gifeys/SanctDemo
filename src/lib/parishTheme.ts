/**
 * Each parish's own colours.
 *
 * SanctiWalk used to be navy everywhere. That navy is not the app's colour,
 * it is Mary Help of Christians' — the blue of Maria Auxiliadora's mantle,
 * taken off her page in "SANCTIWALK UI (1).psd" — and wearing it on San
 * Roque's screens said the wrong thing about whose church you were standing
 * in. Every parish gets its own livery, and Home, the parish page and the
 * history page all read from this one table.
 *
 * Three colours describe a parish, and everything else on screen is mixed
 * from them in CSS:
 *
 *   ink    the deep brand colour — headings, buttons, the primary token
 *   band   the near-black behind the full-bleed welcome photograph
 *   tint   the pale ground the content sheet sits on
 *
 * The pale steps (sunk surfaces, borders, the watermark behind each section)
 * are `color-mix` of ink into tint, which is why they are not listed: mixing
 * keeps them in the parish's hue automatically, where eight hand-picked
 * browns would drift. See `.home-bright` in index.css for the mixes.
 *
 * The panel pair is separate because it is doing a different job — it is the
 * gradient the history page's panel is painted with, sampled from the
 * artboard rather than derived, and it runs bright-to-dark rather than pale.
 *
 * Contrast was checked for every derived pair, not assumed. The worst case
 * across both parishes is the secondary text colour on its own ground at
 * 6.1:1, comfortably past AA; white on ink is 13.2:1 for Mary Help and
 * 9.4:1 for San Roque.
 */
export interface ParishTheme {
  ink: string;
  band: string;
  tint: string;
  /** The history panel's gradient: bright at the top, deep at the bottom. */
  panelTop: string;
  panelBottom: string;
}

const NAVY: ParishTheme = {
  ink: "#1B2A6B",
  band: "#101B4A",
  tint: "#EEF3FC",
  panelTop: "#3DA8EA",
  panelBottom: "#00204C",
};

const PARISH_THEMES: Record<string, ParishTheme> = {
  // Mary Help of Christians — the design's own navy, unchanged. Its derived
  // tints land within a few points of the hand-picked ones they replace.
  "route-mhcp": NAVY,

  // San Roque — the burnt orange of his habit and the warm cream of the
  // cathedral wall behind him, both off his artboard.
  "route-src": {
    ink: "#6B3A16",
    band: "#3A1F0C",
    tint: "#FAF1E8",
    panelTop: "#D37931",
    panelBottom: "#46280F",
  },
};

/**
 * A parish's livery. Parishes nobody has designed a page for keep the navy,
 * which is the app's existing appearance rather than a guess at theirs.
 */
export function parishTheme(routeId: string | null | undefined): ParishTheme {
  return (routeId && PARISH_THEMES[routeId]) || NAVY;
}

/**
 * The same theme as the custom properties the stylesheet reads.
 *
 * Spread onto the element that scopes the theme — Home's `.home-bright`, the
 * parish page's header, the history page. Everything below it recolours
 * through the tokens, so no component has to know which parish it is
 * rendering.
 */
export function parishThemeStyle(routeId: string | null | undefined): Record<string, string> {
  const theme = parishTheme(routeId);
  return {
    "--parish-ink": theme.ink,
    "--parish-band": theme.band,
    "--parish-tint": theme.tint,
    "--ph-top": theme.panelTop,
    "--ph-bottom": theme.panelBottom,
  };
}
