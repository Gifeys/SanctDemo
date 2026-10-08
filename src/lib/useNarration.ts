import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reading a station's words aloud.
 *
 * ## Why the browser's voice and not an audio file
 *
 * `Station.audioUrl` exists in the type and is set on exactly none of
 * them — no narration has been recorded for this parish yet. The app
 * already solved that once, on the Map tab, by handing the text to
 * `speechSynthesis`, and doing the same here keeps one answer to the
 * question rather than two. When real recordings arrive, `speak` takes
 * a url instead and nothing above this module changes.
 *
 * ## Why it tracks `speaking` itself rather than trusting the engine
 *
 * `speechSynthesis.speaking` stays true through a pause and lies for a
 * moment after cancel(), so a button bound to it flickers and sticks.
 * The events are the reliable signal, and this holds the state they
 * report.
 */
export interface Narration {
  speak: (text: string) => void;
  stop: () => void;
  /** Starts this text, or stops if it is already being read. */
  toggle: (text: string) => void;
  speaking: boolean;
  supported: boolean;
}

export function useNarration(): Narration {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // So the cleanup below can stop a reading without re-running on every
  // state change.
  const speakingRef = useRef(false);
  speakingRef.current = speaking;

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      // Cancel first: queueing a second utterance makes the pilgrim wait
      // out the previous station before hearing this one.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      // A shade under natural pace. The default rattles through a
      // reflection in a way that is hard to pray along with.
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    },
    [supported],
  );

  const toggle = useCallback(
    (text: string) => {
      if (speakingRef.current) stop();
      else speak(text);
    },
    [speak, stop],
  );

  // Leaving the screen must silence it. A voice still reading the
  // Baptismal Font while the pilgrim is back on Home is the kind of bug
  // people close the app over.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { speak, stop, toggle, speaking, supported };
}
