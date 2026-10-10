import { useCallback, useEffect, useRef, useState } from "react";
import { currentEngine, speakAloud, stopAloud, type Engine } from "./speech";
import type { Language } from "./language";

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

export function useNarration(language: Language = "en"): Narration {
  const [speaking, setSpeaking] = useState(false);

  // Read once per mount rather than on every render. On the phone this
  // is always "native"; in a browser it depends on whether any voice is
  // installed, which is not knowable before the page has loaded.
  const [engine, setEngine] = useState<Engine>(() => currentEngine());

  useEffect(() => {
    if (engine !== "none" || typeof window === "undefined") return;
    // Chrome populates its voice list asynchronously, so a "none" read
    // at mount can be wrong. One recheck when the list arrives is
    // enough; without it the first visitor to a cold page gets no
    // narration button at all.
    const recheck = () => setEngine(currentEngine());
    window.speechSynthesis?.addEventListener?.("voiceschanged", recheck);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", recheck);
    };
  }, [engine]);

  const supported = engine !== "none";

  const speakingRef = useRef(false);
  speakingRef.current = speaking;

  const stop = useCallback(() => {
    void stopAloud();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      setSpeaking(true);
      // The promise resolves when the engine has finished reading, which
      // is how the button knows to go back to "play" - the native plugin
      // has no onend event to listen for.
      void speakAloud(text, language).finally(() => setSpeaking(false));
    },
    [supported, language],
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
    return () => { void stopAloud(); };
  }, []);

  return { speak, stop, toggle, speaking, supported };
}
