/**
 * Reading a scan result aloud.
 *
 * ## Why a scan especially needs a voice
 *
 * The other places this app speaks are places you sit down to read. A
 * scan result is read standing in front of a statue, often in low light,
 * frequently by somebody older than the phone they are holding. It is
 * the screen most likely to be squinted at and the one where looking up
 * at the thing itself matters more than looking down.
 *
 * ## What is read, and in what order
 *
 * Name, then what was seen, then who the saint was, then the short
 * facts. That is the order the card itself uses, and the order a guide
 * would use out loud: say what it is before explaining it.
 *
 * The provenance line is NOT read. On the page it is a quiet caveat the
 * eye can take in at a glance; spoken, "general Catholic information,
 * not parish record" lands with the same weight as the history itself
 * and interrupts the one part worth hearing. The label stays visible
 * for anyone checking.
 *
 * Pure, so what gets spoken can be tested without a speech engine.
 */

/** The fields of a scan result that are worth hearing. */
export interface NarratableResult {
  title?: string
  summary?: string
  saintName?: string
  feastDay?: string
  patronage?: string
  aboutSaint?: string
  highlights?: string[]
}

/**
 * A heading ends with a full stop so the voice drops and pauses.
 *
 * Without it the engine runs one part into the next - "Feast day October
 * 4 patron of animals" - which is the clearest sign a page is being read
 * by a machine rather than read out.
 */
function asSentence(text: string | undefined): string {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * What the speaker button reads for a scan result.
 *
 * Returns an empty string when there is nothing worth hearing, which is
 * the caller's signal to show no button: a speaker that speaks a title
 * and stops is worse than no speaker.
 */
export function scanScript(result: NarratableResult, language: 'en' | 'fil' = 'en'): string {
  const parts: string[] = []

  const title = asSentence(result.title)
  if (title) parts.push(title)

  const summary = (result.summary ?? '').trim()
  if (summary) parts.push(summary)

  // Who they were, introduced so the shift from "what I saw" to "who
  // this is" is audible. Without the lead-in the two run together as
  // one undifferentiated paragraph.
  const about = (result.aboutSaint ?? '').trim()
  if (about) {
    const who = (result.saintName ?? '').trim()
    parts.push(language === 'fil' ? `Tungkol kay ${who || 'kanya'}.` : `About ${who || 'this saint'}.`)

    const feast = (result.feastDay ?? '').trim()
    if (feast) {
      parts.push(language === 'fil' ? `Kapistahan: ${asSentence(feast)}` : `Feast day: ${asSentence(feast)}`)
    }

    const patron = (result.patronage ?? '').trim()
    if (patron) {
      parts.push(
        language === 'fil' ? `Patron ng ${asSentence(patron)}` : `Patron of ${asSentence(patron)}`,
      )
    }

    parts.push(about)
  }

  const highlights = (result.highlights ?? []).map(h => h.trim()).filter(Boolean)
  if (highlights.length > 0) {
    parts.push(...highlights.map(h => asSentence(h)))
  }

  // Nothing but a name is not worth a button.
  if (parts.length < 2) return ''

  // Blank lines between parts: every engine treats a paragraph break as
  // a longer pause than a full stop, which is the difference between
  // being told about something and being read a list.
  return parts.join('\n\n')
}
