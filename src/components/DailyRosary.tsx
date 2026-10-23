import { useEffect, useRef } from "react";

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

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
        | { channel?: string; type?: string; text?: string; lang?: string }
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
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      // Leaving the Pray tab must not leave a voice praying on behind it.
      void stopAloud();
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

/** Native recognition, where there is any. */
async function listenAvailable(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    const { available } = await SpeechRecognition.available();
    if (!available) return false;
    const perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== "granted") {
      const asked = await SpeechRecognition.requestPermissions();
      if (asked.speechRecognition !== "granted") return false;
    }
    return true;
  } catch {
    return false;
  }
}

let listening = false;

async function stopListening(): Promise<void> {
  if (!listening) return;
  listening = false;
  try {
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.stop();
  } catch {
    /* nothing was listening; stopping silence is not an error */
  }
}

/**
 * Listens and relays what it hears, phrase by phrase.
 *
 * partialResults, because the Rosary matches continuously as somebody
 * prays rather than waiting for them to finish a decade. popup is off:
 * Android's own dialog would cover the prayer the pilgrim is reading.
 */
async function startListening(
  language: "fil" | "en",
  reply: (m: Record<string, unknown>) => void,
): Promise<void> {
  if (!(await listenAvailable())) {
    reply({ type: "listen-availability", available: false });
    return;
  }
  await stopListening();
  listening = true;

  try {
    await SpeechRecognition.addListener("partialResults", (result: { matches?: string[] }) => {
      const heard = result?.matches?.[0];
      if (heard) reply({ type: "heard", text: heard });
    });
    await SpeechRecognition.start({
      language: language === "fil" ? "fil-PH" : "en-US",
      maxResults: 1,
      partialResults: true,
      popup: false,
    });
  } catch {
    listening = false;
    reply({ type: "listen-availability", available: false });
  }
}
