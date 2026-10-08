import { useCallback, useEffect, useRef, useState } from "react";
import { useSpotlight, SPOTLIGHT_ATTR } from "./Spotlight";
import {
  TUTORIAL_STEPS, markTutorialSeen, nextUsableStep,
  type TutorialTab,
} from "../lib/tutorial";

/**
 * Walks the pilgrim through the app once.
 *
 * ## Why this drives the spotlight rather than drawing its own
 *
 * Sancti points things out with the same hole and the same card. One
 * implementation means the assistant saying "the Map is here" looks
 * like the app that showed you round on your first morning, instead of
 * like a second feature bolted on beside the first.
 *
 * ## Why each step waits before measuring
 *
 * A step can ask for a different tab, and the target does not exist
 * until that tab has rendered. Measuring in the same tick finds
 * nothing and the step gets skipped as missing. One frame of delay is
 * the difference between a tutorial that works and one that silently
 * drops half its steps.
 */
export default function TutorialRunner({
  open,
  onClose,
  onSwitchTab,
}: {
  open: boolean;
  onClose: () => void;
  onSwitchTab: (tab: TutorialTab) => void;
}) {
  const spotlight = useSpotlight();
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  // So move() can read where it is without putting a side effect in a
  // state updater. See move() below.
  const indexRef = useRef(0);
  indexRef.current = index;

  // Held in a ref so the effect that shows a step does not re-run every
  // time one of these functions is re-created.
  const api = useRef({ spotlight, onSwitchTab, onClose });
  api.current = { spotlight, onSwitchTab, onClose };

  const present = useCallback(
    (target: string) =>
      !!document.querySelector(`[${SPOTLIGHT_ATTR}="${CSS.escape(target)}"]`),
    [],
  );

  const finish = useCallback(() => {
    markTutorialSeen();
    api.current.spotlight.hide();
    setFinished(true);
  }, []);

  const close = useCallback(() => {
    markTutorialSeen();
    api.current.spotlight.hide();
    setFinished(false);
    setIndex(0);
    api.current.onClose();
  }, []);

  /**
   * Step forward or back, skipping anything not on screen.
   *
   * The index is read from a ref rather than from inside a setState
   * updater. It was in the updater, and that was a real bug: finishing
   * the tour is a side effect, React calls an updater twice under
   * StrictMode, and the tour marked itself seen and vanished the
   * instant it opened. Updaters have to be pure.
   */
  const move = useCallback((direction: 1 | -1) => {
    const candidate = indexRef.current + direction;
    if (candidate < 0) return;
    if (candidate >= TUTORIAL_STEPS.length) { finish(); return; }

    const found = nextUsableStep(candidate, direction, present);
    if (found === null) {
      // Nothing usable left that way. Forward means we are done; back
      // means stay put rather than closing the tour behind them.
      if (direction === 1) finish();
      return;
    }
    setIndex(found);
  }, [finish, present]);

  useEffect(() => {
    if (!open) { setIndex(0); setFinished(false); }
  }, [open]);

  useEffect(() => {
    if (!open || finished) return;
    const step = TUTORIAL_STEPS[index];
    if (!step) return;

    if (step.tab) api.current.onSwitchTab(step.tab);

    // Two frames: one for the tab switch to commit, one for layout.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const shown = api.current.spotlight.show({
          target: step.target,
          card: {
            title: step.title,
            body: step.body,
            progress: [index, TUTORIAL_STEPS.length],
            footer: (
              <>
                <button type="button" className="spot__btn--quiet" onClick={close}>
                  Skip
                </button>
                {index > 0 && (
                  <button type="button" className="spot__btn--quiet" onClick={() => move(-1)}>
                    Back
                  </button>
                )}
                <button type="button" className="spot__btn" onClick={() => move(1)}>
                  {index === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next"}
                </button>
              </>
            ),
          },
        });

        // The target is not on this screen after all. Skip rather than
        // sit on a step that cannot draw.
        if (!shown) move(1);
      });
    });

    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [open, finished, index, close, move]);

  if (!open || !finished) return null;

  return (
    <div className="tut-done" role="dialog" aria-modal="true" aria-label="Tutorial finished">
      <div className="tut-done__card">
        <h2 className="tut-done__title">You&rsquo;re ready to explore SanctiWalk</h2>
        <p className="tut-done__body">
          Ask Sancti whenever you are not sure where something is. You can run
          this tour again from <strong>Me</strong> at any time.
        </p>
        <button type="button" className="tut-done__go" onClick={close}>
          Get started
        </button>
      </div>
    </div>
  );
}
