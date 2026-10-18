/**
 * Turning a parish history into something that can be read aloud.
 *
 * ## Why the script is not just the page text
 *
 * The history page carries more than the history. There is a note
 * explaining that the Filipino is the original, captions under the
 * photographs, and a "Sanggunian:" credit on each one. All of that is
 * there for someone looking at the page. Read aloud it becomes "source
 * colon National Historical Commission" every few sentences, and the
 * listener loses the thread of the story the parish is actually
 * telling. So the script is the title, the headings and the prose -
 * nothing that only makes sense next to a photograph.
 *
 * ## Why it is assembled rather than read from the DOM
 *
 * Reading the rendered text would pick up whatever is on screen,
 * including the quiz at the bottom and any future furniture. Building
 * it from the same data the page renders keeps the two honest without
 * tying narration to the markup.
 *
 * Pure, so what gets spoken can be tested without a speech engine.
 */
import { pick, type Bilingual, type Language } from './language'

/** The shape ChurchHistory already uses; repeated here to stay dependency-free. */
export interface NarratableSection {
  heading: Bilingual | string
  paragraphs: (Bilingual | string)[]
}

/**
 * A heading ends with a full stop so the voice drops and pauses.
 *
 * Without it the engine runs the heading straight into the first
 * sentence - "Early Years the parish was founded" - which is the
 * clearest sign a page is being read by a machine rather than read
 * out.
 */
function asSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * What the speaker button reads, in the language on screen.
 *
 * Returns an empty string when there is nothing to read, which is the
 * caller's signal to show no button at all: a speaker that speaks
 * silence is worse than no speaker.
 */
export function historyScript(
  title: string,
  sections: NarratableSection[],
  language: Language,
): string {
  const parts: string[] = []

  const spokenTitle = asSentence(title)
  if (spokenTitle) parts.push(spokenTitle)

  for (const section of sections) {
    const heading = asSentence(pick(section.heading, language))
    // A heading with nothing under it is a label, not a chapter.
    const paragraphs = section.paragraphs
      .map(p => pick(p, language).trim())
      .filter(Boolean)

    if (paragraphs.length === 0) continue
    if (heading) parts.push(heading)
    parts.push(...paragraphs)
  }

  // Blank lines between parts: every engine treats a paragraph break as
  // a longer pause than a full stop, which is the difference between
  // listening to a history and listening to a list.
  return parts.join('\n\n')
}

/**
 * Roughly how long the reading will take, in seconds.
 *
 * Only ever used to tell the listener what they are committing to
 * before they tap. Deliberately approximate - the engines differ, and
 * a precise-looking number that is wrong is worse than a round one.
 * 140 words per minute is a shade under conversational pace, matching
 * the RATE the speech module asks for.
 */
export function spokenSeconds(script: string): number {
  const words = script.split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.round((words / 140) * 60)
}

/**
 * "about 3 min", in the language on screen, or null when there is
 * nothing to read.
 *
 * Translated because it sits inside a Tagalog button, beside a Tagalog
 * verb. An English duration there is the seam showing.
 */
export function spokenLength(script: string, language: Language = 'en'): string | null {
  const seconds = spokenSeconds(script)
  if (seconds === 0) return null

  if (language === 'fil') {
    if (seconds < 60) return 'wala pang isang minuto'
    return `mga ${Math.round(seconds / 60)} min`
  }

  if (seconds < 60) return 'under a minute'
  return `about ${Math.round(seconds / 60)} min`
}
