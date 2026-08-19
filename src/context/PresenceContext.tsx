import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { INITIAL_PRESENCE, nextPresence, FORCE_TRANSITION_AT, type GeoParish, type PresenceState } from '../lib/presence'
import type { Coordinates } from '../lib/geo'
import { ROUTES } from '../data'
import type { Route } from '../types'

export type SimulationValue = 'off' | 'approaching_mhcp' | 'at_mhcp' | 'at_src'
export type GpsStatus = 'idle' | 'granted' | 'denied' | 'unavailable'

export const SIMULATIONS: { value: SimulationValue; label: string }[] = [
  { value: 'off', label: 'Off — use real GPS' },
  { value: 'approaching_mhcp', label: 'Approaching Mary Help of Christians' },
  { value: 'at_mhcp', label: 'At Mary Help of Christians' },
  { value: 'at_src', label: 'At San Roque Cathedral' },
]

interface PresenceContextValue {
  presence: PresenceState
  parish: Route | null
  position: Coordinates | null
  gpsStatus: GpsStatus
  simulation: SimulationValue
  setSimulation: (value: SimulationValue) => void
}

const PresenceCtx = createContext<PresenceContextValue | null>(null)

// Route's geography fields are optional because CompanionTab builds
// AI-generated custom routes with no location. GeoParish requires them, so
// this conversion is the only place a parish can silently lose its
// coordinates — it must be strict. A route missing coordinates is skipped,
// never defaulted to {lat: 0, lng: 0}, which sits in the Atlantic Ocean and
// would quietly make the parish unreachable rather than obviously absent.
function toGeoParish(route: Route): GeoParish | null {
  if (!route.coordinates || route.geofenceRadius == null || !route.status) return null
  return {
    id: route.id,
    coordinates: route.coordinates,
    geofenceRadius: route.geofenceRadius,
    status: route.status,
  }
}

function buildParishes(routes: Route[]): GeoParish[] {
  const parishes: GeoParish[] = []
  for (const route of routes) {
    const parish = toGeoParish(route)
    if (!parish) {
      console.warn(`PresenceContext: skipping route "${route.id}" — missing coordinates/geofenceRadius/status`)
      continue
    }
    parishes.push(parish)
  }
  return parishes
}

// The simulator bypasses the dwell debounce so a demo responds instantly.
function simulatedPosition(simulation: SimulationValue, parishes: GeoParish[]): Coordinates | null {
  if (simulation === 'off') return null

  const mhcp = parishes.find(p => p.id === 'route-mhcp')
  const src = parishes.find(p => p.id === 'route-src')

  if (simulation === 'approaching_mhcp') {
    if (!mhcp) return null
    return { lat: mhcp.coordinates.lat + 0.0027, lng: mhcp.coordinates.lng }
  }
  if (simulation === 'at_mhcp') return mhcp ? mhcp.coordinates : null
  if (simulation === 'at_src') return src ? src.coordinates : null
  return null
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const parishes = useMemo(() => buildParishes(ROUTES), [])

  const [presence, setPresence] = useState<PresenceState>(INITIAL_PRESENCE)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle')
  const [simulation, setSimulation] = useState<SimulationValue>('off')
  const [position, setPosition] = useState<Coordinates | null>(null)
  const presenceRef = useRef<PresenceState>(INITIAL_PRESENCE)

  function applyPosition(pos: Coordinates | null, options: { instant?: boolean } = {}) {
    const { instant = false } = options
    // FORCE_TRANSITION_AT is presence.ts's documented "skip the dwell gate"
    // sentinel — a simulator switch must respond instantly, not in 10s.
    const prev: PresenceState = instant
      ? { ...presenceRef.current, changedAt: FORCE_TRANSITION_AT }
      : presenceRef.current
    const next = nextPresence(prev, pos, Date.now(), parishes)
    presenceRef.current = next
    setPresence(next)
    setPosition(pos ? { lat: pos.lat, lng: pos.lng } : null)
  }

  // Simulated location wins over real GPS whenever it is switched on.
  // Switching it off means "we no longer know where the user is" until a
  // real position arrives, so it applies a null position instantly instead
  // of leaving the last simulated presence frozen forever.
  useEffect(() => {
    if (simulation === 'off') {
      applyPosition(null, { instant: true })
      return
    }
    applyPosition(simulatedPosition(simulation, parishes), { instant: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation])

  // Real GPS, only while the simulator is off.
  useEffect(() => {
    if (simulation !== 'off') return
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable')
      applyPosition(null, { instant: true })
      return
    }

    const id = navigator.geolocation.watchPosition(
      p => {
        setGpsStatus('granted')
        applyPosition({ lat: p.coords.latitude, lng: p.coords.longitude })
      },
      () => {
        // Denied permission is the normal state in a defense room. Without
        // applying a null position here, the app would keep asserting the
        // pilgrim is standing at whatever parish was last resolved.
        setGpsStatus('denied')
        applyPosition(null, { instant: true })
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation])

  const parish = useMemo(
    () => (presence.parishId ? ROUTES.find(route => route.id === presence.parishId) ?? null : null),
    [presence.parishId],
  )

  const value = useMemo<PresenceContextValue>(
    () => ({
      presence,
      parish,
      position,
      gpsStatus: simulation === 'off' ? gpsStatus : 'granted',
      simulation,
      setSimulation,
    }),
    [presence, parish, position, gpsStatus, simulation],
  )

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>
}

export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceCtx)
  if (!ctx) throw new Error('usePresence must be used inside a PresenceProvider')
  return ctx
}
