/**
 * Working out what a pilgrim is asking Sancti for.
 *
 * ## Why this is not a language model
 *
 * It was going to be Gemini, through the Express backend. That backend
 * is not deployed, which is exactly why the AI scanner does not work on
 * the phone today — and an assistant whose first act is to fail at a
 * dead URL is worse than no assistant. Everything here runs on the
 * device: it answers with no signal, costs nothing, and cannot be taken
 * down by a server being asleep.
 *
 * The trade is honest and worth stating: this understands the things
 * SanctiWalk can actually DO, in many phrasings, and says so plainly
 * when a question is outside that. It does not hold a conversation.
 * For a guide whose job is "take me to the map" and "what time is
 * Mass", that is the right shape.
 *
 * ## Why the triggers are bilingual and the setting is not consulted
 *
 * The language setting decides what Sancti SAYS. It has no say in what
 * it understands. Somebody reading the app in English still types
 * "anong oras ang misa", and a guide that refused that would be telling
 * a pilgrim their own language is the wrong one. Every intent below
 * carries its English, its Tagalog and the Taglish in between, and all
 * of them are live whatever the setting says.
 *
 * ## Why scoring, not a chain of `if (text.includes(...))`
 *
 * "Where is the map?" and "take me to Mary Help" both contain "ma".
 * A first-match chain answers whichever rule happened to be written
 * first, which is how these things end up confidently wrong. Every
 * intent scores itself against the sentence and the best score wins,
 * with a floor below which Sancti admits it did not understand rather
 * than guessing.
 */

export type SanctiAction =
  | "OPEN_MAP"
  | "OPEN_CHURCH"
  | "OPEN_AR"
  | "OPEN_MASS_SCHEDULE"
  | "OPEN_SACRAMENTS"
  | "OPEN_BAPTISM"
  | "OPEN_WEDDING"
  | "OPEN_MINISTRIES"
  | "OPEN_CHURCH_HISTORY"
  | "OPEN_SETTINGS"
  | "CREATE_REMINDER"
  | "SHOW_CHURCH_LOCATION"
  | "ANSWER_DISTANCE"
  | "ANSWER_CONTACT"
  | "HELP"
  | "UNKNOWN";

export interface Understanding {
  action: SanctiAction;
  /**
   * Whether the pilgrim told Sancti to do it, or asked about it.
   *
   * "Open the map" is an instruction. "Where is the map?" is a
   * question, and answering a question by throwing the pilgrim onto
   * another screen is how an assistant becomes something people stop
   * tapping. Same action, different consent.
   */
  imperative: boolean;
  /** The parish the sentence named, if it named one. */
  parishId?: string;
  /**
   * The individual ministry or sacrament the sentence named.
   *
   * "Open the ministries" is a list. "Open Teatro Pilipino" is one
   * ministry, and taking the pilgrim to a list of fifteen with theirs
   * somewhere in it is not what they asked for.
   */
  itemId?: string;
  /** For CREATE_REMINDER: the Mass time asked about, as written. */
  time?: string;
  /** How sure we are. Below CONFIDENCE_FLOOR the action is UNKNOWN. */
  score: number;
}

/** Below this, Sancti says it did not understand instead of guessing. */
export const CONFIDENCE_FLOOR = 2;

/**
 * Normalises a sentence for matching.
 *
 * Punctuation goes, case goes, and runs of whitespace collapse. Tagalog
 * and English are both left alone otherwise - pilgrims here type both,
 * often in the same sentence, and stripping either would make half the
 * questions unmatchable.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The phrases that point at each action.
 *
 * Longer phrases score higher than single words on purpose: "mass
 * schedule" should beat the bare "mass" that also appears in "where is
 * the mass" — and "take me to" should outrank the "map" that
 * SHOW_CHURCH_LOCATION and OPEN_MAP both answer to.
 */
