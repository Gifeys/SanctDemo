import { useEffect, useRef } from "react";

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import {
  IDLE,
  afterHeard,
  afterRestart,
  listenLocales,
  planRestart,
  type RestartState,
} from "../lib/listenRestart";

import { speakAloud, stopAloud } from "../lib/speech";

// The client's own hand-built rosary app is mounted here as-is, via iframe,
// rather than ported to React. See public/rosary/index.html (plus the
// public/rosary/20 Mysteries/ image set) for the source. It is intentionally
// left unstyled to match the rest of this app; it keeps its own look.
//
// Layout note: this component renders inside PhoneContainer's scrollable
// "children" slot (a flex flex-col container with overflow-y-auto and a
// fixed pixel height set by the phone/desktop frame). Using 100vh here would
// overflow that frame on desktop, so instead we stretch to fill the parent
// via flex-1 + h-full, letting the iframe's own height:100% fill that.

/** Both ends agree on this so other postMessage traffic is ignored. */
const CHANNEL = "sanctiwalk-rosary";

/**
 * Speaks for the Rosary, because inside the app it cannot speak for
 * itself.
 *
 * The Rosary page narrates through window.speechSynthesis. In a desktop
 * browser that works. In the Android build the page is inside a WebView,
 * whose speechSynthesis is a stub - it accepts an utterance, reports no
 * error, has no voices behind it and makes no sound. The guided Rosary
 * was therefore silent on the one device the pilgrim actually prays
 * with, which is the only device that matters here.
 *
 * Everything else in the app avoids that stub by going through
 * lib/speech, which uses the platform's text-to-speech on a phone. An
 * iframe cannot reach a Capacitor plugin, so it asks us instead: it
 * says hello, we answer, and after that each line arrives as a message
 * and we read it aloud with the same voice the rest of the app uses.
 *
 * With no answer the page falls back to Web Speech, which is what a
 * laptop wants anyway.
 */
