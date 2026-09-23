import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface RailDotsProps {
  /** The horizontally scrolling rail these dots belong to. */
  railRef: RefObject<HTMLElement | null>;
  /** Re-count the cards when this changes. */
  refreshKey: string;
}

/**
 * The dots under a swiping card rail: how many cards there are, which one
 * is in view, and a tap to go to any of them.
 *
 * A rail cut off at the screen edge gives no sign that it scrolls at all,
 * so the card hanging half off the right reads as a layout fault rather
 * than as an invitation to swipe. The dots say how much there is.
 *
 * The cards are read off the rail's own children rather than passed in, so
 * the count stays right as announcements come and go without the caller
 * having to tell this component anything about them.
 */
export default function RailDots({ railRef, refreshKey }: RailDotsProps) {
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);
  const cardsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const cards = [...rail.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
    cardsRef.current = cards;
    setCount(cards.length);
    if (cards.length < 2) return;

    let ticking = false;

    const apply = () => {
      ticking = false;
      let nearest = 0;
      let best = Infinity;
      cardsRef.current.forEach((card, i) => {
        const distance = Math.abs(offsetOf(rail, card));
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      });
      // Only ever set a different value: this runs on every scroll frame and
      // React would otherwise re-render the dots sixty times a second.
      setActive((current) => (current === nearest ? current : nearest));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    rail.addEventListener("scroll", onScroll, { passive: true });
    // Cards are sized in percentages of the rail, so every card moves when
    // the rail does — on rotation, or when a photograph finishes loading.
    const resize = new ResizeObserver(apply);
    resize.observe(rail);

    return () => {
      rail.removeEventListener("scroll", onScroll);
      resize.disconnect();
    };
  }, [railRef, refreshKey]);

  if (count < 2) return null;

  const goTo = (index: number) => {
    const rail = railRef.current;
    const card = cardsRef.current[index];
    if (!rail || !card) return;
    // Only the rail's own scrollLeft is touched. scrollIntoView would have
    // been shorter and can scroll the vertical ancestor too, jumping the
    // page out from under the finger that only asked for a card.
    rail.scrollTo({ left: rail.scrollLeft + offsetOf(rail, card), behavior: "smooth" });
  };

  return (
    // Rendered from the count rather than from the ref: a ref holds no
    // value on the first render and reading one during render is a lie about
    // what React has committed. `tablist` was wrong here too — these select
    // nothing and reveal no panel, they scroll a strip of cards.
    <div className="rail-dots" aria-label="Bulletin cards">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          className="rail-dots__hit"
          aria-current={i === active ? "true" : undefined}
          aria-label={`Card ${i + 1} of ${count}`}
          onClick={() => goTo(i)}
        >
          <span className="rail-dots__dot" />
        </button>
      ))}
    </div>
  );
}

/**
 * How far the rail would have to scroll to bring `card` to its resting
 * place. Zero means the card is already there.
 *
 * The rail snaps cards to its start behind a scroll-padding, so "there" is
 * that padding in from the left edge rather than the edge itself — reading
 * it from the computed style keeps this honest if the padding changes.
 */
function offsetOf(rail: HTMLElement, card: HTMLElement): number {
  const padLeft = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
  return card.getBoundingClientRect().left - rail.getBoundingClientRect().left - padLeft;
}
