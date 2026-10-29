import { describe, expect, it } from "vitest";

import { aliasesFor, understand, type ParishName, type SanctiAction } from "./sancti";

/**
 * The questions people actually type, in the language they type them.
 *
 * Not paraphrases of the phrase lists - that would only prove the
 * lists match themselves. These are written the way a parishioner
 * messages: the politeness particle, the shortened interrogative,
 * the spelling used in chat, and the half-sentence.
 *
 * Sancti was reported as "only understanding map questions". It was
 * not quite that - it understood whatever happened to have phrases
 * written for it, and the map had the most. The Rosary, the scanner
 * and the bulletin had none at all, so every way of asking for them
 * came back UNKNOWN.
 */
const PARISHES: ParishName[] = [
  aliasesFor("route-mhcp", "Mary Help of Christians Parish Guide"),
  aliasesFor("route-src", "San Roque Cathedral Parish Tour"),
];

function asks(question: string): SanctiAction {
  return understand(question, PARISHES).action;
}

/** Each case is [what somebody types, what it must be taken to mean]. */
const CASES: Array<[string, SanctiAction]> = [
  // --- Tagalog, as written in messages -------------------------------
  ["san po yung mapa", "OPEN_MAP"],
  ["asan ang mapa", "OPEN_MAP"],
  ["nasan po ang map", "OPEN_MAP"],
  ["anu oras po misa", "OPEN_MASS_SCHEDULE"],
  ["anong oras ang misa bukas", "OPEN_MASS_SCHEDULE"],
  ["kelan po may misa", "OPEN_MASS_SCHEDULE"],
  ["saan makikita history ng simbahan", "OPEN_CHURCH_HISTORY"],
  ["kasaysayan po ng simbahan", "OPEN_CHURCH_HISTORY"],

  // --- the Rosary, which had no trigger at all ------------------------
  ["pano mag rosary", "OPEN_ROSARY"],
  ["paano po magdasal ng rosaryo", "OPEN_ROSARY"],
  ["saan ang rosary", "OPEN_ROSARY"],
  ["gusto ko magdasal", "OPEN_ROSARY"],
  ["open the rosary", "OPEN_ROSARY"],

  // --- Sancti Scan and the AR Museum share one tab, so one action ---
  ["where is sanctiscan", "OPEN_AR"],
  ["where is sancti scan", "OPEN_AR"],
  ["pano mag scan", "OPEN_AR"],
  ["anong statue ito", "OPEN_AR"],
  ["saan ang camera", "OPEN_AR"],

  // --- the bulletin ---------------------------------------------------
  ["anong bago sa parokya", "OPEN_ANNOUNCEMENTS"],
  ["may balita po ba", "OPEN_ANNOUNCEMENTS"],
  ["latest announcement", "OPEN_ANNOUNCEMENTS"],
  ["kapistahan", "OPEN_ANNOUNCEMENTS"],

  // --- sacraments and ministries --------------------------------------
  ["pano mag apply ng binyag", "OPEN_BAPTISM"],
  ["requirements po ng kasal", "OPEN_WEDDING"],
  ["anong mga ministry dito", "OPEN_MINISTRIES"],
  ["saan ang sakramento", "OPEN_SACRAMENTS"],

  // --- the AR museum ---------------------------------------------------
  ["ar museum", "OPEN_AR"],
  ["saan ang ar", "OPEN_AR"],

  // --- misspelled English ----------------------------------------------
  ["wheres the mapp", "OPEN_MAP"],
  ["whats the mass shedule", "OPEN_MASS_SCHEDULE"],
  ["chruch history", "OPEN_CHURCH_HISTORY"],

  // --- the catch-all ----------------------------------------------------
  ["ano pa pong features dito", "HELP"],
  ["what can you do", "HELP"],
  ["help po", "HELP"],
];

describe("the questions a parishioner actually asks", () => {
  for (const [question, expected] of CASES) {
    it(`"${question}" -> ${expected}`, () => {
      expect(asks(question)).toBe(expected);
    });
  }

  it("never claims a feature for a question that has nothing to do with one", () => {
    // The floor matters as much as the matching, but the floor is
    // "do not answer the wrong question confidently" rather than
    // "say UNKNOWN". Falling back to HELP - here is what I can do -
    // is a better answer to an unanswerable question than a blank
    // refusal, and it is what this returns.
    //
    // What must never happen is a specific destination.
    const wild = ["ano ang kulay ng langit", "sino ang panalo kahapon", "2 + 2"];
    for (const question of wild) {
      expect(["UNKNOWN", "HELP"]).toContain(asks(question));
    }
  });

  it("does not let the widened help list steal a real question", () => {
    // HELP gained "features", "what else" and the Tagalog for them.
    // A greedy help trigger outscoring real intents is a documented
    // past bug in this file - "pwede ba" was removed for exactly it.
    expect(asks("ano ang schedule ng misa")).toBe("OPEN_MASS_SCHEDULE");
    expect(asks("ano ang history ng simbahan")).toBe("OPEN_CHURCH_HISTORY");
    expect(asks("ano ang requirements sa binyag")).toBe("OPEN_BAPTISM");
  });
});
