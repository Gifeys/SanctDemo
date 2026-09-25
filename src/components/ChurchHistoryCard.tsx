import type { CSSProperties } from "react";
import { PARISH_PATRON_IMAGES, PARISH_PATRON_SAINTS } from "../data";
import { useParishContent } from "../lib/useParishContent";
import { hasParishHistory, parishAccent, parishHistoryLede } from "./ChurchHistory";

interface ChurchHistoryCardProps {
  routeId: string;
  parishName: string;
  onOpenHistory: () => void;
}

/**
 * The navy Church History card on Home.
 *
 * Nothing here is invented for a parish that has no history: inventing one
 * would put words in a church's mouth, and a devotional history that is
 * subtly wrong is worse than an honest absence. What the card WILL show is
 * the history the app already carries — this used to look only at
 * admin-written text, so both parishes with a real compiled history were
 * told their history "has not been written up yet" while the history page
 * behind the card had two sections of it.
 */
export default function ChurchHistoryCard({
  routeId,
  parishName,
  onOpenHistory,
}: ChurchHistoryCardProps) {
  const managed = useParishContent(routeId);

  // The patron's name is the natural title, so an admin who writes only the
  // body still gets a headed card.
  //
  // The trailing gloss is dropped: the stored patron is "Maria Auxiliadora
  // (Mary Help of Christians)", and the parish name directly above already
  // says Mary Help of Christians. Kept whole it wrapped to five lines and
  // repeated the header.
  const patron = PARISH_PATRON_SAINTS[routeId]?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const title = managed?.historyTitle?.trim() || patron || parishName;
  const managedBody = managed?.historyBody?.trim();
  // The card shows the opening of whatever the history page will show, so the
  // two never disagree about whether this parish has a history.
  const body = managedBody || parishHistoryLede(routeId);
  const canLearnMore = hasParishHistory(routeId, managedBody);
  const photo = managed?.historyPhotoUrl ?? PARISH_PATRON_IMAGES[routeId];

  // The card wears the parish's own colours, not the app's navy. That is what
  // the PSD has - the Mary Help card is the blue of her mantle, and its
  // gradient is the same one the history page opens with - and it is what
  // makes the card and the page it opens read as one thing. It also stops
  // this card arriving on San Roque's page as a navy rectangle on orange.
  const accent = parishAccent(routeId);
  const style = {
    background: "linear-gradient(160deg, " + accent.top + " 0%, " + accent.bottom + " 78%)",
    "--chc-accent-bottom": accent.bottom,
  } as CSSProperties;

  return (
    <section className="relative overflow-hidden rounded-[26px] shadow-lg" style={style}>
      {photo && (
        <>
          {/* The photograph sits to the right and the text runs over the
              left, as in the design. A scrim rather than a shadow: these are
              gilded statues under warm light, so brightness under the text is
              unpredictable — a shadow holds over dark vestments and vanishes
              over gold. */}
          <img
            src={photo}
            alt=""
            aria-hidden
            className="absolute inset-y-0 right-0 h-full w-[52%] object-cover"
            style={{ objectPosition: "center 30%" }}
            loading="lazy"
          />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, var(--chc-accent-bottom) 46%, color-mix(in srgb, var(--chc-accent-bottom) 55%, transparent) 68%, transparent 100%)",
            }}
          />
        </>
      )}

      <div
        className="relative px-5 pt-5 pb-4 text-white"
        style={{ maxWidth: photo ? "62%" : "100%" }}
      >
        <h3 className="church-history-card__title">{title}</h3>

        {body ? (
          // Clamped, not truncated by hand. This is the opening of the
          // history page's first paragraph, and it is meant to run out mid
          // thought - that is what "Learn more" is answering.
          <p className="church-history-card__body">{body}</p>
        ) : (
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/75">
            This parish's history has not been written up yet. The parish office can add it
            from the admin portal.
          </p>
        )}
      </div>

      {/* Centred at the foot of the card with a short rule under it, as the
          PSD has it - not a left-aligned chevron link. It spans the whole
          card rather than the text column, because in the design it sits
          under the photograph too. */}
      {canLearnMore && (
        <button type="button" onClick={onOpenHistory} className="church-history-card__more">
          Learn more
        </button>
      )}
    </section>
  );
}
