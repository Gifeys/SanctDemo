import type { Language } from './language'

/**
 * Choosing a voice locale the handset actually has.
 *
 * ## Why asking for fil-PH is not enough
 *
 * speechLocale returns 'fil-PH' for Filipino, which is the correct
 * request and frequently not an available one: Filipino text-to-speech
 * is a downloadable voice, absent on plenty of Android handsets and on
 * most desktops. The engine does not refuse an unavailable locale - it
 * reads the text in whatever its default voice is, which is nearly
 * always English. So a Tagalog history came out in an English voice
 * pronouncing Tagalog as though it were English, with nothing on
 * screen saying why.
 *
 * The same trap as the Rosary's recogniser, in the other direction,
 * and it deserves the same answer: ask for what the device has.
 *
 * ## The order
 *
 * fil-PH and tl-PH are the same language under two tags, and which one
 * a device reports is not predictable. en-PH before en-US because a
 * Philippine English voice says Filipino place and saint names far
 * closer to right than an American one - "Caloocan", "Baclaran",
 * "Nuestra Señora".
 */
export function localeChain(language: Language): string[] {
  return language === 'fil'
    ? ['fil-PH', 'tl-PH', 'fil', 'tl', 'en-PH', 'en-US']
    : ['en-PH', 'en-US', 'en-GB', 'en']
}

/**
 * The first locale in the chain the device offers.
 *
 * Matched loosely: a device may report 'fil_PH', 'fil-PH' or bare
 * 'fil', and treating those as different is how a handset that HAS the
 * voice gets told it does not.
 *
 * Returns null when the device lists nothing usable, which lets the
 * caller say the voice is missing rather than read Tagalog in English.
 */
export function pickLocale(
  language: Language,
  available: readonly string[],
): string | null {
  const normalise = (s: string) => s.toLowerCase().replace('_', '-')
  const have = available.map(normalise)

  for (const wanted of localeChain(language)) {
    const target = normalise(wanted)
    // Exact first, then a device tag that starts with it ('fil' must
    // match 'fil-PH'), then one it is a prefix of.
    const hit =
      have.indexOf(target) !== -1
        ? target
        : have.find(h => h === target || h.startsWith(`${target}-`))
    if (hit) return available[have.indexOf(hit)]
  }

  return null
}

/**
 * Whether the voice that will be used is the language that was asked
 * for, rather than a fallback.
 *
 * The caller shows this: being read Tagalog by an English voice is a
 * poor experience, but an unexplained one is worse.
 */
export function isFallback(language: Language, chosen: string | null): boolean {
  if (!chosen) return true
  if (language !== 'fil') return false
  const c = chosen.toLowerCase()
  return !(c.startsWith('fil') || c.startsWith('tl'))
}
