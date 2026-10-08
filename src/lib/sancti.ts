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
  /** The parish the sentence named, if it named one. */
  parishId?: string;
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
export function understand(text: string, parishes: ParishName[]): Understanding {
  const hay = normalise(text);
  if (!hay) return { action: "UNKNOWN", score: 0 };

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

  // Naming a parish and nothing else is a request to open it.
  if (best.score < CONFIDENCE_FLOOR && parishId) {
    return { action: "OPEN_CHURCH", parishId, score: CONFIDENCE_FLOOR };
  }

  if (best.score < CONFIDENCE_FLOOR) return { action: "UNKNOWN", score: best.score };

  // "Tell me about Mary Help" reads as history; "open Mary Help" does
  // not. Both match OPEN_CHURCH's generic openers, so the more specific
  // intent is preferred whenever one also matched.
  const result: Understanding = { action: best.action, score: best.score };
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
