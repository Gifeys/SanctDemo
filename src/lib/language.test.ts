import { describe, it, expect, beforeEach } from "vitest";
import { pick, loadLanguage, saveLanguage, isBilingual, LANGUAGE_KEY } from "./language";
import { loadRosarySettings } from "./rosarySettings";
import { MINISTRY_DESCRIPTION_EN, SACRAMENT_DESCRIPTION_FIL, bilingualFor } from "./contentTranslations";
import { MINISTRIES, SACRAMENTS } from "../data";

beforeEach(() => localStorage.clear());

describe("choosing a side", () => {
  const both = { en: "Baptism", fil: "Binyag" };

  it("gives the reader's language", () => {
    expect(pick(both, "en")).toBe("Baptism");
    expect(pick(both, "fil")).toBe("Binyag");
  });

  it("falls back to the other rather than showing nothing", () => {
    // A paragraph in the wrong language is worth more than a blank
    // space, and it is visible, which is how a gap gets reported.
    expect(pick({ en: "Baptism", fil: "" }, "fil")).toBe("Baptism");
  });

  it("passes a plain string through, for anything not yet converted", () => {
    expect(pick("Already text", "fil")).toBe("Already text");
    expect(pick(undefined, "en")).toBe("");
  });
});

describe("the setting", () => {
  it("defaults to English with nothing stored", () => {
    expect(loadLanguage()).toBe("en");
  });

  it("round-trips", () => {
    saveLanguage("fil");
    expect(loadLanguage()).toBe("fil");
  });

  it("keeps the rosary in step, since it has its own copy", () => {
    // The rosary's contract is duplicated inside a static HTML file
    // that cannot import from here. Two settings that disagree would
    // be two languages in one app.
    saveLanguage("fil");
    expect(loadRosarySettings().language).toBe("fil");
  });

  it("inherits the rosary's choice when nothing has been set here", () => {
    localStorage.setItem(
      "sanctiwalk.rosary.settings",
      JSON.stringify({ language: "fil", mysterySet: "today", music: "on" }),
    );
    expect(loadLanguage()).toBe("fil");
  });

  it("ignores a junk value instead of throwing", () => {
    localStorage.setItem(LANGUAGE_KEY, "klingon");
    expect(loadLanguage()).toBe("en");
  });
});

describe("every piece of content has both languages", () => {
  // This is the whole point. The app shipped with fifteen Tagalog
  // ministry descriptions and ten English ones elsewhere, so a reader
  // got a mixture whichever language they preferred.
  it("every ministry has an English description", () => {
    const missing = MINISTRIES.filter(m => !MINISTRY_DESCRIPTION_EN[m.id]);
    expect(missing.map(m => m.id)).toEqual([]);
  });

  it("every sacrament has a Tagalog description", () => {
    const missing = SACRAMENTS.filter(s => !SACRAMENT_DESCRIPTION_FIL[s.id]);
    expect(missing.map(s => s.id)).toEqual([]);
  });

  it("an English reader gets no Tagalog ministry prose", () => {
    // Function words only, and deliberately not "ng". A first draft
    // included it and failed on "The Apostolado ng Panalangin (AnP)" —
    // which is the ministry's actual name. The parish does not
    // translate its own noticeboard, and neither does this.
    for (const m of MINISTRIES) {
      const shown = pick(bilingualFor(m.description, MINISTRY_DESCRIPTION_EN[m.id], "fil"), "en");
      const hits = (shown.match(/\b(ang|mga|ay|nang|kanilang|ito|sila|nila)\b/gi) ?? []).length;
      expect({ id: m.id, hits }).toEqual({ id: m.id, hits: 0 });
    }
  });

  it("a Tagalog reader gets Tagalog sacrament text", () => {
    for (const s of SACRAMENTS) {
      const shown = pick(bilingualFor(s.description, SACRAMENT_DESCRIPTION_FIL[s.id], "en"), "fil");
      expect(shown).toBe(SACRAMENT_DESCRIPTION_FIL[s.id]);
    }
  });

  it("the six choirs say the same thing as each other in both languages", () => {
    const choirs = MINISTRIES.filter(m => m.id.startsWith("min-choir-"));
    expect(choirs.length).toBeGreaterThan(1);
    const english = new Set(choirs.map(c => MINISTRY_DESCRIPTION_EN[c.id]));
    expect(english.size).toBe(1);
  });
});

describe("a bilingual value", () => {
  it("is recognised only with both sides", () => {
    expect(isBilingual({ en: "a", fil: "b" })).toBe(true);
    expect(isBilingual({ en: "a" })).toBe(false);
    expect(isBilingual("a")).toBe(false);
  });
});
