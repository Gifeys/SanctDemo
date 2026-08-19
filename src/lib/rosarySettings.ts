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

export interface RosarySettings {
  language: RosaryLanguage;
  mysterySet: RosaryMysterySet;
  music: RosaryMusic;
}

export const ROSARY_SETTINGS_KEY = "sanctiwalk.rosary.settings";

export const DEFAULT_ROSARY_SETTINGS: RosarySettings = {
  language: "en",
  mysterySet: "today",
  music: "on",
};

const VALID_MYSTERY_SETS: RosaryMysterySet[] = ["today", "joyful", "sorrowful", "glorious", "luminous"];

function isValidRosarySettings(value: unknown): value is RosarySettings {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (v.language === "en" || v.language === "fil") &&
    typeof v.mysterySet === "string" &&
    VALID_MYSTERY_SETS.indexOf(v.mysterySet as RosaryMysterySet) !== -1 &&
    (v.music === "on" || v.music === "off");
}

/** Never throws. Falls back to the default on missing or corrupted data. */
export function loadRosarySettings(): RosarySettings {
  try {
    const raw = localStorage.getItem(ROSARY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_ROSARY_SETTINGS };
    const parsed = JSON.parse(raw);
    return isValidRosarySettings(parsed) ? parsed : { ...DEFAULT_ROSARY_SETTINGS };
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
    return isValidRosarySettings(parsed) ? parsed : { ...DEFAULT_ROSARY_SETTINGS };
  } catch {
    return { ...DEFAULT_ROSARY_SETTINGS };
  }
}
