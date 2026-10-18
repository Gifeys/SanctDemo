import { describe, expect, it, vi } from 'vitest'
import { askSancti } from './askSancti'

const ok = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body } as unknown as Response)

describe('askSancti', () => {
  it('returns the grounded answer and its sources', async () => {
    const fetchImpl = ok({
      answer: 'Sunday Mass is at 7:00 AM.',
      grounded: true,
      sources: [{ topic: 'mass', source: 'parish', updatedAt: '2026-10-17T00:00:00.000Z' }],
      gaps: [],
    })

    const reply = await askSancti({ question: 'what time is mass?' }, fetchImpl as never)
    expect(reply?.answer).toBe('Sunday Mass is at 7:00 AM.')
    expect(reply?.grounded).toBe(true)
    expect(reply?.sources[0].source).toBe('parish')
  })

  it('returns null when the backend is not there', async () => {
    // The whole fallback contract. This is the normal case today: the
    // Express server is not deployed, and the on-device assistant must
    // answer instead of an error reaching the pilgrim.
    const fetchImpl = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    expect(await askSancti({ question: 'hello' }, fetchImpl as never)).toBeNull()
  })

  it('returns null on a 503 rather than surfacing it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response)
    expect(await askSancti({ question: 'hello' }, fetchImpl as never)).toBeNull()
  })

  it('treats an empty answer as a failure, not as a reply', async () => {
    // A blank bubble is worse than the on-device shrug it replaced.
    const fetchImpl = ok({ answer: '   ', grounded: true, sources: [], gaps: [] })
    expect(await askSancti({ question: 'hello' }, fetchImpl as never)).toBeNull()
  })

  it('survives a malformed body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)
    expect(await askSancti({ question: 'hello' }, fetchImpl as never)).toBeNull()
  })

  it('defaults missing sources and gaps rather than crashing on them', async () => {
    const fetchImpl = ok({ answer: 'Hello.' })
    const reply = await askSancti({ question: 'hi' }, fetchImpl as never)
    expect(reply?.sources).toEqual([])
    expect(reply?.gaps).toEqual([])
    expect(reply?.grounded).toBe(false)
  })

  it('sends the parish and the recent turns, so the answer can be grounded', async () => {
    const fetchImpl = ok({ answer: 'Yes.' })
    await askSancti(
      {
        question: 'what about tomorrow?',
        parishId: 'route-src',
        parishName: 'San Roque Cathedral Parish',
        history: [{ role: 'you', text: 'what time is mass?' }],
      },
      fetchImpl as never,
    )

    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    expect(body.parishId).toBe('route-src')
    expect(body.history).toHaveLength(1)
  })
})
