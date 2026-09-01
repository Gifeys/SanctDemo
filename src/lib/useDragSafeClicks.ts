import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * Stops a swipe across a horizontal rail from firing the click of whatever
 * card the finger happened to start on.
 *
 * The cards in these rails are buttons, so a drag beginning on one is
 * ambiguous: the browser sees a pointer go down on a button and come up on
 * the same button, and reports a click — even though the rail scrolled
 * hundreds of pixels in between. Swiping the bulletin therefore opened
 * Ministries instead of moving the rail.
 *
 * CSS alone cannot fix this. `touch-action: pan-x` on the rail is overridden
 * by the button's own `auto`, and even with the panning corrected the click
 * still fires on release. So the movement is measured and the click is
 * cancelled in the capture phase, before it reaches the button's handler.
 *
 * Threshold is in pixels of travel, not time: a slow deliberate drag is still
 * a drag, and a fast tap is still a tap.
 */
const DRAG_THRESHOLD_PX = 8;

export function useDragSafeClicks(thresholdPx: number = DRAG_THRESHOLD_PX) {
  const startX = useRef(0);
  const startY = useRef(0);
  const dragged = useRef(false);

  const onPointerDown = useCallback((event: PointerEvent) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    dragged.current = false;
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (dragged.current) return;
      // Either axis counts. A diagonal flick that scrolls the page is just as
      // much "not a tap" as a horizontal one.
      if (
        Math.abs(event.clientX - startX.current) > thresholdPx ||
        Math.abs(event.clientY - startY.current) > thresholdPx
      ) {
        dragged.current = true;
      }
    },
    [thresholdPx],
  );

  const onClickCapture = useCallback((event: MouseEvent) => {
    if (!dragged.current) return;
    // Capture phase, so this runs before the card's own onClick.
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
  }, []);

  return { onPointerDown, onPointerMove, onClickCapture };
}
