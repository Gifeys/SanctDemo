import { describe, expect, it } from 'vitest'
import { historyScript, spokenLength, spokenSeconds } from './historyNarration'

const sections = [
  {
    heading: { en: 'Early Years', fil: 'Mga Unang Taon' },
    paragraphs: [
      { en: 'The parish was founded in 1954.', fil: 'Itinatag ang parokya noong 1954.' },
      { en: 'A chapel stood here first.', fil: 'May kapilya rito noong una.' },
    ],
  },
]

describe('historyScript', () => {
  it('reads the language that is on screen', () => {
    // The page already picks a language; the voice must not disagree
    // with the words the reader is looking at.
    expect(historyScript('Our Lady', sections, 'en')).toContain('The parish was founded in 1954.')
    expect(historyScript('Our Lady', sections, 'fil')).toContain('Itinatag ang parokya noong 1954.')
  })

  it('leads with the title', () => {
    expect(historyScript('Maria Auxiliadora', sections, 'en').startsWith('Maria Auxiliadora.')).toBe(true)
  })

  it('closes a heading so the voice pauses instead of running on', () => {
    // Otherwise: "Early Years the parish was founded in 1954".
    expect(historyScript('', sections, 'en')).toContain('Early Years.')
  })

  it('does not add a second full stop to a heading that has one', () => {
    const script = historyScript('', [{ heading: 'Our History.', paragraphs: ['A sentence.'] }], 'en')
    expect(script).toContain('Our History.')
    expect(script).not.toContain('Our History..')
  })

  it('separates parts by a blank line, which every engine reads as a pause', () => {
    expect(historyScript('Title', sections, 'en')).toContain('\n\n')
  })

  it('skips a heading with nothing under it', () => {
    // A label with no prose is furniture, not a chapter.
    const script = historyScript('', [{ heading: 'Gallery', paragraphs: [] }], 'en')
    expect(script).not.toContain('Gallery')
  })

  it('drops empty paragraphs rather than pausing at nothing', () => {
    const script = historyScript('', [{ heading: 'H', paragraphs: ['  ', 'Real text.'] }], 'en')
    expect(script).toContain('Real text.')
    expect(script.split('\n\n').filter(Boolean)).toHaveLength(2)
  })

  it('is empty when there is nothing to read', () => {
    // The caller's signal to show no speaker at all. A button that
    // speaks silence is worse than no button.
    expect(historyScript('', [], 'en')).toBe('')
  })

  it('still reads a history that has no title', () => {
    expect(historyScript('', sections, 'en')).toContain('The parish was founded in 1954.')
  })
})

describe('spokenLength', () => {
  it('says nothing for nothing', () => {
    expect(spokenLength('')).toBeNull()
    expect(spokenSeconds('')).toBe(0)
  })

  it('calls a short passage under a minute', () => {
    expect(spokenLength('Ten short words here to be read aloud right now.')).toBe('under a minute')
  })

  it('rounds a long history to whole minutes', () => {
    const long = Array.from({ length: 420 }, () => 'word').join(' ')
    expect(spokenLength(long)).toBe('about 3 min')
  })
})

describe('spokenLength, in Tagalog', () => {
  it('translates the duration, which sits inside a Tagalog button', () => {
    // "Pakinggan about 17 min" is the seam showing.
    const long = Array.from({ length: 420 }, () => 'salita').join(' ')
    expect(spokenLength(long, 'fil')).toBe('mga 3 min')
    expect(spokenLength('Sampung salita lamang ito na babasahin nang malakas ngayon.', 'fil'))
      .toBe('wala pang isang minuto')
  })

  it('still defaults to English', () => {
    expect(spokenLength('A short line of text here.')).toBe('under a minute')
  })
})
