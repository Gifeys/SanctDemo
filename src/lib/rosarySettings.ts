// Shared rosary settings, kept in sync between the app's own "Rosary
// settings" surface (src/components/RosarySettingsModal.tsx) and the
// client's standalone rosary (public/rosary/index.html), which is mounted
// same-origin in an <iframe>. Both sides read/write this one localStorage
// key and react to the `storage` event, so no postMessage bridge is needed.
//
// IMPORTANT: this file's shape (key name, field names/values) is duplicated
// intentionally inside public/rosary/index.html, which is a static HTML
// file with its own inline JS and cannot import from here. If you change
// this contract, update both places.

export type RosaryLanguage = "en" | "fil";
export type RosaryMysterySet = "today" | "joyful" | "sorrowful" | "glorious" | "luminous";
export type RosaryMusic = "on" | "off";

/**
 * How you move through the prayers.
 *
 * "button" shows arrows beside the beads; "touch" keeps the
 * original tap-the-screen behaviour (tap to continue, left edge to go
 * back).
 *
 * Buttons are the default, including for everybody who has used the
 * rosary before today. Tapping anywhere is discoverable only once
 * somebody has been told, and the people most likely to pray a rosary
 * on a phone are the least likely to guess that a left edge means
 * back. Anybody who prefers the old way has one switch to flip, and
 * their choice is remembered.
 */
export type RosaryInteraction = "button" | "touch";

export interface RosarySettings {
  language: RosaryLanguage;
  mysterySet: RosaryMysterySet;
  music: RosaryMusic;
  interaction: RosaryInteraction;
}

export const ROSARY_SETTINGS_KEY = "sanctiwalk.rosary.settings";

export const DEFAULT_ROSARY_SETTINGS: RosarySettings = {
  language: "en",
  mysterySet: "today",
  music: "on",
  interaction: "button",
};

const VALID_MYSTERY_SETS: RosaryMysterySet[] = ["today", "joyful", "sorrowful", "glorious", "luminous"];

/**
 * Deliberately does NOT require `interaction`.
 *
 * Everybody who has ever opened the rosary has a stored object with
 * three fields. Requiring a fourth would make all of them invalid, and
 * an invalid object falls back to the default - so adding this setting
 * would silently reset every pilgrim's language, mystery and music.
 * It is read through normaliseInteraction instead, which supplies the
 * default for a value that is missing or unrecognised.
 */
function isValidRosarySettings(value: unknown): value is Omit<RosarySettings, "interaction"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (v.language === "en" || v.language === "fil") &&
    typeof v.mysterySet === "string" &&
    VALID_MYSTERY_SETS.indexOf(v.mysterySet as RosaryMysterySet) !== -1 &&
    (v.music === "on" || v.music === "off");
}

/** Anything that is not an understood mode is the default. */
export function normaliseInteraction(value: unknown): RosaryInteraction {
  return value === "touch" ? "touch" : "button";
}

function withInteraction(parsed: unknown): RosarySettings {
  const v = parsed as Record<string, unknown>;
  return {
    ...(parsed as Omit<RosarySettings, "interaction">),
    interaction: normaliseInteraction(v.interaction),
  };
}

/** Never throws. Falls back to the default on missing or corrupted data. */
export function loadRosarySettings(): RosarySettings {
  try {
    const raw = localStorage.getItem(ROSARY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_ROSARY_SETTINGS };
    const parsed = JSON.parse(raw);
    return isValidRosarySettings(parsed) ? withInteraction(parsed) : { ...DEFAULT_ROSARY_SETTINGS };
  } catch {
    return { ...DEFAULT_ROSARY_SETTINGS };
  }
}

export function saveRosarySettings(settings: RosarySettings): void {
  try {
    localStorage.setItem(ROSARY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode, quota, etc). The setting
    // still applies for this session via React state.
  }
}

/** Parses a `storage` event's newValue for this key. Never throws. */
export function parseRosarySettingsEventValue(newValue: string | null): RosarySettings {
  if (!newValue) return { ...DEFAULT_ROSARY_SETTINGS };
  try {
    const parsed = JSON.parse(newValue);
    return isValidRosarySettings(parsed) ? withInteraction(parsed) : { ...DEFAULT_ROSARY_SETTINGS };
  } catch {
    return { ...DEFAULT_ROSARY_SETTINGS };
  }
}