const TRIGGERS: Array<{ action: SanctiAction; phrases: string[] }> = [
  {
    action: "OPEN_MASS_SCHEDULE",
    phrases: [
      "mass schedule", "schedule of mass", "what time is mass", "time of mass",
      "misa schedule", "oras ng misa", "anong oras ang misa", "next mass",
      "mass time", "mass times", "when is mass", "sunday mass",
      // Taglish, which is how people here actually type.
      "anong oras ang mass", "oras ng mass", "kailan ang misa", "kailan ang mass",
      "schedule ng misa", "schedule ng mass", "may misa ba", "anong oras misa",
    ],
  },
  {
    action: "CREATE_REMINDER",
    phrases: [
      "remind me", "set a reminder", "reminder", "alarm", "notify me",
      "paalala", "alalahanin", "paalalahanan mo ako", "remind mo ako",
      "paalalahanan", "i remind mo",
    ],
  },
  {
    action: "OPEN_BAPTISM",
    phrases: ["baptism", "binyag", "christening", "baptismal",
      "pabinyag", "magpabinyag", "paano magpabinyag"],
  },
  {
    action: "OPEN_WEDDING",
    phrases: ["wedding", "matrimony", "kasal", "marriage", "get married",
      "ikakasal", "magpakasal", "paano magpakasal"],
  },
  {
    action: "OPEN_SACRAMENTS",
    phrases: [
      "sacrament", "sacraments", "sakramento", "confirmation", "kumpil",
      "confession", "communion",
    ],
  },
  {
    action: "OPEN_MINISTRIES",
    phrases: [
      "ministry", "ministries", "ministeryo", "volunteer", "join a group",
      "altar server", "choir", "lector", "serve the parish",
      "sumali", "paano sumali", "maglingkod", "gusto kong sumali",
    ],
  },
  {
    action: "OPEN_CHURCH_HISTORY",
    phrases: [
      "history", "kasaysayan", "story of", "tell me about", "background",
      "when was it built", "who built",
      "kwento ng", "kuwento ng", "ano ang kasaysayan", "sino ang nagtayo",
    ],
  },
  {
    action: "OPEN_AR",
    phrases: [
      "ar", "augmented reality", "scanner", "scan", "camera", "how do i use ar",
      "ar tour", "point my camera", "paano gamitin ang scanner", "paano mag scan",
    ],
  },
  {
    action: "ANSWER_DISTANCE",
    phrases: [
      "how far", "distance", "gaano kalayo", "how long to get", "how many minutes",
      "how long does it take", "ilang minuto", "malayo ba", "gaano katagal",
    ],
  },
  {
    action: "SHOW_CHURCH_LOCATION",
    phrases: [
      "take me to", "directions", "navigate", "how do i get to", "bring me to",
      "paano pumunta", "show me on the map", "where is the church",
      "dalhin mo ako", "punta tayo", "saan ang simbahan", "paano papunta",
    ],
  },
  {
    action: "OPEN_MAP",
    phrases: ["map", "mapa", "where is the map", "open the map", "show the map",
      "nasaan ang map", "nasaan ang mapa", "buksan ang mapa"],
  },
  {
    action: "ANSWER_CONTACT",
    phrases: [
      "contact", "phone number", "email", "parish office", "call the parish",
      "office hours",
    ],
  },
  {
    action: "OPEN_SETTINGS",
    phrases: ["settings", "preferences", "my account", "notifications settings"],
  },
  {
    action: "OPEN_CHURCH",
    phrases: ["show me", "open", "go to", "information about", "tell me about"],
  },
  {
    action: "HELP",
    phrases: [
      "help", "what can you do", "who are you", "tulong", "what can i ask",
      // "pwede ba" is deliberately NOT here. It opens half the questions
      // people ask - "pwede ba mag apply for baptism" - so as a help
      // trigger it outscored the real intent and answered the wrong
      // question confidently. A test caught it.
      "how does this work", "ano ang kaya mo", "sino ka", "ano ang magagawa mo",
    ],
  },
];

/**
 * Phrases that make a sentence an instruction rather than a question.
 *
 * Kept apart from the intent triggers because they are orthogonal: any
 * intent can arrive either way, and the pilgrim who types "open the mass
 * schedule" wants exactly what the pilgrim who types "what time is mass"
 * does NOT want - the screen, now, without being asked.
 *
 * "Show me on the map" counts. It names the destination and the verb;
 * there is nothing left to confirm.
 */
const IMPERATIVES = [
  "open", "show me", "take me", "bring me", "go to", "navigate", "directions",
  "launch", "start", "let me see", "i want to see", "view",
  "buksan", "ipakita", "dalhin mo", "punta tayo", "pumunta", "tara",
  "gusto kong makita", "pakita", "pakibuksan", "sige",
];

