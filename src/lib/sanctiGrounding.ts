/**
 * The facts Sancti is allowed to state, and where each one came from.
 *
 * ## Why this exists
 *
 * Sancti's answers were only ever as current as whatever happened to be
 * compiled into the bundle. Three separate things made that inaccurate,
 * and all three are structural rather than wording:
 *
 * 1. Live admin-managed content was consulted ONLY for the parish the
 *    pilgrim currently had open. Ask about any other parish and the
 *    answer silently fell back to the compiled schedule - so a parish
 *    office could move its Mass in the admin portal and Sancti would
 *    keep quoting the old time to everybody not standing in that parish.
 * 2. Nothing ever said how old a fact was, though `updatedAt` has been
 *    on every parish document all along.
 * 3. "Missing" and "nothing published" were indistinguishable, so an
 *    empty requirements list read as "there are no requirements".
 *
 * ## The contract
 *
 * Everything in here is VERIFIED - it came from the parish's own
 * document or the app's compiled data, never from a language model.
 * A `Fact` is something Sancti may state. A `Gap` is something it was
 * asked for and does not have, and must say it does not have. Anything
 * that is neither is not an answer about this parish.
 *
 * Pure and dependency-free, so the rules can be tested without Firebase,
 * a network or a model.
 */
import type { ParishContent } from './parishContent'
import type { MassScheduleEntry } from './schedule'

/** A single verified statement, with its provenance. */
export interface Fact {
  /** What this is about: 'mass', 'history', 'contact', an item id. */
  topic: string
  /** The fact itself, already in words. */
  value: string
  /**
   * Where it came from. 'parish' is the office's own entry through the
   * admin portal; 'app' is SanctiWalk's compiled data, which is correct
   * but not maintained by that parish.
   */
  source: 'parish' | 'app'
  /** ISO timestamp of the parish's last edit, when the document carries one. */
  updatedAt?: string
}

/** Something asked for that genuinely is not known. */
export interface Gap {
  topic: string
  /** Said to the pilgrim verbatim, so the wording is reviewed here. */
  reason: string
}

export interface Grounding {
  parishId: string
  parishName: string
  facts: Fact[]
  gaps: Gap[]
}

/** Readable times for one day, skipping any the parish has suspended. */
export function liveTimesFor(entry: MassScheduleEntry): string[] {
  const suspended = new Set(
    (((entry as { suspended?: string[] }).suspended) ?? []).map(t => t.trim().toLowerCase()),
  )
  return entry.time
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0 && !suspended.has(t.toLowerCase()))
}

/**
 * The Mass schedule as a fact, or a gap when there is none.
 *
 * The parish's own entry always wins over the compiled one - that is the
 * precedence the Mass card already uses, and Sancti disagreeing with the
 * card on the same screen is its own kind of wrong. Unlike before, this
 * applies to EVERY parish, not only the one currently open.
 */
export function massFact(
  parishContent: ParishContent | null | undefined,
  compiled: MassScheduleEntry[] | null | undefined,
): Fact | Gap {
  const parish = parishContent?.massSchedule
  const usingParish = Boolean(parish && parish.length > 0)
  const chosen = usingParish ? parish : compiled
  const source: 'parish' | 'app' = usingParish ? 'parish' : 'app'

  if (!chosen || chosen.length === 0) {
    return {
      topic: 'mass',
      reason: 'No Mass schedule has been published for this parish.',
    }
  }

  const lines = chosen
    .map(entry => {
      const times = liveTimesFor(entry)
      if (times.length === 0) return `${entry.day}: no Mass currently scheduled`
      return `${entry.day}: ${times.join(', ')}`
    })
    .join('; ')

  return {
    topic: 'mass',
    value: lines,
    source,
    updatedAt: source === 'parish' ? parishContent?.updatedAt : undefined,
  }
}

/** Whether a value is a Gap rather than a Fact. */
export function isGap(v: Fact | Gap): v is Gap {
  return (v as Gap).reason !== undefined
}

/**
 * What the parish has published about one ministry or sacrament.
 *
 * Each sub-field is weighed separately. A parish that has written an
 * "about" but no requirements has published one thing and not the other,
 * and collapsing that into a single yes/no is how "requirements not
 * listed" turns into "there are no requirements".
 */
