import {
  loadRosarySettings, saveRosarySettings, type RosaryLanguage,
} from "./rosarySettings";

/**
 * One language for the whole app.
 *
 * ## The problem
 *
 * SanctiWalk's content was written in whichever language each piece was
 * written in: all fifteen ministry descriptions are Tagalog, every
 * sacrament and every station description is English. A pilgrim reading
 * in English hits fifteen blocks of Tagalog; a pilgrim reading in
 * Tagalog hits English everywhere else. Neither is a choice anybody
 * made - it is just how the content arrived.
 *
 * So the language stops being a property of each paragraph and becomes
 * a property of the reader. Every piece of content carries both, and
 * `pick()` chooses.
 *
 * ## Why this does not replace the rosary's own setting
 *
 * The rosary's language lives in localStorage under a contract that is
 * duplicated, deliberately, inside public/rosary/index.html - a static
 * file with its own inline JavaScript that cannot import from here.
 * Rewriting that contract would mean changing two things that have no
 * way of checking each other.
 *
 * Instead this is the master, and setting it writes the rosary's field
 * too. The two can never disagree, and the static file keeps reading
 * exactly what it always read.
 */

export type Language = RosaryLanguage; // "en" | "fil"

export const LANGUAGE_KEY = "sanctiwalk.language";

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fil: "Tagalog",
};

/**
 * Text that exists in both languages.
 *
 * Both are required, not optional. An optional second language is how
 * the app got into this state: it lets a contributor add one side and
 * move on, and the gap is only found by a reader.
 */
export interface Bilingual {
  en: string;
  fil: string;
}

export function isBilingual(value: unknown): value is Bilingual {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Bilingual).en === "string" &&
    typeof (value as Bilingual).fil === "string"
  );
}

/**
 * The reader's side of a bilingual string.
 *
 * Accepts a plain string too, so a call site can be converted before
 * its data is, and so anything still monolingual keeps rendering rather
 * than disappearing mid-migration.
 */
export function pick(value: Bilingual | string | undefined, language: Language): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  // Falls back to the other language rather than showing nothing. A
  // paragraph in the wrong language is worth more than a blank space,
  // and it is visible, which is how the gap gets reported.
  return value[language] || value[language === "en" ? "fil" : "en"] || "";
}

/**
 * A language pinned by the URL, as in /app?lang=en.
 *
 * This exists for the landing page, whose phone mockup is a real
 * SanctiWalk in an iframe. The iframe is same-origin, so it reads the
 * same localStorage as the app - which means a visitor who had once
 * set Tagalog saw the marketing demo in Tagalog, and so did anyone
 * looking over their shoulder. The demo is a showcase for strangers
 * and has to be legible to all of them.
 *
 * It deliberately does NOT persist. Pinning the preview must not
 * silently rewrite the language of the pilgrim's own app, which is the
 * same storage.
 */
function languageFromUrl(): Language | null {
  try {
    const value = new URLSearchParams(window.location.search).get("lang");
    return value === "en" || value === "fil" ? value : null;
  } catch {
    return null;
  }
}

export function loadLanguage(): Language {
  try {
    const pinned = languageFromUrl();
    if (pinned) return pinned;

    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored === "en" || stored === "fil") return stored;
    // Nothing chosen yet: inherit whatever the rosary was set to, so a
    // pilgrim who already picked Tagalog there is not asked twice.
    return loadRosarySettings().language;
  } catch {
    return "en";
  }
}

/**
 * Fired when the language changes, for every hook in this tab.
 *
 * `storage` only reaches OTHER tabs, so without this each
 * `useLanguage()` kept its own stale copy: changing the language in Me
 * updated Me, and the tab bar and Sancti's button stayed in the old
 * language until a reload. One broadcast keeps them all in step.
 */
export const LANGUAGE_EVENT = "sanctiwalk:language";

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
    // Keep the rosary in step. See the note at the top.
    const rosary = loadRosarySettings();
    if (rosary.language !== language) {
      saveRosarySettings({ ...rosary, language });
    }
  } catch {
    // Storage is blocked; the broadcast below still updates this run.
  }

  try {
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: language }));
  } catch {
    // Private mode. The choice holds for this run.
  }
}
