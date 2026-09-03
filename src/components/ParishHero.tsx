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

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !imageUrl) return;

    // The scroller is an ancestor (the tab content area in App.tsx), not this
    // component, so it has to be found rather than assumed.
    let scroller: HTMLElement | null = frame.parentElement;
    while (scroller && scroller !== document.documentElement) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === document.documentElement) return;

    let ticking = false;

    const apply = () => {
      ticking = false;
      // 0 at the top, 1 once fully collapsed.
      const t = Math.min(1, Math.max(0, scroller!.scrollTop / COLLAPSE_OVER_PX));
      const height = Math.round(HERO_HEIGHT_PX * (1 - t));
      frame.style.height = `${height}px`;
      // Fades slightly ahead of the collapse so the last few pixels do not
      // pop out of existence.
      frame.style.opacity = String(Math.max(0, 1 - t * 1.15));
      // Margin collapses with it, or a gap is left behind where it was.
      frame.style.marginBottom = `${Math.round(14 * (1 - t))}px`;
      // The 1px border top and bottom survives a zero height and leaves a
      // 2px hairline sitting where the photo was. Dropped once collapsed.
      frame.style.borderWidth = height === 0 ? "0" : "1px";
    };

    const onScroll = () => {
      // rAF-throttled and written straight to style: driving this through
      // React state would re-render the whole dashboard on every scroll frame.
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller?.removeEventListener("scroll", onScroll);
  }, [imageUrl]);

  return (
    <header>
      {imageUrl && (
        <div
          ref={frameRef}
          // overflow-hidden is what makes the collapse read as a shrinking
          // window onto the photo; the img inside keeps its own aspect ratio
          // via object-cover, so nothing squashes as the frame loses height.
          className="relative overflow-hidden rounded-[22px] border border-[var(--color-brand-border)] will-change-[height,opacity]"
          style={{ height: HERO_HEIGHT_PX, marginBottom: 14 }}
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

      <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[var(--color-brand-text)]">
        {parishName}
      </h1>
      {location && (
        <p className="mt-0.5 flex items-center gap-1.5 text-[16px] text-[var(--color-brand-secondary)]">
          <MapPin className="w-4 h-4 shrink-0 text-[var(--color-brand-primary)]" />
          {location}
        </p>
      )}
    </header>
  );
}
