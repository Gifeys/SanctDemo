import type { GeoParish } from './presence'

export interface Coordinates {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function nearestLiveParish(
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