/** Yes, in the languages and spellings people here actually type. */
const AFFIRMATIVES = [
  "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "okey", "go", "go ahead",
  "please", "please do", "do it", "open it", "sige", "oo", "opo", "oo nga",
  "sige na", "payag", "game", "tara",
];

/** No. Short, because a refusal usually is. */
const NEGATIVES = [
  "no", "nope", "not now", "later", "nah", "cancel", "never mind", "nevermind",
  "hindi", "ayaw", "ayoko", "wag", "huwag", "mamaya", "hindi muna",
];

/**
 * Whether the sentence is telling Sancti to do something.
 *
 * Matched on word boundaries, not substrings: "open" inside "opening
 * hours" is not an instruction, and treating it as one would make
 * "what are the opening hours" fling the pilgrim at a screen.
 */
export function isImperative(text: string): boolean {
  const hay = normalise(text);
  return IMPERATIVES.some(phrase => hasPhrase(hay, phrase));
}

/** True when `phrase` appears in `hay` as whole words. */
function hasPhrase(hay: string, phrase: string): boolean {
  const at = hay.indexOf(phrase);
  if (at === -1) return false;
  const before = at === 0 ? " " : hay[at - 1];
  const after = at + phrase.length >= hay.length ? " " : hay[at + phrase.length];
  return before === " " && after === " ";
}

/**
 * A bare yes or no, when Sancti has just asked something.
 *
 * Only consulted while an offer is open. Out of that context "no" is
 * part of a sentence rather than an answer, and reading it as consent -
 * or as a refusal - would be guessing.
 *
 * Returns null for anything that is not plainly one or the other, which
 * is how "yes but what time" stays a question rather than becoming a
 * yes to something else.
 */
export function readAnswer(text: string): "yes" | "no" | null {
  const hay = normalise(text).trim();
  if (!hay) return null;
  // Whole-sentence match. A yes buried in a longer sentence is that
  // sentence's business, not an answer to the offer.
  if (AFFIRMATIVES.includes(hay)) return "yes";
  if (NEGATIVES.includes(hay)) return "no";
  return null;
}

/**
 * The actions that take the pilgrim off this screen.
 *
 * These are the ones that need a yes when the sentence was a question.
 * Everything else either answers in place or changes nothing the
 * pilgrim can see, and stopping to ask about those would be a second
 * tap for nothing.
 */
export const NAVIGATING_ACTIONS: readonly SanctiAction[] = [
  "OPEN_MAP", "OPEN_CHURCH", "OPEN_AR", "OPEN_MASS_SCHEDULE", "OPEN_SACRAMENTS",
  "OPEN_BAPTISM", "OPEN_WEDDING", "OPEN_MINISTRIES", "OPEN_CHURCH_HISTORY",
  "OPEN_SETTINGS", "SHOW_CHURCH_LOCATION",
];

/**
 * Whether Sancti should offer rather than act.
 *
 * An instruction is consent already given. A question is not.
 */
export function needsConfirmation(heard: Understanding): boolean {
  if (heard.imperative) return false;
  return NAVIGATING_ACTIONS.includes(heard.action);
}

/**
 * One ministry or sacrament, by every name somebody might type for it.
 *
 * ## Why aliases rather than the name
 *
 * The compiled names are the parish's formal ones - "Ministry of Altar
 * Servers (MAS)", "Extraordinary Ministers of Holy Communion (EMHC)" -
 * and nobody types those. People type "altar servers", or "emhc", or
 * the choir's name with the ministry word left off.
 */
export interface NamedItem {
  id: string;
  kind: "ministry" | "sacrament";
  /** Already normalised. Longest match wins. */
  aliases: string[];
}

/**
 * Words that carry no identity.
 *
 * Dropping them is what lets "altar servers" find "Ministry of Altar
 * Servers": the alias becomes the distinctive part, and a sentence
 * containing those words alone matches it.
 */
const GENERIC_WORDS = new Set([
  "ministry", "ministries", "ministers", "ministeryo", "of", "the", "and",
  "on", "for", "to", "a", "ng", "sa", "at", "mga",
]);

/**
 * The shortest acronym worth matching.
 *
 * Three letters collide with real words - "MAS" is Tagalog for "more",
 * and as an alias it hijacked "mas maaga ba ang misa". Four is long
 * enough that a collision is somebody actually naming the ministry.
 */
