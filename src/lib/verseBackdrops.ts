/**
 * The photograph behind the Verse of the Day.
 *
 * ## Why the parish's own pictures and not stock
 *
 * The brief points at Unsplash's Catholic photography for the feel, and
 * the feel is right: a verse set over a nave reads as prayer, where the
 * same words in a tinted box read as a notice. But the app already holds
 * photographs of these two churches, and this codebase has a standing rule
 * about that - a picture of some other parish's altar reads as a picture
 * of THIS parish, and it is not. Using the parish's own interiors gets the
 * same effect and tells the truth.
 *
 * Nothing is downloaded at runtime either, which matters on a phone in a
 * church with one bar of signal.
 *
 * ## Why it changes by the day and not at random
 *
 * Random means a new picture on every re-render - the verse would flicker
 * between photographs while you read it. Keyed to the date, the backdrop
 * is steady all day and different tomorrow.
 */

export interface Backdrop {
  url: string;
  /**
   * How far down the frame the subject sits, as a CSS background-position.
   * A nave photographed from the back has its altar near the middle; a
   * patron in a niche has a face near the top. Centring everything crops
   * the subject out of a short card.
   */
  position: string;
}

const BACKDROPS: Backdrop[] = [
  { url: "/parish/mass-gospel.jpg", position: "50% 45%" },
  { url: "/parish/mary-help-history.jpg", position: "50% 35%" },
  { url: "/parish/san-roque-church.jpg", position: "50% 40%" },
  { url: "/parish/sacraments-christening.jpg", position: "50% 40%" },
];

/** A stable day number, so the pick holds from midnight to midnight. */
function dayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function backdropForDate(date: Date = new Date()): Backdrop {
  const n = dayIndex(date);
  // Guard the negative case: dates before 1970 would index backwards off
  // the array and hand back undefined.
  const i = ((n % BACKDROPS.length) + BACKDROPS.length) % BACKDROPS.length;
  return BACKDROPS[i];
}

export const ALL_BACKDROPS = BACKDROPS;
