// The liturgical colour, turned into something a card can actually be painted
// with.
//
// liturgical.ts already decides the colour of the day — the vesture colour the
// priest wears: green through Ordinary Time, violet in Advent and Lent, white
// at Christmas and Easter, red at Pentecost, rose on Gaudete and Laetare.
// That is the authority for this; nothing here re-derives the calendar.
//
// Each colour becomes three values rather than one, because one hex cannot do
// the job: a wash light enough to read body text on, a border a shade firmer,
// and an ink dark enough to clear WCAG AA on that wash. Painting the card in
// the vesture colour itself would put white text on Christmas and near-black
// on rose, which is how a seasonal accent turns into an unreadable card.
//
// One deliberate substitution: WHITE becomes GOLD. White vestments are worn
// with gold, and the app's own card is already warm off-white (#FAF8F4), so a
// white wash on a white card is no wash at all. Gold is what a missal or a
// set of white-and-gold vestments actually looks like, and it is visible.
//
// Pure and dependency-free, like contrast.ts, so the pairings can be tested
// rather than eyeballed.

import type { LiturgicalColour } from './liturgical'

export interface SeasonAccent {
  /** A light wash for the card's background. */
  tint: string
  /** A firmer shade of the same hue for its border. */
  border: string
  /** Text dark enough to clear WCAG AA on `tint`. */
  ink: string
}

const ACCENTS: Record<LiturgicalColour, SeasonAccent> = {
  green: { tint: '#EAF2EC', border: '#BFD6C8', ink: '#1F5A3A' },
  violet: { tint: '#EFEBF6', border: '#D0C5E5', ink: '#4B2A80' },
  white: { tint: '#F6F0E2', border: '#E0D2AE', ink: '#6E5010' },
  red: { tint: '#F7EAEA', border: '#E5C4C4', ink: '#8B1A20' },
  rose: { tint: '#F9ECF1', border: '#EBCBD9', ink: '#9A2C56' },
}

/** The wash, border and ink for a liturgical colour. */
export function seasonAccent(colour: LiturgicalColour): SeasonAccent {
  return ACCENTS[colour]
}

/** Every colour the calendar can return, for tests and for iteration. */
export const ACCENTED_COLOURS = Object.keys(ACCENTS) as LiturgicalColour[]
