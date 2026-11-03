import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  ROSARY_SETTINGS_KEY,
  DEFAULT_ROSARY_SETTINGS,
  loadRosarySettings,
  saveRosarySettings,
  parseRosarySettingsEventValue,
  normaliseInteraction,
} from "./rosarySettings";

/**
 * The rosary's saved preferences.
 *
 * The assertions that matter are about what happens to settings saved
 * BEFORE the interaction mode existed, because that is where adding a
 * field to a stored object goes wrong: handled carelessly, every
 * pilgrim's language and mystery reset the first time they open the
 * app after an update.
 */
beforeEach(() => localStorage.clear());

describe("the interaction mode", () => {
  it("defaults to buttons", () => {
    // Tapping anywhere is discoverable only once somebody has been
    // told, and a left edge meaning "back" is not guessable at all.
    expect(DEFAULT_ROSARY_SETTINGS.interaction).toBe("button");
    expect(loadRosarySettings().interaction).toBe("button");
  });

  it("survives a restart", () => {
    saveRosarySettings({ ...DEFAULT_ROSARY_SETTINGS, interaction: "touch" });
    expect(loadRosarySettings().interaction).toBe("touch");
  });

  it("reads anything unrecognised as the default", () => {
    expect(normaliseInteraction("beads")).toBe("button");
    expect(normaliseInteraction(undefined)).toBe("button");
    expect(normaliseInteraction(null)).toBe("button");
    expect(normaliseInteraction(true)).toBe("button");
    expect(normaliseInteraction("touch")).toBe("touch");
  });
});

describe("settings saved before the mode existed", () => {
  /** What is in storage on every phone that has opened the rosary. */
  const THREE_FIELD = { language: "fil", mysterySet: "glorious", music: "off" };

  it("keeps the pilgrim's language, mystery and music", () => {
    // The regression this guards: requiring the new field would make
    // every stored object invalid, and an invalid object falls back to
    // the default - silently resetting three settings somebody chose.
    localStorage.setItem(ROSARY_SETTINGS_KEY, JSON.stringify(THREE_FIELD));
    const loaded = loadRosarySettings();

    expect(loaded.language).toBe("fil");
    expect(loaded.mysterySet).toBe("glorious");
    expect(loaded.music).toBe("off");
  });

  it("gives them buttons, since they never chose otherwise", () => {
    localStorage.setItem(ROSARY_SETTINGS_KEY, JSON.stringify(THREE_FIELD));
    expect(loadRosarySettings().interaction).toBe("button");
  });

  it("does the same for a change arriving from the rosary iframe", () => {
    // The two sides sync through the storage event, so the same
    // tolerance has to hold there or a write from the old static page
    // would reset the shell.
    const parsed = parseRosarySettingsEventValue(JSON.stringify(THREE_FIELD));
    expect(parsed.language).toBe("fil");
    expect(parsed.interaction).toBe("button");
  });
});

describe("storage that cannot be trusted", () => {
  it("falls back whole rather than part-way on nonsense", () => {
    localStorage.setItem(ROSARY_SETTINGS_KEY, "{not json");
    expect(loadRosarySettings()).toEqual(DEFAULT_ROSARY_SETTINGS);
  });

  it("falls back when a real setting is invalid", () => {
    localStorage.setItem(
      ROSARY_SETTINGS_KEY,
      JSON.stringify({ language: "de", mysterySet: "today", music: "on", interaction: "touch" }),
    );
    expect(loadRosarySettings()).toEqual(DEFAULT_ROSARY_SETTINGS);
  });

  it("round-trips a complete object unchanged", () => {
    const settings = {
      language: "fil" as const,
      mysterySet: "luminous" as const,
      music: "off" as const,
      interaction: "touch" as const,
    };
    saveRosarySettings(settings);
    expect(loadRosarySettings()).toEqual(settings);
  });
});

describe("the copy of this contract inside public/rosary/index.html", () => {
  /**
   * The static rosary cannot import from here - it is a single HTML
   * file with inline JS - so the contract is duplicated by hand, and
   * its own header says so. Duplication kept honest by a human is
   * duplication that drifts, and when these two disagree the symptom
   * is a pilgrim's settings silently resetting, which nobody reports
   * as a bug.
   */
  const html = readFileSync("public/rosary/index.html", "utf8");

  it("uses the same storage key", () => {
    expect(html).toContain(`const ROSARY_SETTINGS_KEY = "${ROSARY_SETTINGS_KEY}"`);
  });

  it("defaults to buttons there too", () => {
    // If this side defaulted to buttons and that side to tapping, the
    // mode would flip depending on which screen you opened first.
    expect(html).toMatch(/DEFAULT_ROSARY_SETTINGS = \{[^}]*interaction: "button"/);
  });

  it("reads an unknown mode the same way", () => {
    expect(html).toContain('function normaliseInteraction(v) { return v === "touch" ? "touch" : "button"; }');
  });

  it("does not require interaction when validating stored settings", () => {
    // The same tolerance as isValidRosarySettings here. Without it,
    // opening the rosary would reset the settings that this module
    // had just preserved.
    const validator = html.slice(
      html.indexOf("function isValidRosarySettings(v) {"),
      html.indexOf("function loadRosarySettings()"),
    );
    expect(validator).not.toContain("interaction");
  });

  it("offers both modes in its own settings panel", () => {
    expect(html).toContain('data-mode="button"');
    expect(html).toContain('data-mode="touch"');
  });

  it("drives the buttons through the same progression as tapping", () => {
    // Undo and Do must call goBack() and advance(), not move S.idx
    // themselves. A second copy of the progression is how the two
    // modes end up disagreeing about where you are.
    const bar = html.slice(html.indexOf('el.btnUndo.addEventListener'), html.indexOf('el.tapzone.addEventListener'));
    expect(bar).toContain("goBack();");
    expect(bar).toContain("advance();");
    expect(bar).not.toContain("S.idx");
  });
});