const MIN_ACRONYM = 4;

/** Filipino and Pilipino are the same word to everyone who types it. */
function spellingVariants(text: string): string[] {
  const swapped = text.replace(/\bfilipino\b/g, "pilipino");
  const back = text.replace(/\bpilipino\b/g, "filipino");
  return [...new Set([text, swapped, back])];
}

/** Every way somebody might name this ministry or sacrament. */
export function itemAliases(
  id: string,
  displayName: string,
  kind: "ministry" | "sacrament",
): NamedItem {
  const full = normalise(displayName);
  const aliases = new Set<string>();

  // The parenthesised acronym, when it is long enough to be safe.
  const acronym = /\(([^)]+)\)/.exec(displayName)?.[1];
  if (acronym && acronym.length >= MIN_ACRONYM) aliases.add(normalise(acronym));

  const withoutAcronym = normalise(displayName.replace(/\([^)]*\)/g, ""));
  const distinctive = withoutAcronym
    .split(" ")
    .filter(word => word && !GENERIC_WORDS.has(word))
    .join(" ");

  for (const base of [full, withoutAcronym, distinctive]) {
    for (const variant of spellingVariants(base)) {
      if (variant.trim()) aliases.add(variant.trim());
    }
  }

  return { id, kind, aliases: [...aliases] };
}

/** Levenshtein distance, capped: anything past `max` is simply "too far". */
function withinEdits(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] <= max;
}

/**
 * Whether a word of the alias appears in the sentence.
 *
 * A single mistyped letter is forgiven on words long enough for that to
 * be unambiguous - "teatri" for "teatro". Short words are matched
 * exactly, because at four letters an edit of one turns half the
 * dictionary into half the rest of it.
 */
const MIN_FUZZY = 5;

function wordPresent(word: string, haystack: string[]): boolean {
  if (haystack.includes(word)) return true;
  if (word.length < MIN_FUZZY) return false;
  return haystack.some(token =>
    token.length >= MIN_FUZZY && withinEdits(word, token, 1));
}

/**
 * The ministry or sacrament the sentence names, if it names one.
 *
 * Two of the alias's words are enough, and the alias that matches the
 * most words wins.
 *
 * Not all of them, because nobody says the whole name: "Teatro Pilipino
 * Choir" is asked for as "teatro pilipino", and requiring every word
 * meant the one ministry anybody names by name was the one Sancti could
 * not find. Two, because a single shared word - "choir", which six of
 * these have, or "ministry", which is stripped anyway - identifies
 * nothing. A one-word alias is an acronym, and those match alone.
 */
const MIN_ALIAS_WORDS = 2;

export function findNamedItem(
  text: string,
  items: NamedItem[],
): NamedItem | undefined {
  const tokens = normalise(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return undefined;

  let best: { item: NamedItem; matched: number } | null = null;

  for (const item of items) {
    for (const alias of item.aliases) {
      const words = alias.split(" ").filter(Boolean);
      if (words.length === 0) continue;

      const matched = words.filter(word => wordPresent(word, tokens)).length;
      if (matched < Math.min(MIN_ALIAS_WORDS, words.length)) continue;
      if (!best || matched > best.matched) best = { item, matched };
    }
  }

  return best?.item;
}

export interface ParishName {
  id: string;
  /** Every way someone might type it, already normalised. */
  aliases: string[];
}

/**
 * Builds the alias list for a parish from its display name.
 *
 * The compiled names carry suffixes nobody says out loud - "Mary Help
 * of Christians Parish Guide" - so the suffixes are stripped, and the
 * distinctive words are kept as a shorter alias. Nobody types the whole
 * thing into a chat box.
 */
export function aliasesFor(id: string, displayName: string): ParishName {
  const clean = normalise(
    displayName.replace(/\b(guide|tour)\b/gi, ""),
  );
  const withoutParish = clean.replace(/\b(parish|cathedral)\b/g, "").replace(/\s+/g, " ").trim();

  const aliases = new Set<string>([clean, withoutParish]);

  // The initials people actually use for these two.
  if (/mary help/.test(clean)) { aliases.add("mary help"); aliases.add("mhcp"); }
  if (/san roque/.test(clean)) { aliases.add("san roque"); aliases.add("src"); }

  return { id, aliases: [...aliases].filter(Boolean) };
}

/** Which parish the sentence named, if any. Longest alias wins. */
export function findParish(text: string, parishes: ParishName[]): string | undefined {
  const hay = normalise(text);
  let best: { id: string; length: number } | null = null;

  for (const parish of parishes) {
    for (const alias of parish.aliases) {
      if (alias.length >= 3 && hay.includes(alias)) {
        if (!best || alias.length > best.length) best = { id: parish.id, length: alias.length };
      }
    }
  }
  return best?.id;
}

/**
 * A clock time written in any of the ways people write one.
 *
 * Returned as it would be typed on a schedule - "6:00 PM" - because
 * that is what it has to be matched against.
 */
export function findTime(text: string): string | undefined {
  const m = normalise(text).match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|nn|hapon|umaga)?\b/);
  if (!m) return undefined;

  const hour = Number(m[1]);
  if (hour < 1 || hour > 24) return undefined;
  const minutes = m[2] ?? "00";

  let suffix = m[3];
  if (suffix === "hapon" || suffix === "nn") suffix = "pm";
  if (suffix === "umaga") suffix = "am";

  if (!suffix) {
    // 24-hour, or a bare number. Anything from 13 up is unambiguous;
    // below that it is a guess, and the caller checks the real schedule
    // before acting on it anyway.
    if (hour > 12) {
      const h12 = hour - 12;
      return `${h12}:${minutes} PM`;
    }
    return undefined;
  }

  return `${hour}:${minutes} ${suffix.toUpperCase()}`;
}

