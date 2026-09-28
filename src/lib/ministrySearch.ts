import type { Ministry } from '../data'

/**
 * Finding a ministry among fifteen, by typing what you actually remember.
 *
 * People do not remember "Ministry of Lectors and Commentators (MLC)". They
 * remember "lector", or "MLC", or "yung nagbabasa" — so matching only the
 * start of the official name finds almost nothing. What this handles, in the
 * order it matters:
 *
 *  - **Any word, anywhere.** "servants" finds Singing Servants of Christ.
 *  - **Acronyms.** The parish's own names carry them in brackets — MAS,
 *    EMHC, SOCCOM — and they are what a member says out loud.
 *  - **The description too**, because "musika" should find the choirs even
 *    though none of them has that word in its name.
 *  - **Accents and case ignored**, so "nino" finds "Niño" and nobody has to
 *    find the tilde on a phone keyboard.
 *
 * Every term must match something, but they may match different fields, so
 * "youth choir" finds Marian Youth Choir.
 */

/** Lower case, accents stripped, punctuation flattened to spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The bracketed short name a parish actually says: "(EMHC)" -> "emhc". */
export function acronymOf(name: string): string {
  const bracketed = name.match(/\(([^)]+)\)/)
  if (!bracketed) return ''

  const raw = bracketed[1].trim()
  const letters = raw.replace(/[^A-Za-z]/g, '')
  if (letters.length === 0 || letters.length > 8) return ''

  // Mostly capitals is what makes it an acronym rather than a word.
  //
  // Length alone is not enough: "(choir)" is short and spaceless and would
  // pass, which would make every choir answer to a word that describes a
  // category rather than naming one ministry. Capitalisation separates them
  // cleanly, and the threshold is 0.6 rather than 1.0 so that genuinely
  // mixed forms like "(AnP)" still count.
  const capitals = letters.replace(/[^A-Z]/g, '').length
  if (capitals / letters.length < 0.6) return ''

  return normalize(raw)
}

function haystack(m: Ministry): string {
  return [normalize(m.name), acronymOf(m.name), normalize(m.description)]
    .filter(Boolean)
    .join(' ')
}

export function searchMinistries(ministries: Ministry[], query: string): Ministry[] {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (terms.length === 0) return ministries

  return ministries.filter(m => {
    const hay = haystack(m)
    return terms.every(term => hay.includes(term))
  })
}

/**
 * The chips shown before anyone types.
 *
 * Not a fixed list: each one is checked against the ministries actually
 * present and dropped if it would find nothing, so a suggestion can never
 * lead to an empty screen. A parish with no choir does not get a "Choir"
 * chip.
 */
const CANDIDATES = ['Choir', 'Kabataan', 'Liturhiya', 'Panalangin', 'Altar', 'Musika']

export function suggestionsFor(ministries: Ministry[]): string[] {
  return CANDIDATES.filter(c => searchMinistries(ministries, c).length > 0).slice(0, 5)
}
