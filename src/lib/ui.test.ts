import { describe, it, expect } from "vitest";
import { t, translator, UI_KEYS } from "./ui";

describe("every label exists in both languages", () => {
  // The thing that went wrong before: content was translated and the
  // interface was not, so a Tagalog reader got Tagalog descriptions
  // inside an English app. A label added without its Tagalog fails
  // here rather than appearing untranslated on somebody's phone.
  it("has a non-empty English and Tagalog for every key", () => {
    const missing = UI_KEYS.filter(k => !t(k, "en").trim() || !t(k, "fil").trim());
    expect(missing).toEqual([]);
  });

  it("actually differs between the two, where it should", () => {
    // A handful are legitimately the same word in both - "Account",
    // "Map" is not, but proper nouns and borrowings happen. Most
    // should differ; if almost none do, the table was filled in by
    // copying the English across.
    const same = UI_KEYS.filter(k => t(k, "en") === t(k, "fil"));
    expect(same.length).toBeLessThan(UI_KEYS.length * 0.2);
  });

  it("never returns an empty string for a real key", () => {
    for (const key of UI_KEYS) {
      expect(t(key, "en").length).toBeGreaterThan(0);
      expect(t(key, "fil").length).toBeGreaterThan(0);
    }
  });
});

describe("the tab bar, which is on every screen", () => {
  it("is translated", () => {
    expect(t("tab.home", "fil")).toBe("Bahay");
    expect(t("tab.map", "fil")).toBe("Mapa");
    expect(t("tab.pray", "fil")).toBe("Dasal");
    expect(t("tab.me", "fil")).toBe("Ako");
  });

  it("is still English in English", () => {
    expect(t("tab.home", "en")).toBe("Home");
    expect(t("tab.pray", "en")).toBe("Pray");
  });
});

describe("the bound translator", () => {
  it("is the same as calling t with that language", () => {
    const tf = translator("fil");
    for (const key of UI_KEYS) expect(tf(key)).toBe(t(key, "fil"));
  });
});

describe("an unknown key", () => {
  it("shows itself rather than vanishing", () => {
    // A visible "me.title" on screen is reported in minutes; a silent
    // empty string is not.
    // @ts-expect-error deliberately outside the key union
    expect(t("not.a.key", "en")).toBe("not.a.key");
  });
});
