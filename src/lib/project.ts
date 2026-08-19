import type { Coordinates } from './geo'

export interface MapBounds {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}

export interface MapPoint {
  x: number
  y: number
}

// The diocese's territory: southern Caloocan, Malabon and Navotas.
export const DIOCESE_BOUNDS: MapBounds = {
  latMin: 14.610,
  latMax: 14.700,
  lngMin: 120.925,
  lngMax: 121.000,
}

// Linear equirectangular projection. Over a ~10km box the distortion is far
// below the width of a map pin, so the extra maths of a real projection buys
// nothing here.
export function projectToMap(
  coords: Coordinates | null | undefined,
  bounds: MapBounds,
  width: number,
  height: number
): MapPoint | null {
  if (!coords) return null

  const { lat, lng } = coords
  if (lat < bounds.latMin || lat > bounds.latMax) return null
  if (lng < bounds.lngMin || lng > bounds.lngMax) return null

  const x = ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * width
  // SVG y grows downward, so higher latitude means smaller y.
  const y = ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * height

  return { x, y }
}
