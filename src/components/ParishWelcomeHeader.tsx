import { useEffect, useRef } from "react";
import { MapPin, User } from "lucide-react";
import { findScroller } from "../lib/findScroller";

interface ParishWelcomeHeaderProps {
  parishName: string;
  location?: string;
  /** The parish's patron image, bled in behind the text from the right. */
  imageUrl?: string;
  /**
   * How far down that photograph the patron's face sits, 0 to 1. Given, the
   * collapse keeps the face in the bar; omitted, the picture stays
   * top-aligned and whatever survives the crop survives it.
   */
  imageFaceY?: number;
  /** First name of the signed-in pilgrim, or undefined when signed out. */
  firstName?: string;
  onOpenProfile: () => void;
  /** Rendered so the date matches the rest of the screen's clock. */
  now: Date;
}

/** The parish name's size once collapsed, over its size at rest: 21 of 27px. */
const PINNED_SCALE = 21 / 27;
/** Room above and below the name in the collapsed bar. */
const PINNED_PAD_TOP = 11;
const PINNED_PAD_BOTTOM = 9;

/**
 * How much of the scroll the photograph absorbs. At 0 it travels with the
 * band; at 1 it is nailed to the screen. Between them it drifts, which is
 * what reads as depth. Under reduced motion it becomes 1, so nothing moves
 * at a rate the finger did not ask for.
 */
const PHOTO_PARALLAX = 0.62;

/**
 * The welcome header from the design: a dark navy band with the parish's
 * patron image bleeding in from the right, the SanctiWalk mark, a greeting,
 * the date, the parish name and where it is.
 *
 * It replaces a date row plus a collapsing photograph. That earlier header
 * put the picture in a card with the name underneath, so the top of the
 * screen read as a list item rather than as arriving somewhere; the design
 * has the image behind everything, which is what makes it feel like the
 * parish's own page.
 *
 * The greeting degrades rather than inventing a name: signed out it reads
 * "Welcome" alone. The design shows "WELCOME, ADRICH" because the designer
 * was signed in.
 *
 * ## The collapse
 *
 * Scrolling must leave the parish name, its location and the patron picture
 * on screen — the answer to "which parish am I looking at" stays true no
 * matter how far down the page goes, and a header that takes its own title
 * away leaves everything below it unlabelled.
 *
 * It gets there by travelling, not by swapping. Every value tracks the
 * scroll position: the band slides up, the crest row, greeting and date fade
 * while sliding out of the way, the name shrinks to its smaller size, and
 * the photograph drifts up more slowly than the page so the collapse reads
 * as depth rather than as a picture being dragged off.
 *
 * ### Why it costs the page no height
 *
 * The obvious way — shrinking the band's height — was tried in an earlier
 * header and fights itself. A shorter band is a shorter page, and on a page
 * that is barely scrollable that pushes the maximum scroll position above
 * where the finger already is; the browser clamps scrollTop, the progress
 * falls, the band grows back, and the two settle against each other with the
 * band stuck half open.
 *
 * So nothing here changes layout. The band keeps its full height and is
 * `position: sticky` with a NEGATIVE top, which lets it scroll up by exactly
 * the amount that should disappear and then pin. Everything else is a
 * transform or an opacity, which the compositor can do without laying the
 * page out again. Picking the sticky offset as `height - collapsedHeight`
 * is what makes the band's own bottom edge arrive in the right place with no
 * height animation at all.
 *
 * JavaScript writes one custom property per frame, `--pw-t`, running 0 to 1.
 * The stylesheet derives every movement from it. If the script never runs,
 * `--pw-t` stays 0 and the band simply scrolls away like any other header.
 */
