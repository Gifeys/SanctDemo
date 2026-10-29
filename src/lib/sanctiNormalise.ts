/**
 * Making a real Filipino question look like the phrases Sancti knows.
 *
 * ## Why matching failed
 *
 * Intents are matched with `hay.includes(phrase)`, against phrase
 * lists written in tidy English and tidy Tagalog. Nobody types either.
 * They type "san po yung mapa", "anu oras po misa", "pano mag rosary"
 * - with the politeness particle, the shortened interrogative, and the
 * spelling they use in messages. None of that contains "nasaan ang
 * mapa", so Sancti answered UNKNOWN and looked like it only understood
 * the map, which happened to have the most phrases written for it.
 *
 * ## What this does, and deliberately does not do
 *
 * It rewrites the sentence into the shape the phrase lists expect:
 * drops particles that carry no meaning for matching, and expands the
 * shortenings people actually type. It does NOT translate, guess, or
 * reorder - a sentence that means nothing to Sancti after this still
 * means nothing, and that is the honest answer.
 *
 * Pure, so every one of these can be tested without the app.
 */

/**
 * Words that change politeness or emphasis and never the request.
 *
 * "po" and "ho" are respect markers. "ba" and "kaya" mark a question.
 * "naman", "nga", "lang", "sana" soften it. A pilgrim who writes "san
 * po ba yung mapa" is asking exactly what "saan ang mapa" asks, and
 * the only thing the extra words do is stop the phrase matching.
 */
const PARTICLES = new Set([
  "po", "ho", "ba", "kaya", "naman", "nga", "lang", "lng", "sana",
  "daw", "raw", "pala", "talaga", "ninyo", "niyo", "nyo", "mo",
  "please", "pls", "plz", "ty", "salamat",
]);

/**
 * How people actually type, mapped to what the phrase lists contain.
 *
 * Every entry here is a form seen in ordinary Filipino messaging, not
 * a theoretical misspelling. "san" for saan, "anu" for ano, "pano"
 * for paano, "yung" for ang - these are the normal written register,
 * not mistakes.
 */
const FORMS: Record<string, string> = {
  // interrogatives
  san: "saan", saan: "saan", nasan: "nasaan", nsan: "nasaan",
  asan: "nasaan", nasaan: "nasaan",
  anu: "ano", ano: "ano", anong: "ano", anung: "ano",
  pano: "paano", panu: "paano", ppano: "paano", paano: "paano",
  kelan: "kailan", kailan: "kailan", kelangan: "kailangan",
  magkano: "magkano", bkt: "bakit", bakit: "bakit",

  // articles and demonstratives that stand in for "ang"
  yung: "ang", ung: "ang", yng: "ang", ang: "ang", mga: "",

  // the verb people use for "open"
  // "buksan" only. NOT "bukas", which means both "open" and
  // "tomorrow" - and in a question it is nearly always tomorrow.
  // Mapping it to "open" turned "bukas?" (is there one tomorrow?)
  // into a request to open something.
  buksan: "open", punta: "go", pumunta: "go",
  tignan: "show", tingnan: "show", makita: "show", makikita: "show",
  hanap: "find", hanapin: "find", gamitin: "use", gamit: "use",

  // features, as they get typed
  mapa: "map", maps: "map",
  misa: "mass", mass: "mass", simba: "mass",
  simbahan: "church", simbhan: "church",
  kasaysayan: "history", history: "history",
  rosaryo: "rosary", rosaryohan: "rosary", rosario: "rosary",
  dasal: "prayer", panalangin: "prayer", magdasal: "pray",
  binyag: "baptism", kasal: "wedding", kumpil: "confirmation",
  ministeryo: "ministry", sakramento: "sacrament",
  balita: "announcements", patalastas: "announcements",
  iscan: "scan", escan: "scan", iskan: "scan",
  feature: "features", futures: "features",
};

/** Splits into words, keeping it simple and predictable. */
function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * The sentence, rewritten into the register the phrase lists use.
 *
 * Runs after the caller's own lowercasing and punctuation strip.
 */
export function expandFilipino(text: string): string {
  const out: string[] = [];

  for (const word of words(text)) {
    if (PARTICLES.has(word)) continue;
    const mapped = FORMS[word];
    if (mapped === "") continue;
    out.push(mapped ?? word);
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}
