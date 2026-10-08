import { liturgicalDay } from "../lib/liturgical";
import { verseForDate } from "../lib/verses";
import { seasonAccent } from "../lib/liturgicalColours";

/**
 * Verse of the Day, in the colour of the season.
 *
 * ## Why a tinted card and not a photograph
 *
 * It was set over the parish's own interiors for a while. The client's
 * verdict was plain - the backdrop was ugly - and they are right about
 * what it cost: a photograph behind text needs a scrim, the scrim dulls
 * the photograph, and the liturgical colour that is the whole point of
 * the card gets reduced to a 3px rule along the top edge. Flat, the
 * season IS the card: green through Ordinary Time, violet in Advent and
 * Lent, gold at Christmas and Easter, red at Pentecost.
 *
 * The three values come from liturgicalColours.ts, which picks an ink
 * dark enough to clear WCAG AA on its own wash - so this stays readable
 * in every season without a per-season override here.
 */
export default function VerseCard({ className = "" }: { className?: string }) {
  const now = new Date();
  const today = liturgicalDay(now);
  const verse = verseForDate(now);
  const accent = seasonAccent(today.colour);

  return (
    <article
      className={`verse-card ${className}`}
      style={{
        ["--verse-tint" as string]: accent.tint,
        ["--verse-border" as string]: accent.border,
        ["--verse-ink" as string]: accent.ink,
      }}
    >
      <div className="verse-card__body">
        <h4 className="verse-card__eyebrow">Verse of the Day</h4>

        <blockquote className="verse-card__text">
          &ldquo;{verse.text}&rdquo;
        </blockquote>

        <div className="verse-card__foot">
          <cite className="verse-card__ref">{verse.reference}</cite>
          {/* "Ordinary Time" and the other seasons stay on the card. It is
              the one word saying which season's prayers these are, and the
              brief is explicit that it must not disappear. */}
          <span className="verse-card__season">{verse.season}</span>
        </div>
      </div>
    </article>
  );
}
