/**
 * Travel modes for the place sheet — walking, motorcycle, car.
 *
 * ALL THREE TIMES COME FROM ONE DISTANCE, and that is a deliberate
 * limitation rather than an oversight. The free OSRM demo server this app
 * routes against serves a single profile and ignores the one it is asked
 * for — probed directly, /foot, /driving, /walking and /cycling for the same
 * pair returned byte-identical results (1102 m, 158 s, 25.1 km/h). There is
 * therefore exactly one route available, and it is a road route.
 *
 * What follows honestly from that:
 *
 *  - The distance is a ROAD distance. It is right for a car or a motorcycle
 *    and slightly long for a walker, who can cut through alleys in Maypajo
 *    that no vehicle can use.
 *  - The times are estimates from average speeds, not routed durations.
 *    OSRM's own duration is never used anywhere in this app; it reports a
 *    ~25 km/h vehicle speed no matter which profile is requested.
 *
 * Both facts are surfaced in the UI rather than hidden, because a Mass time
 * missed on the strength of a confident-looking wrong number is a real cost
 * to a real person.
 *
 * Jeepney and other public transit are deliberately absent: no free routing
 * service carries Caloocan jeepney data, and a fabricated transit time would
 * be worse than none.
 */

export type TravelModeId = 'walk' | 'motorcycle' | 'car'

export interface TravelMode {
  id: TravelModeId
  label: string
  /** Average door-to-door speed in metres per second. */
  speedMps: number
  /** Shown under the row, so the estimate is never mistaken for a routed time. */
  note: string
}

/**
 * Speeds are door-to-door averages for inner Caloocan, not free-flow speeds.
 *
 * A motorcycle filters through traffic a car sits in, which is why it is
 * quicker here than the car despite the same roads — that is the everyday
 * reality of the route, not a modelling error. The car figure is deliberately
 * low for the same reason: 18 km/h is what C-3 and A. Mabini actually move at
 * for most of the day, and quoting a 40 km/h free-flow speed would make the
 * app confidently early.
 */
export const TRAVEL_MODES: TravelMode[] = [
  {
    id: 'walk',
    label: 'Walk',
    speedMps: 5000 / 3600, // 5 km/h
    note: 'Estimated at a 5 km/h walking pace. The route follows roads, so a shortcut on foot may be shorter.',
  },
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    speedMps: 22000 / 3600, // 22 km/h door to door, filtering through traffic
    note: 'Estimated at 22 km/h — a motorcycle or tricycle filtering through traffic.',
  },
  {
    id: 'car',
    label: 'Car',
    speedMps: 18000 / 3600, // 18 km/h, inner-city Caloocan traffic
    note: 'Estimated at 18 km/h, the everyday pace of inner Caloocan traffic. Expect longer at rush hour.',
  },
]

export function travelMode(id: TravelModeId): TravelMode {
  // Non-null: the ids are a closed union and every one has an entry above.
  return TRAVEL_MODES.find(m => m.id === id)!
}

/** Minutes for one mode over a given distance. Never below one minute. */
export function minutesFor(distanceMeters: number, mode: TravelMode): number {
  return distanceMeters / mode.speedMps / 60
}

/**
 * "21 min", "1 hr 5 min" — the compact form the mode row needs.
 *
 * Rounded to whole minutes because the underlying figure is an average-speed
 * estimate; a decimal on it would imply a precision that is not there.
 */
export function formatModeDuration(minutes: number): string {
  if (minutes < 1) return '<1 min'
  const whole = Math.round(minutes)
  if (whole < 60) return `${whole} min`
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}
