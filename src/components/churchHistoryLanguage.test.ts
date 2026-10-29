import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { isBilingual } from "../lib/language";
import { MHCP_HISTORY } from "../data/mhcpHistory";

/**
 * Every word of a parish's history must exist in both languages.
 *
 * `pick` falls back to the other language rather than rendering a
 * blank, which is the right behaviour and also the reason this went
 * unnoticed: the app was set to Filipino and quietly served English,
 * looking like a translation that had not loaded rather than one that
 * had never been written.
 *
 * Both parishes' opening sections were plain strings while everything
 * around them was bilingual, and San Roque had nothing else at all,
 * so its history was English from top to bottom.
 */
describe("the parish histories exist in both languages", () => {
  const source = readFileSync("src/components/ChurchHistory.tsx", "utf8");

  it("has no plain-string heading anywhere, compiled or admin-written", () => {
    // A bilingual heading is written `heading: { en:`. A monolingual
    // one is `heading: "`, which is exactly what was wrong.
    //
    // The admin path is included deliberately. Its BODY is the
    // parish's own words and stays in whichever language they typed,
    // but the heading above it is ours and has no excuse.
    const monolingual = source.match(/heading:\s*"/g) ?? [];
    expect(monolingual).toEqual([]);
  });

  it("has no plain-string paragraph left in the compiled sections", () => {
    // Paragraphs are a list; a monolingual one starts the line with a
    // quote where a bilingual one starts with a brace.
    const block = source.slice(
      source.indexOf("const PARISH_HISTORY"),
      source.indexOf("};", source.indexOf("const PARISH_HISTORY")),
    );
    const plainParagraphs = block
      .split("\n")
      .map(line => line.trim())
      .filter(line => /^"[A-Z]/.test(line));
    expect(plainParagraphs).toEqual([]);
  });

  it("keeps the parish's own account bilingual throughout", () => {
    // mhcpHistory.ts was already right; this stops it drifting.
    for (const section of MHCP_HISTORY) {
      expect(isBilingual(section.heading)).toBe(true);
      for (const paragraph of section.paragraphs) {
        expect(isBilingual(paragraph)).toBe(true);
      }
    }
  });

  it("gives both parishes a Filipino opening", () => {
    // Named explicitly because San Roque had none: its history was
    // English however the app was set.
    expect(source).toContain("Ang Aming Kasaysayan");
    expect(source).toContain("Ang Aming Patrona");
    expect(source).toContain("Ang Aming Patron\"");
  });
});
