import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

interface ParishHeroProps {
  parishName: string;
  /** "Maypajo, Caloocan City" — shown under the name. */
  location?: string;
  /** The patron saint, shown over the image when there is one. */
  patron?: string;
  /**
   * A photograph of this parish's patron image. Absent for every parish whose
   * photography has not been collected, which is currently all of them — see
   * the note in Dashboard.
   */
  imageUrl?: string;
}

/** How tall the image is at rest, and over how much scroll it collapses. */
const HERO_HEIGHT_PX = 220;
const COLLAPSE_OVER_PX = 180;
/** The gap under the photograph, which collapses with it. */
const HERO_MARGIN_PX = 14;

/**
 * The collapsing parish header.
 *
 * The image shrinks in step with the scroll position rather than on a timer,
 * so it tracks the finger exactly and reverses when the finger does — a
 * duration-based animation always lags a scroll and feels detached from it.
 *
 * The name and location never collapse. They are the answer to "which parish
 * am I looking at", which stays true no matter how far down the screen is,
 * and a header that takes its own title away with the image leaves the rest
 * of the page unlabelled.
 *
 * When there is no photograph, this renders the name block alone — which is
 * simply the collapsed state, so nothing has to be designed twice and no
 * placeholder or stock image stands in for a parish it is not.
 */
