/** The class App.tsx puts on the one element that scrolls tab content. */
const SCROLLER_CLASS = "app-scroll";

/**
 * The element that scrolls around `el`.
 *
 * Normally that is the named tab-content scroller in App.tsx. Finding it by
 * name rather than by measurement matters: the measurement below can only
 * recognise a scroller that already has somewhere to scroll to, so on the
 * first commit — before images have loaded and the page is still shorter
 * than the screen — it finds nothing, and a caller that runs once on mount
 * then never gets a second chance.
 *
 * The measurement is kept as a fallback for any scroller without the class.
 * It insists on an element that ACTUALLY scrolls, because several ancestors
 * here declare `overflow-y: auto` while comfortably fitting their content,
 * and stopping at the first of those returns an element whose scrollTop is
 * a permanent zero — a listener on it fires and every reading comes back
 * the same at every scroll position.
 *
 * Returns null when nothing scrolls. Callers should treat that as "no
 * scroll behaviour to attach" rather than as an error.
 */
export function findScroller(el: HTMLElement): HTMLElement | null {
  const named = el.closest<HTMLElement>(`.${SCROLLER_CLASS}`);
  if (named) return named;

  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    const declaresScroll = overflowY === "auto" || overflowY === "scroll";
    if (declaresScroll && node.scrollHeight > node.clientHeight + 4) return node;
    node = node.parentElement;
  }
  return null;
}
