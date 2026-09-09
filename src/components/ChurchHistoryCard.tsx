import { ChevronRight } from "lucide-react";
import { PARISH_PATRON_IMAGES, PARISH_PATRON_SAINTS } from "../data";
import { useParishContent } from "../lib/useParishContent";

interface ChurchHistoryCardProps {
  routeId: string;
  parishName: string;
  onOpenHistory: () => void;
}

/**
 * The navy Church History card on Home.
 *
 * Entirely parish-supplied. There is no compiled fallback text on purpose:
 * inventing a history for a parish nobody has written one for would put words
 * in a church's mouth, and a devotional history that is subtly wrong is worse
 * than an honest absence. With no text the card explains that it is waiting
 * for the parish rather than showing an empty panel.
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
  const body = managed?.historyBody?.trim();
  const photo = managed?.historyPhotoUrl ?? PARISH_PATRON_IMAGES[routeId];

  return (
    <section
      className="relative overflow-hidden rounded-[26px] shadow-lg"
      style={{ background: "var(--color-brand-primary)" }}
    >
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
                "linear-gradient(90deg, var(--color-brand-primary) 46%, color-mix(in srgb, var(--color-brand-primary) 55%, transparent) 68%, transparent 100%)",
            }}
          />
        </>
      )}

      <div className="relative p-5 text-white" style={{ maxWidth: photo ? "62%" : "100%" }}>
        <h3 className="text-[26px] font-bold italic leading-tight tracking-tight">{title}</h3>

        {body ? (
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/90">{body}</p>
        ) : (
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/75">
            This parish's history has not been written up yet. The parish office can add it
            from the admin portal.
          </p>
        )}

        {body && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="mt-4 inline-flex items-center gap-1 text-[14px] font-bold uppercase tracking-[0.12em] text-white/90"
          >
            Learn more
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
}
