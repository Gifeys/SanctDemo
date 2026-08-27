// Verse of the Day, chosen to suit the liturgical season.
//
// Replaces a single hardcoded verse (2 Peter 1:4) that never changed — which
// stopped reading as "of the day" the moment anyone opened the app twice.
//
// Local, not fetched. A daily-verse API would be one more thing to fail
// during a defense, in a church basement, on a phone with no signal; the app
// is offline-first everywhere else and this is no different.
//
// Same verse for everyone, same verse all day: the index comes from the
// calendar date, not from Math.random(). Two pilgrims standing beside each
// other must see the same verse, and it must not change while someone is
// reading it.

import { liturgicalDay, type LiturgicalSeason } from './liturgical'

export interface Verse {
  text: string
  reference: string
}

/**
 * Verses per season. Deliberately short — a verse that needs scrolling is not
 * a verse anyone reads on a bus.
 *
 * Scripture quoted from the New American Bible, Revised Edition, the
 * translation approved for liturgical use in the Philippines.
 */
const VERSES: Record<LiturgicalSeason, Verse[]> = {
  Advent: [
    { text: 'Prepare the way of the Lord, make straight his paths.', reference: 'Mark 1:3' },
    { text: 'The virgin shall conceive, and bear a son, and shall name him Emmanuel.', reference: 'Isaiah 7:14' },
    { text: 'Behold, I am the handmaid of the Lord. May it be done to me according to your word.', reference: 'Luke 1:38' },
    { text: 'Be patient, therefore, brothers, until the coming of the Lord.', reference: 'James 5:7' },
    { text: 'The people who walked in darkness have seen a great light.', reference: 'Isaiah 9:1' },
  ],
  Christmas: [
    { text: 'For today in the city of David a savior has been born for you who is Messiah and Lord.', reference: 'Luke 2:11' },
    { text: 'And the Word became flesh and made his dwelling among us.', reference: 'John 1:14' },
    { text: 'Glory to God in the highest and on earth peace to those on whom his favor rests.', reference: 'Luke 2:14' },
    { text: 'Mary kept all these things, reflecting on them in her heart.', reference: 'Luke 2:19' },
  ],
  'Ordinary Time': [
    { text: 'Your word is a lamp for my feet, a light for my path.', reference: 'Psalm 119:105' },
    { text: 'Come to me, all you who labor and are burdened, and I will give you rest.', reference: 'Matthew 11:28' },
    { text: 'Whatever you do, do everything for the glory of God.', reference: '1 Corinthians 10:31' },
    { text: 'Love is patient, love is kind. It is not jealous, it is not pompous.', reference: '1 Corinthians 13:4' },
    { text: 'The Lord is my shepherd; there is nothing I lack.', reference: 'Psalm 23:1' },
    { text: 'Be strong and steadfast; do not fear nor be dismayed, for the Lord is with you.', reference: 'Joshua 1:9' },
    { text: 'Do to others whatever you would have them do to you.', reference: 'Matthew 7:12' },
    { text: 'Cast all your worries upon him because he cares for you.', reference: '1 Peter 5:7' },
    { text: 'Blessed are the peacemakers, for they will be called children of God.', reference: 'Matthew 5:9' },
    { text: 'Faith is the realization of what is hoped for and evidence of things not seen.', reference: 'Hebrews 11:1' },
    { text: 'This is the day the Lord has made; let us rejoice in it and be glad.', reference: 'Psalm 118:24' },
    { text: 'He has given us his very great and precious promises.', reference: '2 Peter 1:4' },
  ],
  Lent: [
    { text: 'Return to me with your whole heart, with fasting, and weeping, and mourning.', reference: 'Joel 2:12' },
    { text: 'A clean heart create for me, God; renew within me a steadfast spirit.', reference: 'Psalm 51:12' },
    { text: 'Whoever wishes to come after me must deny himself, take up his cross, and follow me.', reference: 'Matthew 16:24' },
    { text: 'For where your treasure is, there also will your heart be.', reference: 'Matthew 6:21' },
    { text: 'The Lord is gracious and merciful, slow to anger and abounding in mercy.', reference: 'Psalm 145:8' },
  ],
  Triduum: [
    { text: 'Greater love has no one than this, to lay down one’s life for one’s friends.', reference: 'John 15:13' },
    { text: 'Father, into your hands I commend my spirit.', reference: 'Luke 23:46' },
    { text: 'By his stripes we were healed.', reference: 'Isaiah 53:5' },
  ],
  Easter: [
    { text: 'He is not here, for he has been raised just as he said.', reference: 'Matthew 28:6' },
    { text: 'I am the resurrection and the life; whoever believes in me, even if he dies, will live.', reference: 'John 11:25' },
    { text: 'Peace be with you. As the Father has sent me, so I send you.', reference: 'John 20:21' },
    { text: 'Blessed are those who have not seen and have believed.', reference: 'John 20:29' },
    { text: 'Death is swallowed up in victory.', reference: '1 Corinthians 15:54' },
  ],
}

/** Days since the epoch — a stable, timezone-local day number. */
function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  )
}

/**
 * The verse for a given day.
 *
 * Indexed by the day number so it advances once per calendar day and is
 * identical on every device — and so it cannot change between two renders of
 * the same screen, which a random pick would.
 */
export function verseForDate(date: Date): Verse & { season: LiturgicalSeason } {
  const season = liturgicalDay(date).season
  const pool = VERSES[season]
  const verse = pool[((dayNumber(date) % pool.length) + pool.length) % pool.length]
  return { ...verse, season }
}
