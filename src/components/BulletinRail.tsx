import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Users, Sparkles } from "lucide-react";
import { MINISTRIES, SACRAMENTS } from "../data";
import { formatWhen, upcomingAnnouncements, type AnnouncementDoc } from "../lib/announcements";

/**
 * The parish's own photographs, from the design the parish supplied: the
 * altar servers in the sanctuary, and a christening.
 */
const MINISTRY_PHOTO = "/parish/ministry-altar-servers.jpg";
const SACRAMENT_PHOTO = "/parish/sacraments-christening.jpg";

export type Announcement = AnnouncementDoc;

interface BulletinRailProps {
  announcements: AnnouncementDoc[];
  onNavigate: (tab: "ministries" | "sacraments" | "mass") => void;
}

/**
 * The Parish Bulletin, below the Verse of the Day.
 *
 * ## Why nothing here slides any more
 *
 * It was one horizontal rail carrying the verse, the announcements and the
 * two section cards together, and that was wrong in two different ways at
 * once. The announcements are a stack of the same kind of thing, so moving
 * between them should be a change of content, not a change of place - they
 * CROSSFADE. The two section cards are a fixed pair that fit side by side
 * on a phone, so swiping to reach the second one hid a card that was never
 * off screen to begin with - they are simply BOTH THERE.
 *
 * A rail is for a list whose length you do not know. Neither of these is
 * that, and treating them as one made the only genuinely variable thing on
 * the screen - the verse - swipeable too.
 */
export default function BulletinRail({ announcements, onNavigate }: BulletinRailProps) {
  const now = new Date();
  const upcoming = upcomingAnnouncements(announcements, now);

  return (
    <section className="bulletin">
      <AnnouncementDeck items={upcoming} now={now} />

      {/* Ministries and Sacraments used to be two photo cards here.
          They are buttons at the top of Home now, directly under the
          parish's name, where the four most-asked questions belong -
          and keeping them here as well would have put each of them on
          the screen twice. See HomeQuickLinks. */}
    </section>
  );
}

/**
 * The announcements, one at a time, crossfading.
 *
 * Every slide is rendered into the SAME grid cell rather than laid out in
 * a row, which is what makes the fade possible and also what keeps the
 * deck's height fixed: the cell is as tall as the tallest announcement, so
 * moving between a short notice and a long one does not make the page
 * below it jump.
 *
 * The inactive slides are inert, not merely transparent - `visibility`
 * and `aria-hidden` together, or a screen reader reads all four at once
 * and a tab lands on a card nobody can see.
 */
function AnnouncementDeck({
  items,
  now,
}: {
  items: Array<AnnouncementDoc & { when: Date | null }>;
  now: Date;
}) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  // A parish retiring the announcement you were looking at must not leave
  // the deck pointing past the end of the list.
  useEffect(() => {
    setIndex(i => (i > items.length - 1 ? Math.max(0, items.length - 1) : i));
  }, [items.length]);

  if (items.length === 0) {
    return (
      <p className="bulletin-note">
        Nothing from the parish office this week. Announcements, feast days and
        schedule changes appear here first.
      </p>
    );
  }

  const count = items.length;
  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <div className="bulletin-deck-frame">
      <div
        className="bulletin-deck"
        onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={e => {
          const from = touchX.current;
          touchX.current = null;
          if (from === null || count < 2) return;
          const dx = (e.changedTouches[0]?.clientX ?? from) - from;
          // Generous enough that a slightly diagonal vertical scroll does
          // not count as a swipe.
          if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {items.map((item, i) => (
          <article
            key={item.id}
            className={
              "bulletin-card"
              + (item.imageUrl ? "" : " bulletin-card--text")
              + (i === index ? " is-current" : "")
            }
            aria-hidden={i === index ? undefined : true}
            // The deck is one region that changes; without this a reader
            // announces the whole stack on every move.
            aria-roledescription="announcement"
          >
            {item.imageUrl && (
              <span className="bulletin-card__photo">
                <img src={item.imageUrl} alt="" loading="lazy" />
              </span>
            )}
            <span className="bulletin-card__body">
              <span className="bulletin-card__chip">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden />
                {item.type}
              </span>
              <h3 className="bulletin-card__title">{item.title}</h3>
              <p className="bulletin-card__when">
                {item.when ? formatWhen(item.when, now) : "From the parish office"}
                {item.time ? ` · ${item.time}` : ""}
              </p>
              {item.body && <p className="bulletin-card__body-text">{item.body}</p>}
            </span>
          </article>
        ))}
      </div>

      {count > 1 && (
        <div className="bulletin-deck__nav">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous announcement"
            className="bulletin-deck__arrow"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="bulletin-deck__dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Announcement ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                className={`bulletin-deck__dot${i === index ? " is-current" : ""}`}
              />
            ))}
          </span>

          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next announcement"
            className="bulletin-deck__arrow"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One of the two section cards. The description lives INSIDE the card
 * rather than in a panel underneath: on a phone that panel sits below the
 * fold, so the thing the tap revealed is the one thing you cannot see.
 */
function SectionCard({
  icon, label, hint, caption, imageUrl, onClick, spotlight,
}: {
  /** Name the tutorial and Sancti can point at. */
  spotlight?: string;
  icon: ReactNode;
  label: string;
  hint: string;
  /** Named over the photograph — an example of what is inside. */
  caption?: string;
  imageUrl?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-spotlight={spotlight}
      className="bulletin-section"
    >
      {imageUrl && (
        <span className="bulletin-section__photo">
          <img src={imageUrl} alt="" loading="lazy" />
          {caption && (
            <>
              {/* A scrim, not a shadow: what sits behind the caption is a
                  photograph whose brightness cannot be assumed. */}
              <span className="bulletin-section__scrim" aria-hidden />
              <span className="bulletin-section__caption">{caption}</span>
            </>
          )}
        </span>
      )}
      <span className="bulletin-section__body">
        <span className="bulletin-section__label">
          <span className="bulletin-section__icon">{icon}</span>
          {/* No chevron. At half a phone's width "Sacraments" plus its
              icon already fills the row, and a chevron pushed to the end
              was simply clipped - the card is a button, which is what
              says it opens. */}
          {label}
        </span>
        <span className="bulletin-section__hint">{hint}</span>
      </span>
    </button>
  );
}
