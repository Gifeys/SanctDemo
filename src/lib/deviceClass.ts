/**
 * Phone or not, for the one decision that depends on it.
 *
 * ## Why this exists
 *
 * The root of the site serves two different things. On a laptop it is a
 * page about SanctiWalk, because somebody on a laptop is almost always
 * deciding whether to look rather than using it in a church. On a phone
 * it is the app, because a phone visitor already came to use it and a
 * promotional page in front of that is a toll gate.
 *
 * ## Why it is not `window.innerWidth < 768`
 *
 * A narrow browser window on a laptop is not a phone, and a tablet in
 * landscape is not a laptop. Width answers "how much room is there",
 * which is a layout question; this is a question about what kind of
 * device somebody is holding, and the pointer is the better signal -
 * a coarse pointer means a finger.
 *
 * Both are consulted, because neither is reliable alone. A desktop
 * browser's responsive-design mode reports a coarse pointer while
 * still being a laptop, and some Android tablets report a fine one.
 *
 * Pure, so the rule can be tested without a browser.
 */

export interface DeviceSignals {
  /** navigator.userAgent */
  userAgent: string;
  /** Viewport width in CSS pixels. */
  width: number;
  /** matchMedia('(pointer: coarse)').matches, when it can be asked. */
  coarsePointer: boolean;
}

/**
 * True when this is a phone - the device the app was designed for.
 *
 * iPads deliberately count as NOT a handset. The app's layout is built
 * for a phone held in one hand, and on a 10-inch screen the promotional
 * page is the better first impression; the Explore button is right
 * there for anyone who wants the app itself.
 */
export function isHandset({ userAgent, width, coarsePointer }: DeviceSignals): boolean {
  const ua = userAgent || '';

  // iPadOS reports itself as a Mac, so the usual iPad test fails. It is
  // caught by the touch check in the caller rather than guessed at here;
  // either way an iPad is not a handset, which is the answer we want.
  if (/iPad/i.test(ua)) return false;

  const saysPhone = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry/i.test(ua);
  if (saysPhone) return true;

  // Android without "Mobile" in the string is a tablet, by Google's own
  // convention. Not a handset.
  if (/Android/i.test(ua)) return false;

  // Nothing in the string says phone. Only treat it as one when the
  // screen is small AND the pointer is a finger - a laptop with a
  // narrow window fails the second test, which is the point.
  return coarsePointer && width > 0 && width <= 820;
}

/** Reads the signals from a real browser. */
export function readDeviceSignals(win: Window): DeviceSignals {
  let coarsePointer = false;
  try {
    coarsePointer = win.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  } catch {
    // Ancient or unusual browser. Falling back to false means it is
    // treated as a desktop, which shows the page explaining the app
    // rather than dropping somebody into an interface they did not ask
    // for - the safer of the two mistakes.
  }
  return {
    userAgent: win.navigator?.userAgent ?? '',
    width: win.innerWidth || 0,
    coarsePointer,
  };
}