/**
 * What the sentence is asking for.
 *
 * Scores every intent and takes the best. A phrase scores its own word
 * count, so a three-word match beats a one-word match that happens to
 * sit inside it.
 */
export function understand(
  text: string,
  parishes: ParishName[],
  items: NamedItem[] = [],
): Understanding {
  const hay = normalise(text);
  if (!hay) return { action: "UNKNOWN", score: 0, imperative: false };

  const imperative = isImperative(hay);

  let best: { action: SanctiAction; score: number } = { action: "UNKNOWN", score: 0 };

  for (const { action, phrases } of TRIGGERS) {
    let score = 0;
    for (const phrase of phrases) {
      if (!hay.includes(phrase)) continue;
      // Word count, so a longer phrase outranks a shorter one inside it.
      score = Math.max(score, phrase.split(" ").length + 1);
    }
    if (score > best.score) best = { action, score };
  }

  const parishId = findParish(hay, parishes);

  // A named ministry or sacrament outranks everything.
  //
  // "Open Teatro Pilipino" matched OPEN_MINISTRIES on the word
  // "ministry" and nothing else, so it opened a list of fifteen with
  // the pilgrim's somewhere in it. Naming one is a request for that
  // one, and it is a stronger signal than any generic trigger - which
  // is why it is checked before the score floor rather than after.
  const named = findNamedItem(hay, items);
  if (named) {
    const result: Understanding = {
      action: named.kind === "ministry" ? "OPEN_MINISTRIES" : "OPEN_SACRAMENTS",
      itemId: named.id,
      score: CONFIDENCE_FLOOR + 1,
      imperative,
    };
    if (parishId) result.parishId = parishId;
    return result;
  }

  // Naming a parish and nothing else is a request to open it.
  if (best.score < CONFIDENCE_FLOOR && parishId) {
    return { action: "OPEN_CHURCH", parishId, score: CONFIDENCE_FLOOR, imperative };
  }

  if (best.score < CONFIDENCE_FLOOR) return { action: "UNKNOWN", score: best.score, imperative };

  // "Tell me about Mary Help" reads as history; "open Mary Help" does
  // not. Both match OPEN_CHURCH's generic openers, so the more specific
  // intent is preferred whenever one also matched.
  const result: Understanding = { action: best.action, score: best.score, imperative };
  if (parishId) result.parishId = parishId;
  if (best.action === "CREATE_REMINDER") {
    const time = findTime(text);
    if (time) result.time = time;
  }
  return result;
}

/** What the chat offers before anyone has typed anything. */
export const SUGGESTIONS = [
  "What time is Mass?",
  "Where is the map?",
  "Is baptism available?",
  "How do I use the scanner?",
  "Tell me the history",
] as const;
