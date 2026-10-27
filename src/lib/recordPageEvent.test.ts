import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * The write and the security rule have to list the same fields.
 *
 * Checked by reading both files rather than by mocking Firestore,
 * because the failure being guarded against is not a bug in the
 * writing code - the writing code was correct. It is the two drifting
 * apart.
 *
 * firestore.rules permits hasOnly(['kind','visitorId','createdAt']).
 * A fourth key does not get ignored: the whole write is refused, and
 * recordPageEvent swallows the error so that counting never interrupts
 * a pilgrim. So the only symptom is a counter that quietly stops. That
 * is exactly what happened when a `surface` field was added here - for
 * a day, every open and download in the diocese was thrown away.
 */
describe('pageEvents write matches firestore.rules', () => {
  const source = readFileSync('src/lib/recordPageEvent.ts', 'utf8')
  const rules = readFileSync('firestore.rules', 'utf8')

  /** The field list the rule allows, in the pageEvents block. */
  function allowedByRules(): string[] {
    const block = rules.slice(rules.indexOf('match /pageEvents/'))
    const match = block.match(/hasOnly\(\[([^\]]*)\]\)/)
    if (!match) throw new Error('could not find hasOnly() in the pageEvents rule')
    return match[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .sort()
  }

  /** The keys the app actually sends. */
  function writtenByApp(): string[] {
    const call = source.slice(source.indexOf('addDoc(collection(db, "pageEvents")'))
    const body = call.slice(call.indexOf('{') + 1, call.indexOf('});'))
    return body
      .split('\n')
      .map(line => line.trim())
      // `name: value` and the shorthand `name,` - `kind` is written
      // shorthand, and a parser that only knew the first form reported
      // it missing and failed for the wrong reason.
      .filter(line => /^[A-Za-z_][A-Za-z0-9_]*\s*[:,]/.test(line))
      .map(line => line.split(/[:,]/)[0].trim())
      .sort()
  }

  it('finds the rule', () => {
    expect(allowedByRules()).toEqual(['createdAt', 'kind', 'visitorId'])
  })

  it('sends exactly what the rule allows, and nothing more', () => {
    expect(writtenByApp()).toEqual(allowedByRules())
  })

  it('does not send a surface field, which the rule refuses', () => {
    // Named explicitly because this is the one that actually happened.
    expect(writtenByApp()).not.toContain('surface')
  })
})