export default function ParishHero({ parishName, location, patron, imageUrl }: ParishHeroProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  // A zero-height marker above the photograph. See `apply` for why the
  // collapse is measured from this rather than from scrollTop.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const sticky = stickyRef.current;
    if (!sticky) return;

    // The scroller is an ancestor (the tab content area in App.tsx), not this
    // component, so it has to be found rather than assumed.
    //
    // It must be one that ACTUALLY scrolls, not merely one declaring
    // overflow-y: auto. Several ancestors here declare it while comfortably
    // fitting their content, and stopping at the first of those pinned
    // scrollTop to a permanent zero: the listener fired, the maths ran, and
    // the photograph sat at full height at every scroll position.
    let scroller: HTMLElement | null = sticky.parentElement;
    while (scroller && scroller !== document.documentElement) {
      const overflowY = getComputedStyle(scroller).overflowY;
      const declaresScroll = overflowY === "auto" || overflowY === "scroll";
      if (declaresScroll && scroller.scrollHeight > scroller.clientHeight + 4) break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === document.documentElement) return;
    const view = scroller;

    // Whatever padding the scroller already had. The compensation below adds
    // to this rather than replacing it.
    const basePaddingBottom = parseFloat(getComputedStyle(view).paddingBottom) || 0;
    let ticking = false;

    const apply = () => {
      ticking = false;

      // Progress is measured from a sentinel ABOVE the photograph rather than
      // from the frame itself, so the reading cannot be moved by the very
      // collapse it is driving.
      const sentinel = sentinelRef.current;
      const travelled = sentinel
        ? view.getBoundingClientRect().top - sentinel.getBoundingClientRect().top
        : view.scrollTop;

      // The hairline under the pinned name, on only once it has actually
      // reached the top. Measured against the scroller, not the viewport:
      // the scroller starts partway down the window inside the phone frame,
      // so an IntersectionObserver against the viewport called it unstuck at
      // every position.
      sticky.dataset.stuck = String(
        sticky.getBoundingClientRect().top - view.getBoundingClientRect().top <= 1,
      );

      if (!frame || !imageUrl) return;

      const t = Math.min(1, Math.max(0, travelled / COLLAPSE_OVER_PX));
      const height = Math.round(HERO_HEIGHT_PX * (1 - t));
      const marginBottom = Math.round(HERO_MARGIN_PX * (1 - t));
      frame.style.height = `${height}px`;
      // Fades slightly ahead of the collapse so the last few pixels do not
      // pop out of existence.
      frame.style.opacity = String(Math.max(0, 1 - t * 1.15));
      // Margin collapses with it, or a gap is left behind where it was.
      frame.style.marginBottom = `${marginBottom}px`;
      // The 1px border top and bottom survives a zero height and leaves a
      // 2px hairline sitting where the photo was. Dropped once collapsed.
      frame.style.borderWidth = height === 0 ? "0" : "1px";

      // Hand the scroller back exactly the height the photograph just gave
      // up, and this is what makes the collapse finish at all.
      //
      // Shrinking the header shortens the page. Near the bottom that pushes
      // the maximum scroll position DOWN past where the finger already is,
      // the browser clamps scrollTop to the new maximum, the progress falls,
      // and the photograph grows back — which lengthens the page again. The
      // two settled against each other with the photo stuck part-open and
      // the scroll range collapsed from 386px to 220px. Padding the bottom
      // by the reclaimed amount keeps the scrollable height constant, so
      // there is nothing to clamp and the loop cannot start.
      const reclaimed = HERO_HEIGHT_PX - height + (HERO_MARGIN_PX - marginBottom);
      view.style.paddingBottom = `${basePaddingBottom + reclaimed}px`;
    };

    const onScroll = () => {
      // rAF-throttled and written straight to style: driving this through
      // React state would re-render the whole dashboard on every scroll frame.
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    view.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      view.removeEventListener("scroll", onScroll);
      view.style.paddingBottom = "";
    };
  }, [imageUrl]);

  // A fragment, not a wrapper element, and this matters more than it looks.
  // `position: sticky` is confined to its PARENT's box, so any wrapper here
  // would bound the pinned name to the height of the header rather than the
  // page — it would unstick and scroll away the moment the header block
  // ended, which is exactly what it did when this rendered a <header>. With
  // no wrapper, the caller's own container becomes the containing block.
  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-0" />

      {imageUrl && (
        <div
          ref={frameRef}
          // overflow-hidden is what makes the collapse read as a shrinking
          // window onto the photo; the img inside keeps its own aspect ratio
          // via object-cover, so nothing squashes as the frame loses height.
          className="relative mx-5 overflow-hidden rounded-[22px] border border-[var(--color-brand-border)] will-change-[height,opacity]"
          style={{ height: HERO_HEIGHT_PX, marginBottom: HERO_MARGIN_PX }}
        >
          <img
            src={imageUrl}
            alt={patron ? `${patron}, ${parishName}` : parishName}
            className="w-full h-full object-cover"
            // Devotional photographs are almost always shot upright with the
            // figure in the upper half — a crowned statue in its niche, a
            // retablo, a facade. Cropping to the vertical centre of a portrait
            // photo in a landscape frame therefore lands on vestments rather
            // than the face. Biasing the focus upward frames the subject.
            style={{ objectPosition: "center 32%" }}
            loading="eager"
          />
          {patron && (
            <>
              {/* A gradient scrim rather than a drop-shadow alone. These are
                  photographs of gilded statues under warm light, so the
                  brightness under the caption is unpredictable — a shadow
                  holds up over dark vestments and disappears over gold. The
                  scrim guarantees the contrast whatever the photo does, and
                  reads as a caption band rather than text dropped on a face. */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 via-black/35 to-transparent"
              />
              <span className="absolute left-4 bottom-3 right-4 text-[15px] font-semibold text-white leading-snug">
                {patron}
              </span>
            </>
          )}
        </div>
      )}

      {/* Pinned to the top of the scroller, so once the photograph has
          collapsed the parish name is still on screen — which is the whole
          point of a collapsing header rather than one that simply scrolls
          away. It carries the page background and a hairline that appears
          only once it is actually stuck, so at rest it reads as ordinary
          text and while scrolling it reads as a bar. */}
      <div
        ref={stickyRef}
        className="sticky top-0 z-10 bg-[var(--color-brand-card)] pt-1.5 pb-2.5 px-5 transition-[border-color] duration-200 border-b border-transparent data-[stuck=true]:border-[var(--color-brand-border)]"
      >
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[var(--color-brand-text)]">
          {parishName}
        </h1>
        {location && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[16px] text-[var(--color-brand-secondary)]">
            <MapPin className="w-4 h-4 shrink-0 text-[var(--color-brand-primary)]" />
            {location}
          </p>
        )}
      </div>
    </>
  );
}
