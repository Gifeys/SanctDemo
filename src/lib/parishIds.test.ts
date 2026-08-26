import { describe, expect, it } from 'vitest'
import parishData from '../data/diocese-parishes.json'
import {
  PARISH_TO_ROUTE,
  ROUTE_TO_PARISH,
  assertKnownParishIds,
  parishIdForRoute,
  routeIdForParish,
} from './parishIds'

const PARISHES = (parishData as { parishes: { id: string; status?: string }[] }).parishes

describe('parishIds', () => {
  // The defect this module exists to prevent: the mapping was written inline
  // in four components with the "parish-" prefix missing, so every lookup
  // missed and the two documented parishes rendered as though nothing had
  // been collected about them.
  it('uses ids that actually exist in the parish data', () => {
    const known = new Set(PARISHES.map(p => p.id))
    for (const parishId of Object.keys(PARISH_TO_ROUTE)) {
      expect(known.has(parishId), `${parishId} is not in diocese-parishes.json`).toBe(true)
    }
  })

  it('maps every live parish to a tour', () => {
    const live = PARISHES.filter(p => p.status === 'live')
    expect(live.length).toBeGreaterThan(0)
    for (const parish of live) {
      expect(routeIdForParish(parish.id), `${parish.id} has no tour`).not.toBeNull()
    }
  })

  it('resolves both directions', () => {
    expect(routeIdForParish('parish-san-roque-cathedral')).toBe('route-src')
    expect(parishIdForRoute('route-src')).toBe('parish-san-roque-cathedral')
    expect(routeIdForParish('parish-mary-help-of-christians-parish')).toBe('route-mhcp')
    expect(parishIdForRoute('route-mhcp')).toBe('parish-mary-help-of-christians-parish')
  })

  it('is a faithful inverse', () => {
    for (const [parishId, routeId] of Object.entries(PARISH_TO_ROUTE)) {
      expect(ROUTE_TO_PARISH[routeId]).toBe(parishId)
    }
  })

  // The 29 without a tour are a normal, expected state — not an error.
  it('returns null for a parish with no tour', () => {
    expect(routeIdForParish('parish-birhen-ng-lourdes-parish')).toBeNull()
    expect(routeIdForParish(null)).toBeNull()
    expect(routeIdForParish(undefined)).toBeNull()
    expect(parishIdForRoute('route-nonexistent')).toBeNull()
  })

  it('passes its own startup assertion', () => {
    expect(() => assertKnownParishIds()).not.toThrow()
  })
})
