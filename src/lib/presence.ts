import { haversineMeters, type Coordinates } from './geo'

export type PresenceMode = 'diocese' | 'approaching' | 'present'

export interface GeoParish {
  id: string
  coordinates: Coordinates
  geofenceRadius: number
  status: 'live' | 'coming_soon'
}

export interface PresenceState {
  mode: PresenceMode
  parishId: string | null
  distance: number | null
  changedAt: number
}

export const APPROACH_ENTER_M = 500
export const APPROACH_LEAVE_M = 600
export const PRESENT_LEAVE_FACTOR = 1.5
export const MIN_DWELL_MS = 10000

// A changedAt of exactly 0 means "never transitioned, or a caller is forcing
// an immediate transition" — it always clears the dwell gate. The demo
// location simulator passes { ...prev, changedAt: FORCE_TRANSITION_AT } so a
// switch responds instantly. This is public contract, not an accident of
// clock magnitude.
export const FORCE_TRANSITION_AT = 0

export const INITIAL_PRESENCE: PresenceState = {
  mode: 'diocese',
  parishId: null,
  distance: null,
  changedAt: FORCE_TRANSITION_AT,
}

function nearestLiveParish(
  pos: Coordinates | null,
  parishes: GeoParish[],
): { parish: GeoParish; distance: number } | null {
  if (!pos) return null

  let best: { parish: GeoParish; distance: number } | null = null
  for (const parish of parishes) {
    if (parish.status !== 'live') continue
    const distance = haversineMeters(pos, parish.coordinates)
    if (!best || distance < best.distance) {
      best = { parish, distance }
    }
  }
  return best
}

// Works out which mode the raw position implies, taking the previous mode
// into account so the boundaries are sticky rather than knife-edge.
function rawMode(
  prev: PresenceState,
  nearest: { parish: GeoParish; distance: number } | null,
): { mode: PresenceMode; parishId: string | null } {
  if (!nearest) return { mode: 'diocese', parishId: null }

  const { parish, distance } = nearest
  const wasPresentHere = prev.mode === 'present' && prev.parishId === parish.id
  const wasApproachingHere = prev.mode === 'approaching' && prev.parishId === parish.id

  const presentLeave = parish.geofenceRadius * PRESENT_LEAVE_FACTOR

  if (wasPresentHere ? distance <= presentLeave : distance <= parish.geofenceRadius) {
    return { mode: 'present', parishId: parish.id }
  }

  const approachLeave =
    wasApproachingHere || wasPresentHere ? APPROACH_LEAVE_M : APPROACH_ENTER_M

  if (distance <= approachLeave) {
    return { mode: 'approaching', parishId: parish.id }
  }

  return { mode: 'diocese', parishId: null }
}

export function nextPresence(
  prev: PresenceState,
  pos: Coordinates | null,
  now: number,
  parishes: GeoParish[],
): PresenceState {
  const nearest = nearestLiveParish(pos, parishes)
  const distance = nearest ? nearest.distance : null
  const candidate = rawMode(prev, nearest)

  const unchanged = candidate.mode === prev.mode && candidate.parishId === prev.parishId

  // Distance always tracks reality, even when a mode change is suppressed.
  if (unchanged) {
    return { ...prev, distance }
  }

  const dwellElapsed =
    prev.changedAt === FORCE_TRANSITION_AT || now - prev.changedAt >= MIN_DWELL_MS
  if (!dwellElapsed) {
    return { ...prev, distance }
  }

  return {
    mode: candidate.mode,
    parishId: candidate.parishId,
    distance,
    // Never record 0 as a real transition time — that would leave the force
    // sentinel armed and let the very next tick skip the debounce.
    changedAt: now === FORCE_TRANSITION_AT ? 1 : now,
  }
}
