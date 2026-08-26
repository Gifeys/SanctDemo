// The liturgical day, computed rather than stored.
//
// The redesign's Home screen names the day the way a parish bulletin does —
// "Wednesday of the 21st Week in Ordinary Time" — which no data file here
// carries and which changes every day. Everything below derives from one
// fixed point, the date of Easter, so it stays correct in any year without
// anyone maintaining a table.
//
// This is the Roman Rite as celebrated in the Philippines. Two local details
// matter and are handled: Epiphany is transferred to the Sunday between 2 and
// 8 January rather than fixed to the 6th, and the Baptism of the Lord falls
// on the Sunday after that.
//
// Deliberately free of clock access — every function takes the date it should
// reason about, which is what makes a calendar spanning a whole year testable.

export type LiturgicalSeason =
  | 'Advent'
  | 'Christmas'
  | 'Ordinary Time'
  | 'Lent'
  | 'Triduum'
  | 'Easter'

/** The vesture colour of the day, for the band the redesign puts on Home. */
export type LiturgicalColour = 'violet' | 'white' | 'green' | 'red' | 'rose'

export interface LiturgicalDay {
  season: LiturgicalSeason
  /** Week within the season, 1-based. Null where the season isn't counted in weeks. */
  week: number | null
  colour: LiturgicalColour
  /** "Wednesday of the 21st Week in Ordinary Time" */
  name: string
  /** A named solemnity or feast that outranks the day, when there is one. */
  feast: string | null
}

const DAY_MS = 86_400_000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Midnight UTC for a Y/M/D, so arithmetic never trips over local DST. */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day))
}

/** Strips the time from a date, keeping its calendar day. */
function dayOf(date: Date): Date {
  return utc(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

/** The Sunday on or before `date`. Liturgical weeks run Sunday to Saturday. */
function sundayOnOrBefore(date: Date): Date {
  return addDays(date, -date.getUTCDay())
}

/**
 * Easter Sunday, by the Anonymous Gregorian ("Meeus/Jones/Butcher") algorithm.
 *
 * The whole calendar hangs off this one date: Ash Wednesday, Pentecost and
 * both stretches of Ordinary Time are all measured from it.
 */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return utc(year, month - 1, day)
}

/** The First Sunday of Advent — the fourth Sunday before Christmas Day. */
export function adventStart(year: number): Date {
  const christmas = utc(year, 11, 25)
  // The Sunday on or before Christmas is the fourth Sunday of Advent unless
  // Christmas *is* a Sunday, in which case that Sunday belongs to Christmas.
  const fourth = christmas.getUTCDay() === 0 ? addDays(christmas, -7) : sundayOnOrBefore(christmas)
  return addDays(fourth, -21)
}

/**
 * The Baptism of the Lord, which closes Christmastide.
 *
 * In the Philippines Epiphany is kept on the Sunday falling between 2 and 8
 * January, and the Baptism on the Sunday after. When Epiphany lands on 7 or 8
 * January the Baptism is moved to the following Monday so the two do not
 * collide.
 */
export function baptismOfTheLord(year: number): Date {
  const jan2 = utc(year, 0, 2)
  const offset = (7 - jan2.getUTCDay()) % 7
  const epiphany = addDays(jan2, offset) // the Sunday between 2 and 8 January
  const date = epiphany.getUTCDate()
  return date >= 7 ? addDays(epiphany, 1) : addDays(epiphany, 7)
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

/**
 * Names the liturgical day for `date`.
 *
 * Ordinary Time is the awkward part, and the reason it is worth writing out.
 * It comes in two stretches with one continuous numbering: the first runs
 * from the day after the Baptism to the day before Ash Wednesday, the second
 * from the day after Pentecost to the day before Advent. The second stretch
 * is numbered *backwards* from the end — the last week before Advent is
 * always the 34th — because the first stretch's length varies with the date
 * of Easter, so counting forwards would leave a gap or an overlap.
 */
export function liturgicalDay(date: Date): LiturgicalDay {
  const today = dayOf(date)
  const year = today.getUTCFullYear()
  const weekday = WEEKDAYS[today.getUTCDay()]

  const easter = easterSunday(year)
  const ashWednesday = addDays(easter, -46)
  const holyThursday = addDays(easter, -3)
  const pentecost = addDays(easter, 49)
  const baptism = baptismOfTheLord(year)
  const advent = adventStart(year)
  const christmasDay = utc(year, 11, 25)

  const named = (season: LiturgicalSeason, week: number | null, colour: LiturgicalColour, name: string, feast: string | null = null): LiturgicalDay =>
    ({ season, week, colour, name, feast })

  // Fixed points that outrank whatever season they land in.
  if (today.getTime() === easter.getTime()) return named('Easter', 1, 'white', 'Easter Sunday', 'Easter Sunday')
  if (today.getTime() === pentecost.getTime()) return named('Easter', 8, 'red', 'Pentecost Sunday', 'Pentecost Sunday')
  if (today.getTime() === christmasDay.getTime()) return named('Christmas', null, 'white', 'The Nativity of the Lord', 'Christmas Day')
  if (today.getTime() === ashWednesday.getTime()) return named('Lent', 1, 'violet', 'Ash Wednesday', 'Ash Wednesday')

  // Advent through to the end of the civil year.
  if (today >= advent && today < christmasDay) {
    const week = Math.floor(daysBetween(advent, sundayOnOrBefore(today)) / 7) + 1
    return named('Advent', week, week === 3 ? 'rose' : 'violet', `${weekday} of the ${ordinal(week)} Week of Advent`)
  }

  // Christmastide spans the new year, so it is two ranges, not one.
  if (today >= christmasDay || today <= baptism) {
    return named('Christmas', null, 'white', `${weekday} of the Christmas Season`)
  }

  if (today >= holyThursday && today < easter) {
    return named('Triduum', null, 'white', `${weekday} of the Sacred Triduum`)
  }

  if (today > ashWednesday && today < holyThursday) {
    // Lent's weeks are counted from the First Sunday of Lent, which is the
    // Sunday after Ash Wednesday — the days between belong to "after Ashes".
    const firstSunday = addDays(easter, -42)
    if (today < firstSunday) return named('Lent', null, 'violet', `${weekday} after Ash Wednesday`)
    const week = Math.floor(daysBetween(firstSunday, sundayOnOrBefore(today)) / 7) + 1
    return named('Lent', week, week === 4 ? 'rose' : 'violet', `${weekday} of the ${ordinal(week)} Week of Lent`)
  }

  if (today > easter && today < pentecost) {
    const week = Math.floor(daysBetween(easter, sundayOnOrBefore(today)) / 7) + 1
    return named('Easter', week, 'white', `${weekday} of the ${ordinal(week)} Week of Easter`)
  }

  // Everything left is Ordinary Time.
  const sunday = sundayOnOrBefore(today)
  let week: number
  if (today > baptism && today < ashWednesday) {
    // Counted forwards: the week containing the Baptism is the first.
    week = Math.floor(daysBetween(sundayOnOrBefore(baptism), sunday) / 7) + 1
  } else {
    // Counted backwards from Christ the King, always the 34th and always the
    // Sunday before Advent.
    const christTheKing = addDays(advent, -7)
    week = 34 - Math.floor(daysBetween(sunday, christTheKing) / 7)
  }
  return named('Ordinary Time', week, 'green', `${weekday} of the ${ordinal(week)} Week in Ordinary Time`)
}