export default function DailyRosary() {
  const frame = useRef<HTMLIFrameElement | null>(null);

  /** Announce us again once the page is up, in case its hello raced us. */
  function announce() {
    frame.current?.contentWindow?.postMessage(
      { channel: CHANNEL, type: "host-ready" },
      window.location.origin,
    );
  }

  useEffect(() => {
    function reply(message: Record<string, unknown>) {
      const win = frame.current?.contentWindow;
      if (!win) return;
      win.postMessage({ channel: CHANNEL, ...message }, window.location.origin);
    }

    async function onMessage(event: MessageEvent) {
      // Same page, same frame, or it is not the Rosary talking.
      if (event.origin !== window.location.origin) return;
      if (frame.current && event.source !== frame.current.contentWindow) return;

      const data = event.data as
        | { channel?: string; type?: string; text?: string; lang?: string; on?: boolean }
        | null;
      if (!data || data.channel !== CHANNEL) return;

      if (data.type === "hello") {
        reply({ type: "host-ready" });
        return;
      }

      if (data.type === "stop") {
        await stopAloud();
        return;
      }

      if (data.type === "speak" && typeof data.text === "string") {
        await speakAloud(data.text, data.lang === "fil" ? "fil" : "en");
        // Resolves when the voice stops, so this is the moment the page
        // can light its next bead rather than guess at a duration.
        reply({ type: "spoke-end" });
        return;
      }

      // ---- listening, for the same reason as speaking -----------------
      //
      // The Rosary follows along as you pray through the Web Speech API's
      // SpeechRecognition. That exists in desktop Chrome and does not
      // exist at all in the Android WebView - window.SpeechRecognition and
      // window.webkitSpeechRecognition are both undefined there - so on
      // the phone the page simply never heard anything. It is the same
      // gap as the voice, in the other direction, and it has the same
      // answer: the app around it has a native recogniser and lends it.

      if (data.type === "listen-available") {
        reply({ type: "listen-availability", available: await listenAvailable() });
        return;
      }

      if (data.type === "listen-start") {
        await startListening(data.lang === "fil" ? "fil" : "en", reply);
        return;
      }

      if (data.type === "listen-stop") {
        await stopListening();
        return;
      }

      if (data.type === "fullscreen") {
        setImmersive(!!data.on);
        reply({ type: "fullscreen-state", on: !!data.on });
        return;
      }
    }

    /**
     * Quieten the Rosary when it is not on screen.
     *
     * The ambient track lives inside the iframe, so nothing out here
     * can pause it directly - the page has to be asked. Reported as
     * the music still playing after leaving the screen, which is what
     * happens to an <audio> element nobody tells to stop.
     *
     * Also fires when the whole app goes to the background: an app in
     * a pocket playing music on is worse than one that forgot to
     * resume.
     */
    /**
     * Takes the app's own chrome out of the way for the Rosary.
     *
     * The Fullscreen API cannot do this from inside the iframe: it
     * would make the iframe full screen while the tab bar carries on
     * being drawn over it. Hiding the chrome is the host's decision,
     * so the Rosary asks and the host acts.
     *
     * setAttribute, not toggleAttribute: toggleAttribute sets the value
     * to an EMPTY STRING and the stylesheet matches
     * [data-immersive="true"], so the attribute appeared, the selector
     * never matched, and the bar stayed put while the button lit up as
     * though it had worked.
     */
    function setImmersive(on: boolean) {
      if (on) document.documentElement.setAttribute("data-immersive", "true");
      else document.documentElement.removeAttribute("data-immersive");
    }

    function onVisibility() {
      reply({ type: document.hidden ? "host-hidden" : "host-visible" });
      if (document.hidden) void stopAloud();
    }
    document.addEventListener("visibilitychange", onVisibility);

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      // Leaving the Pray tab with the chrome still hidden would strand
      // the whole app with no way to change tab.
      setImmersive(false);
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving the Pray tab must not leave a voice praying on behind
      // it, a microphone open, or music playing in an empty room.
      reply({ type: "host-hidden" });
      void stopAloud();
      void stopListening();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full min-h-[600px] w-full">
      <iframe
        ref={frame}
        src="/rosary/index.html"
        title="Holy Rosary"
        /* Without this the WebView refuses getUserMedia inside the
           frame, which also kills the loudness glow that lights the
           bead even where recognition is unavailable. */
        allow="microphone"
        onLoad={announce}
        style={{ border: 0 }}
        className="flex-1 w-full h-full"
      />
    </div>
  );
}

/**
 * One tag for everything the speech bridge reports.
 *
 * Kept in the shipped build on purpose. This path cannot be exercised
 * from a desktop browser or a test - there is no recogniser in either -
 * so the only way anybody diagnoses it is by reading the device log
 * while somebody prays into the phone. Twice now the fault has been
 * guessed at from the symptom instead.
 *
 * Visible with:  adb logcat | grep SW-VOICE
 */
function voiceLog(...parts: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log("SW-VOICE", ...parts);
}

/** Native recognition, where there is any. */
async function listenAvailable(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    const { available } = await SpeechRecognition.available();
    voiceLog("available:", available);
    if (!available) return false;
    const perm = await SpeechRecognition.checkPermissions();
    voiceLog("permission:", perm.speechRecognition);
    if (perm.speechRecognition !== "granted") {
      const asked = await SpeechRecognition.requestPermissions();
      if (asked.speechRecognition !== "granted") return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the pilgrim still wants the microphone, and how many times
 * the recogniser has been restarted with nothing heard.
 *
 * Module-level because the restart is driven by a plugin event, which
 * arrives outside any React render.
 */
let listenState: RestartState = { ...IDLE };
let restartTimer: number | null = null;

async function stopListening(): Promise<void> {
  listenState = { ...IDLE };
  if (restartTimer !== null) {
    window.clearTimeout(restartTimer);
    restartTimer = null;
  }
  try {
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.stop();
  } catch {
    /* nothing was listening; stopping silence is not an error */
  }
}

async function startListening(
  language: "fil" | "en",
  reply: (m: Record<string, unknown>) => void,
): Promise<void> {
  voiceLog("listen-start requested, language:", language);
  if (!(await listenAvailable())) {
    voiceLog("unavailable - giving up");
    reply({ type: "listen-availability", available: false });
    return;
  }
  await stopListening();
  listenState = { attempts: 0, wanted: true };

  // The locale that actually started, so restarts do not re-run the
  // fallback search for the rest of the Rosary.
  let locale: string | null = null;

  /**
   * One recognition session.
   *
   * Android's recogniser is built around a single utterance: it hears
   * one, delivers it, and stops. A Rosary is hundreds of utterances
   * with a pause between each, so the session has to be reopened every
   * time - which is the whole reason the voice following worked on a
   * laptop and not on the phone.
   */
  async function session(): Promise<boolean> {
    const candidates = locale ? [locale] : listenLocales(language);
    for (const candidate of candidates) {
      try {
        const result = await SpeechRecognition.start({
          language: candidate,
          maxResults: 1,
          partialResults: true,
          popup: false,
        });
        locale = candidate;
        voiceLog("started in", candidate);

        // Not every recogniser emits partials.
        //
        // The plugin documents start() as responding "directly without
        // result" when partialResults is true, leaving everything to
        // the event - and a good many Android builds, OEM ones
        // especially, never fire that event and deliver only a final
        // result here. On those handsets the microphone lit up and
        // nothing was ever heard, which is exactly what was reported.
        //
        // So whatever start() hands back is used too. On a device that
        // does emit partials this is empty and costs nothing.
        const spoken = (result as { matches?: string[] } | undefined)?.matches?.[0];
        voiceLog("start() returned:", JSON.stringify(result ?? null));
        if (spoken) {
          listenState = afterHeard(listenState);
          reply({ type: "heard", text: spoken, final: true });
        }
        return true;
      } catch (err) {
        voiceLog("locale refused:", candidate, (err as Error)?.message ?? err);
        // This locale is not installed on the handset. Try the next
        // rather than reporting the whole feature unavailable, which
        // is what silently cost Tagalog users their voice following.
      }
    }
    return false;
  }

  try {
    await SpeechRecognition.addListener("partialResults", (result: { matches?: string[] }) => {
      const heard = result?.matches?.[0];
      voiceLog("partial:", JSON.stringify(result?.matches ?? null));
      if (!heard) return;
      // Something was heard, so the recogniser is working. Restarts
      // only count when they achieve nothing.
      listenState = afterHeard(listenState);
      reply({ type: "heard", text: heard });
    });

    await SpeechRecognition.addListener("listeningState", (state: { status: string }) => {
      voiceLog("state:", state.status, "attempts:", listenState.attempts);
      if (state.status !== "stopped") return;

      const plan = planRestart(listenState);
      if (!plan.restart) {
        if (plan.giveUp) {
          listenState = { ...IDLE };
          reply({ type: "listen-availability", available: false });
        }
        return;
      }

      listenState = afterRestart(listenState);
      restartTimer = window.setTimeout(() => {
        restartTimer = null;
        if (!listenState.wanted) return;
        void session();
      }, plan.delayMs);
    });

    if (!(await session())) {
      listenState = { ...IDLE };
      reply({ type: "listen-availability", available: false });
    }
  } catch {
    listenState = { ...IDLE };
    reply({ type: "listen-availability", available: false });
  }
}
