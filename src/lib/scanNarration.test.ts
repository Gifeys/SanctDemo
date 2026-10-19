import { describe, expect, it } from 'vitest'
import { scanScript } from './scanNarration'

const saint = {
  title: 'Statue of Saint Francis of Assisi',
  summary: 'A friar in a brown habit holding a bird, with a cord of three knots.',
  saintName: 'Saint Francis of Assisi',
  feastDay: 'October 4',
  patronage: 'animals and ecology',
  aboutSaint: 'He was born in Umbria in 1181 and founded the Franciscan order.',
  highlights: ['The three knots are poverty, chastity and obedience.'],
}

describe('scanScript', () => {
  it('names it first, then explains - the order a guide would use', () => {
    const script = scanScript(saint, 'en')
    expect(script.indexOf('Saint Francis of Assisi')).toBeLessThan(script.indexOf('born in Umbria'))
  })

  it('reads what was seen and who they were', () => {
    const script = scanScript(saint, 'en')
    expect(script).toContain('brown habit')
    expect(script).toContain('founded the Franciscan order')
  })

  it('marks the shift from what I saw to who this is', () => {
    // Without a lead-in the two run together as one paragraph and the
    // listener cannot tell where the description ended.
    expect(scanScript(saint, 'en')).toContain('About Saint Francis of Assisi.')
  })

  it('reads the feast day and patronage as labelled facts', () => {
    const script = scanScript(saint, 'en')
    expect(script).toContain('Feast day: October 4.')
    expect(script).toContain('Patron of animals and ecology.')
  })

  it('leaves out a feast day the model declined to guess', () => {
    // The server leaves these empty rather than inventing them; the
    // voice must not announce an empty label.
    const script = scanScript({ ...saint, feastDay: '', patronage: '   ' }, 'en')
    expect(script).not.toContain('Feast day')
    expect(script).not.toContain('Patron of')
    expect(script).toContain('founded the Franciscan order')
  })

  it('speaks the labels in Tagalog when the app is in Tagalog', () => {
    const script = scanScript(saint, 'fil')
    expect(script).toContain('Tungkol kay Saint Francis of Assisi.')
    expect(script).toContain('Kapistahan: October 4.')
  })

  it('handles something that is not a saint at all', () => {
    // Most scans are not saints - an altar, a window, a bell.
    const script = scanScript({
      title: 'Carved wooden pulpit',
      summary: 'An elevated pulpit with a canopy above it.',
      highlights: ['The canopy projects the preacher voice.'],
    })
    expect(script).toContain('Carved wooden pulpit.')
    expect(script).not.toContain('About')
  })

  it('closes each part so the voice pauses instead of running on', () => {
    const script = scanScript(saint, 'en')
    expect(script).toContain('Statue of Saint Francis of Assisi.')
    expect(script).toContain('\n\n')
  })

  it('does not double a full stop that is already there', () => {
    const script = scanScript({ title: 'A bell.', summary: 'Cast in 1890.', highlights: ['Rung daily.'] })
    expect(script).not.toContain('..')
  })

  it('is empty when there is nothing worth hearing', () => {
    // A button that speaks a name and stops is worse than no button.
    expect(scanScript({ title: 'A statue' })).toBe('')
    expect(scanScript({})).toBe('')
  })
})