export function itemFacts(
  parishContent: ParishContent | null | undefined,
  itemId: string,
  itemName: string,
): { facts: Fact[]; gaps: Gap[] } {
  const content = parishContent?.itemContent?.[itemId]
  const facts: Fact[] = []
  const gaps: Gap[] = []
  const at = parishContent?.updatedAt

  const add = (topic: string, value: string | undefined) => {
    const trimmed = value?.trim()
    if (trimmed) facts.push({ topic, value: trimmed, source: 'parish', updatedAt: at })
  }
  const addList = (topic: string, values: string[] | undefined) => {
    const cleaned = (values ?? []).map(v => v.trim()).filter(Boolean)
    if (cleaned.length > 0) {
      facts.push({ topic, value: cleaned.join('; '), source: 'parish', updatedAt: at })
    }
  }

  add(`${itemId}.about`, content?.about)
  addList(`${itemId}.requirements`, content?.requirements)
  add(`${itemId}.schedule`, content?.schedule)
  addList(`${itemId}.process`, content?.process)
  add(`${itemId}.contact`, content?.contact)

  if (!content?.requirements?.some(r => r.trim())) {
    gaps.push({
      topic: `${itemId}.requirements`,
      reason: `${itemName} requirements have not been published by this parish.`,
    })
  }
  if (!content?.schedule?.trim()) {
    gaps.push({
      topic: `${itemId}.schedule`,
      reason: `No ${itemName.toLowerCase()} schedule has been published by this parish.`,
    })
  }

  return { facts, gaps }
}

/**
 * Whether this parish can be said to OFFER something.
 *
 * Deliberately strict, and deliberately not the inverse of
 * closedApplications. A parish with no document at all is open for
 * applications - that is the rule availability.ts encodes and it is the
 * right one for a form. It is the wrong one for a sentence: "yes, they
 * do baptisms" said on the strength of no data is exactly the claim
 * requirement 3 forbids. Silence here means "not stated", and the only
 * honest answer is to send the pilgrim to the office.
 */
export function offersItem(
  parishContent: ParishContent | null | undefined,
  itemId: string,
): 'yes' | 'no' | 'unstated' {
  if (parishContent?.closedApplications?.includes(itemId)) return 'no'
  const content = parishContent?.itemContent?.[itemId]
  const published = Boolean(
    content?.about?.trim() ||
      content?.schedule?.trim() ||
      content?.requirements?.some(r => r.trim()) ||
      content?.process?.some(p => p.trim()),
  )
  return published ? 'yes' : 'unstated'
}

/** How old a fact is, in plain words, or null when it carries no date. */
export function freshnessNote(fact: Fact, now: Date = new Date()): string | null {
  if (fact.source !== 'parish' || !fact.updatedAt) return null
  const then = new Date(fact.updatedAt)
  if (Number.isNaN(then.getTime())) return null

  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000)
  if (days < 0) return null
  if (days === 0) return 'updated by the parish today'
  if (days === 1) return 'updated by the parish yesterday'
  if (days < 30) return `updated by the parish ${days} days ago`
  if (days < 365) return `last updated by the parish ${Math.floor(days / 30)} months ago`
  return 'last updated by the parish over a year ago'
}

/**
 * The grounding block handed to the model.
 *
 * Facts and gaps are both listed, and the gaps are not padding: a model
 * given only facts will fill a silence, and the thing it fills it with
 * is a plausible Mass time. Naming the gap explicitly is what turns
 * an admission of ignorance into the expected answer rather than a
 * failure to answer.
 */
export function groundingBlock(g: Grounding, now: Date = new Date()): string {
  const lines: string[] = [`PARISH: ${g.parishName}`]

  if (g.facts.length === 0) {
    lines.push('VERIFIED FACTS: none available for this parish.')
  } else {
    lines.push('VERIFIED FACTS (you may state these):')
    for (const f of g.facts) {
      const fresh = freshnessNote(f, now)
      const origin =
        f.source === 'parish'
          ? `parish office${fresh ? `, ${fresh}` : ''}`
          : 'SanctiWalk app data, not maintained by this parish'
      lines.push(`- [${f.topic}] ${f.value} (source: ${origin})`)
    }
  }

  if (g.gaps.length > 0) {
    lines.push('NOT AVAILABLE (you must say these are not available, never guess):')
    for (const gap of g.gaps) lines.push(`- [${gap.topic}] ${gap.reason}`)
  }

  return lines.join('\n')
}