export default function ParishWelcomeHeader({
  parishName,
  location,
  imageUrl,
  imageFaceY,
  firstName,
  onOpenProfile,
  now,
}: ParishWelcomeHeaderProps) {
  const bandRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  /** The photograph's own pixel size, once the browser has told us. */
  const natural = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const band = bandRef.current;
    const title = titleRef.current;
    if (!band || !title) return;

    const view = findScroller(band);
    if (!view) return;

    let collapse = 0;
    let ticking = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const measure = () => {
      // offsetTop and offsetHeight, not rects: the title already carries a
      // transform by the time this re-runs, and a rect would report the
      // moved, scaled box — so the maths that drives the transform would be
      // reading its own output.
      const titleTop = offsetWithin(title, band);
      const titleHeight = title.offsetHeight;

      // The rounded lip along the band's bottom edge is the top of the
      // content sheet, drawn by the band so it travels with it. It covers
      // the band's last pixels, so the collapsed bar has to be tall enough
      // to clear it or the street address ends up underneath it. Read from
      // the stylesheet rather than repeated here.
      const lip = parseFloat(getComputedStyle(band, "::after").height) || 0;

      const collapsedHeight =
        PINNED_PAD_TOP + titleHeight * PINNED_SCALE + PINNED_PAD_BOTTOM + lip;
      collapse = Math.max(0, band.offsetHeight - collapsedHeight);

      band.style.setProperty("--pw-collapse", `${collapse}px`);
      // Where the title has to travel to land at PINNED_PAD_TOP from the top
      // of the screen once the band has slid up by `collapse`.
      band.style.setProperty("--pw-title-dy", `${PINNED_PAD_TOP - titleTop + collapse}px`);
      band.style.setProperty("--pw-scale-delta", String(1 - PINNED_SCALE));

      // The photograph's parallax. Reduced motion takes it to 1, which
      // holds the picture still rather than drifting it.
      const parallax = reduce.matches ? 1 : PHOTO_PARALLAX;
      band.style.setProperty("--pw-media-dy", `${parallax * collapse}px`);

      band.style.setProperty(
        "--pw-image-dy",
        `${faceOffset(imageRef.current, natural.current, imageFaceY, {
          collapse,
          collapsedHeight,
          lip,
          parallax,
        })}px`,
      );
    };

    const apply = () => {
      ticking = false;
      if (collapse <= 0) {
        band.style.setProperty("--pw-t", "0");
        return;
      }
      // How far the band has been pushed up past the top of the scroller.
      // Measured against the scroller rather than the window, because the
      // scroller starts partway down the page inside the desktop phone frame
      // and a window-relative reading is wrong by that offset.
      const pushed = view.getBoundingClientRect().top - band.getBoundingClientRect().top;
      const t = Math.min(1, Math.max(0, pushed / collapse));
      band.style.setProperty("--pw-t", t.toFixed(4));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    const remeasure = () => {
      measure();
      apply();
    };

    // The photograph is a CSS background, so its proportions are not on the
    // element. Asking for them separately reads the browser's cache — the
    // picture is already on screen — and remeasures once they arrive.
    let probe: HTMLImageElement | null = null;
    if (imageUrl && imageFaceY !== undefined && !natural.current) {
      probe = new window.Image();
      probe.onload = () => {
        natural.current = { w: probe!.naturalWidth, h: probe!.naturalHeight };
        remeasure();
      };
      probe.src = imageUrl;
    }

    remeasure();
    view.addEventListener("scroll", onScroll, { passive: true });
    reduce.addEventListener("change", remeasure);
    // The band's height moves with how many lines the parish name takes, and
    // the scroller's with the keyboard and the address bar.
    const resize = new ResizeObserver(remeasure);
    resize.observe(view);
    resize.observe(band);

    return () => {
      view.removeEventListener("scroll", onScroll);
      reduce.removeEventListener("change", remeasure);
      resize.disconnect();
      if (probe) probe.onload = null;
    };
  }, [parishName, location, imageUrl, imageFaceY, firstName]);

  const date = now
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  return (
    <header className="parish-welcome" ref={bandRef}>
      {/* Image and scrim share one wrapper so a single transform gives them
          the same parallax. Two transforms would drift apart under rounding
          and let the gradient slide off the text it exists to protect. */}
      <div className="parish-welcome__media" aria-hidden="true">
        {imageUrl && (
          <div
            className="parish-welcome__image"
            ref={imageRef}
            style={{ backgroundImage: `url("${imageUrl}")` }}
          />
        )}
        {/* Two scrims, not one. A single left-to-right fade left the parish
            name legible but washed the top row out; this darkens the whole
            band a little and the text side a lot. */}
        <div className="parish-welcome__scrim" />
      </div>

      <div className="parish-welcome__content">
        {/* Leaves with the scroll, so it is grouped: one transform and one
            opacity move the crest, the greeting and the date together. */}
        <div className="parish-welcome__intro">
          <div className="parish-welcome__top">
            <span className="parish-welcome__brand">
              <img src="/ui/diocese-crest.png" alt="" className="parish-welcome__crest" />
              SanctiWalk
            </span>

            <button
              type="button"
              onClick={onOpenProfile}
              className="parish-welcome__avatar"
              aria-label="Your profile"
            >
              <User className="w-[18px] h-[18px]" />
            </button>
          </div>

          <p className="parish-welcome__greeting">
            {firstName ? (
              <>
                Welcome,
                <br />
                {firstName}
              </>
            ) : (
              "Welcome"
            )}
          </p>

          <p className="parish-welcome__date">{date}</p>
        </div>

        {/* Stays, so it is grouped separately: it travels down inside the
            band by as much as the band travels up, which is what holds it on
            screen while everything above it leaves. */}
        <div className="parish-welcome__title" ref={titleRef}>
          <h1 className="parish-welcome__parish">{parishName}</h1>

          {location && (
            <p className="parish-welcome__location">
              <MapPin className="w-[15px] h-[15px] shrink-0" />
              {location}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * How far to shift the photograph, at full collapse, to put the patron's
 * face in the middle of the collapsed bar's clear area. Negative moves the
 * picture up, which brings a lower part of it into the bar.
 *
 * The band's visible remainder is `collapsedHeight`, and the sheet's rounded
 * lip covers its last pixels, so the area a face can actually be seen in is
 * what is left above that lip.
 *
 * `background-size: cover` scales the picture by whichever axis is short,
 * and `background-position: 50% 0%` aligns its top with the box's top — so
 * the face's row inside the box is simply its fraction of the scaled height.
 * Everything else here is bookkeeping: the band will have travelled up by
 * `collapse` and the picture back down by `parallax * collapse`, leaving
 * `slack` still to account for.
 *
 * Returns 0 when there is nothing to work with — no photograph, no measured
 * size, or no recorded face position — which leaves the plain top-aligned
 * crop the band has always had.
 */
function faceOffset(
  image: HTMLElement | null,
  natural: { w: number; h: number } | null,
  faceY: number | undefined,
  band: { collapse: number; collapsedHeight: number; lip: number; parallax: number },
): number {
  if (!image || !natural || faceY === undefined || band.collapse <= 0) return 0;
  if (!natural.w || !natural.h) return 0;

  const scale = Math.max(image.offsetWidth / natural.w, image.offsetHeight / natural.h);
  const scaledHeight = natural.h * scale;
  const faceRow = faceY * scaledHeight;
  const clearCentre = (band.collapsedHeight - band.lip) / 2;
  const slack = band.collapse * (1 - band.parallax);

  // Clamped so the photograph still covers the bar: any further down and its
  // top edge would leave a band of bare navy above it, any further up and
  // its bottom edge would leave one below.
  const lowest = band.collapsedHeight - scaledHeight + slack;
  return clamp(clearCentre - faceRow + slack, lowest, slack);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How far `el` sits below `ancestor`, in layout pixels.
 *
 * Walks offsetTop rather than subtracting bounding rects because offsetTop
 * ignores transforms, and everything here is transformed.
 */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}
