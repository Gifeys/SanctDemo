// Which set of Mysteries is prayed on which day.
//
// Diocese-wide, not tied to any parish, and shared by the Home dashboard and
// the Pray screen — it lived only in Dashboard.tsx before, and a second copy
// on Pray would have been a second thing to keep in step.

export type MysterySet = "Joyful" | "Sorrowful" | "Glorious" | "Luminous"

/** The standard weekday cycle. Sunday and Wednesday both carry the Glorious. */
export const MYSTERY_BY_WEEKDAY: Record<number, MysterySet> = {
  0: "Glorious", // Sunday
  1: "Joyful", // Monday
  2: "Sorrowful", // Tuesday
  3: "Glorious", // Wednesday
  4: "Luminous", // Thursday
  5: "Sorrowful", // Friday
  6: "Joyful", // Saturday
}

export function mysteryForDate(date: Date): MysterySet {
  return MYSTERY_BY_WEEKDAY[date.getDay()]
}

/**
 * "Prayed on Wednesdays and Sundays" — the days a given set comes round,
 * written out for the Pray screen rather than hardcoded per set, so it stays
 * true if the cycle above is ever adjusted.
 */
export function daysForMystery(set: MysterySet): string {
  const names = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"]
  const days = Object.entries(MYSTERY_BY_WEEKDAY)
    .filter(([, value]) => value === set)
    .map(([day]) => names[Number(day)])
    .sort()

  if (days.length === 0) return ""
  if (days.length === 1) return `Prayed on ${days[0]}`
  return `Prayed on ${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`
}
