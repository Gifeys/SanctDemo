const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface MassScheduleEntry {
  day: string
  time: string
}

export interface NextMass {
  day: string
  time: string
  date: Date
}

export function parseTimes(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function toMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return NaN

  let hours = Number(match[1]) % 12
  const minutes = Number(match[2])
  if (match[3].toUpperCase() === 'PM') hours += 12

  return hours * 60 + minutes
}

export function nextMass(schedule: MassScheduleEntry[], now: Date): NextMass | null {
  if (schedule.length === 0) return null

  const byDay = new Map(schedule.map((s) => [s.day, parseTimes(s.time)]))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  for (let offset = 0; offset < 8; offset++) {
    const dayName = DAYS[(now.getDay() + offset) % 7]
    const times = byDay.get(dayName)
    if (!times) continue

    // Sort by clock time rather than trusting the data's order — parish data
    // is hand-entered, and "4:30 PM, 6:00 AM" would otherwise report the
    // afternoon Mass as the next one.
    const ordered = times
      .filter((t) => !Number.isNaN(toMinutes(t)))
      .sort((a, b) => toMinutes(a) - toMinutes(b))

    for (const time of ordered) {
      const minutes = toMinutes(time)
      if (offset === 0 && minutes <= nowMinutes) continue

      const date = new Date(now)
      date.setDate(date.getDate() + offset)
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)

      return { day: dayName, time, date }
    }
  }

  return null
}
