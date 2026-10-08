import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { findScroller } from "../lib/findScroller";
import { PARISH_HEADER_FACES, PARISH_HEADER_IMAGES, PARISH_PATRON_IMAGES } from "../data";
import { parishThemeStyle } from "../lib/parishTheme";

interface ParishSectionHeaderProps {
  /** Route id, so the photograph and the colours are this parish's. */
  routeId: string;
  /** The small line above the title: "Serve and Volunteer". */
  eyebrow: string;
  title: string;
  blurb?: string;
  /** Sits in the eyebrow, before the words. */
  icon?: ReactNode;
  /**
   * Collapses on scroll the way Home's welcome band does: the eyebrow and
   * blurb leave, the title shrinks and pins. Opt-in, because Ministries and
   * Sacraments are short pages where a band that moves would only twitch.
   */
  collapsing?: boolean;
}

/**
 * The element this band actually scrolls inside.
 *
 * findScroller looks for App's named .app-scroll first, which is right for
 * Home - but Ministries, Sacraments and Pray each declare their own
 * overflow-y-auto, and the content scrolls in THAT while .app-scroll never
 * moves. A listener on the wrong one reads the same number at every scroll
 * position, so the band measures a collapse and then never collapses.
 *
 * So: nearest ancestor that declares a scroll, whatever its current
 * content height; only then fall back to the named one.
 */
function scrollerFor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return findScroller(el);
}

/** The title's size once collapsed, over its size at rest. */
const PINNED_SCALE = 0.72;
/** Room above and below the title in the collapsed bar. */
const PINNED_PAD_TOP = 10;
const PINNED_PAD_BOTTOM = 10;

/**
 * The header on Ministries, Sacraments and the section pages like them.
 *
 * It used to be a flat navy panel with a giant faded outline icon in the
 * corner — the same panel on every screen, for every parish. Two things were
 * wrong with that. The colour was Mary Help's blue, so San Roque's ministries
 * were introduced in another parish's livery; and the decoration was a
 * clip-art icon where the app everywhere else uses the parish's own
 * photography.
 *
 * This is the welcome band from Home, reused: the patron's photograph bled in
 * from the right behind the words, the parish's own ink underneath, and the
 * one italic serif the design uses for a parish's name. A pilgrim moving
 * from Home into Ministries should not feel they have changed apps.
 */
export default function ParishSectionHeader({
  routeId,
  eyebrow,
  title,
  blurb,
  icon,
  collapsing = false,
}: ParishSectionHeaderProps) {
  // Where the patron's face sits in that photograph, as a fraction of its
  // height. Read before the collapse effect, which needs it to work out how
  // far to slide the picture.
  const face = PARISH_HEADER_FACES[routeId];

  const bandRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!collapsing) return;
    const band = bandRef.current;
    const titleEl = titleRef.current;
    if (!band || !titleEl) return;

    const view = scrollerFor(band);
    if (!view) return;

    let collapse = 0;
    let ticking = false;

    const measure = () => {
      // offsetTop, not a rect: the title already carries a transform by the
      // time this re-runs, and a rect would report the moved, scaled box -
      // so the maths driving the transform would read its own output.
      let titleTop = 0;
      let node: HTMLElement | null = titleEl;
      while (node && node !== band) {
        titleTop += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const titleHeight = titleEl.offsetHeight;
      const collapsedHeight = PINNED_PAD_TOP + titleHeight * PINNED_SCALE + PINNED_PAD_BOTTOM;
      const bandHeight = band.offsetHeight;
      collapse = Math.max(0, bandHeight - collapsedHeight);

      band.style.setProperty("--ps-collapse", `${collapse}px`);
      band.style.setProperty("--ps-title-dy", `${PINNED_PAD_TOP - titleTop + collapse}px`);
      band.style.setProperty("--ps-scale-delta", String(1 - PINNED_SCALE));

      // How far to slide the photograph DOWN so the patron's face lands in
      // the collapsed strip.
      //
      // Sticky with a negative top takes the band's TOP off screen, so what
      // survives is its bottom edge - and an untransformed photograph shows
      // its own bottom there, which on these frames is a hem. A fixed
      // parallax was the first attempt and cropped the face off at some
      // heights and not others, because the right amount depends on how
      // tall the band is and where the face sits in the picture.
      //
      // Clamped to [0, collapse] so the picture still covers the strip:
      // any further and its own edge would leave bare navy behind it.
      const faceFraction = face ?? 0.3;
      const photoDy = Math.min(
        collapse,
        Math.max(0, collapse - faceFraction * bandHeight + collapsedHeight / 2),
      );
      band.style.setProperty("--ps-photo-dy", `${photoDy}px`);
    };

    const apply = () => {
      ticking = false;
      if (collapse <= 0) {
        band.style.setProperty("--ps-t", "0");
        return;
      }
      const pushed = view.getBoundingClientRect().top - band.getBoundingClientRect().top;
      band.style.setProperty("--ps-t", Math.min(1, Math.max(0, pushed / collapse)).toFixed(4));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    const remeasure = () => { measure(); apply(); };

    remeasure();
    view.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(remeasure);
    resize.observe(view);
    resize.observe(band);
    return () => {
      view.removeEventListener("scroll", onScroll);
      resize.disconnect();
    };
  }, [collapsing, routeId, eyebrow, title, blurb, face]);
  const photo = PARISH_HEADER_IMAGES[routeId] ?? PARISH_PATRON_IMAGES[routeId];

  // Where the patron's face sits in that photograph, as a fraction of its
  // height. Without it the crop is top-aligned and Mary's face ends up
  // above the band while the band shows her hem.

  const style = {
    ...parishThemeStyle(routeId),
    ...(face != null ? { "--psh-face": `${Math.round(face * 100)}%` } : {}),
  } as CSSProperties;

  return (
    <header
      className={`parish-section${collapsing ? " parish-section--collapsing" : ""}`}
      style={style}
      ref={bandRef}
    >
      {photo && (
        <>
          <div
            className="parish-section__photo"
            style={{ backgroundImage: `url(${photo})` }}
            aria-hidden
          />
          {/* A scrim, not a shadow. These are gilded statues under warm
              light, so the brightness behind the text cannot be assumed: a
              shadow holds over dark vestments and vanishes over gold. */}
          <div className="parish-section__scrim" aria-hidden />
        </>
      )}

      <div className="parish-section__content">
        <p className="parish-section__eyebrow">
          {icon}
          {eyebrow}
        </p>
        <h2 className="parish-section__title" ref={titleRef}>{title}</h2>
        {blurb && <p className="parish-section__blurb">{blurb}</p>}
      </div>
    </header>
  );
}
