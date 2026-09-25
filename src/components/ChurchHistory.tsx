import type { CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import type { Route } from "../types";
import { PARISH_PATRON_IMAGES, PARISH_PATRON_SAINTS } from "../data";
import { useParishContent } from "../lib/useParishContent";

interface ParishHistorySection {
  /** Sits above the paragraphs in small caps, as "OUR HISTORY" does. */
  heading: string;
  paragraphs: string[];
}

interface ParishHistoryContent {
  sections: ParishHistorySection[];
}

// Real parish-specific history text, keyed by route id. Both of these came
// from the diocese's own material — nothing here is invented. A parish with
// no entry falls back to the honest "not yet documented" panel below rather
// than showing either of these.
const PARISH_HISTORY: Record<string, ParishHistoryContent> = {
  "route-mhcp": {
    sections: [
      {
        heading: "Our History",
        paragraphs: [
          "Mary Help of Christians Parish in Maypajo, Caloocan City was established in 1952 to serve the rapidly expanding population of Southern Caloocan and to provide a sacred sanctuary dedicated to Marian devotion. Under the zealous pastoral leadership of the parish priests and active community builders, it grew from a simple chapel of wood and nipa into a beautiful parish that stands as a beacon of Christian faith and Salesian spirit.",
          "Over the decades, the parish has nurtured thousands of families, active lay organizations, and youth ministries, becoming a vital hub for prayer, catechesis, sacraments, and social services.",
        ],
      },
      {
        heading: "Our Patroness",
        paragraphs: [
          "The beloved patroness is the Blessed Virgin Mary under the title Mary, Help of Christians (Maria Auxiliadora). This title highlights her powerful maternal role as a helper, protector, and defender of Christians in times of severe trial, hardship, or spiritual battle.",
          "Venerated highly within the Salesian family of St. John Bosco, her image depicts her holding the Child Jesus with both arms open, inviting the faithful to surrender their cares, seek grace, and find victory over life's daily storms through Christ.",
        ],
      },
    ],
  },
  "route-src": {
    sections: [
      {
        heading: "Our History",
        paragraphs: [
          "The historic San Roque Cathedral was originally founded as a parish in 1815 under the Archdiocese of Manila. The church stood witness to the turbulent days of the Philippine Revolution, serving as a military post and safe haven for local revolutionaries. It was repeatedly damaged during wars but rose each time through the absolute devotion of the Caloocan parishioners.",
          "In 2003, His Holiness Pope John Paul II established the Diocese of Kalookan, and San Roque Parish was officially elevated to the dignity of a Cathedral, serving as the central seat of the Bishop, guiding the spiritual flock of Caloocan, Malabon, and Navotas.",
        ],
      },
      {
        heading: "Our Patron",
        paragraphs: [
          "The Cathedral is named in honor of San Roque (Saint Roch), a 14th-century lay saint who traveled across Europe nursing patients afflicted with the horrific bubonic plague. He is depicted pointing to a plague sore on his thigh, flanked by his faithful dog who brought him daily loaves of bread when he was isolated in the forest.",
          "San Roque is beloved as the patron saint of the sick, plague victims, healthcare workers, and epidemics, standing as a testament of pure Christian charity, selfless volunteerism, and healing.",
        ],
      },
    ],
  },
};

/**
 * True when the history page has something to show for this parish — either
 * the compiled text above or, at runtime, something the parish has written
 * itself.
 *
 * Exported because the Church History card on Home has to decide whether to
 * offer "Learn more", and the only honest basis for that is whether there is
 * a page behind it. The card used to key that button off admin-written text
 * alone, so both parishes with a real compiled history showed "not been
 * written up yet" and no way through to the history they already had.
 */
export function hasParishHistory(routeId: string, managedBody?: string | null): boolean {
  return Boolean(managedBody?.trim()) || (PARISH_HISTORY[routeId]?.sections.length ?? 0) > 0;
}

/** The opening of a parish's compiled history, for the card that links to it. */
export function parishHistoryLede(routeId: string): string | undefined {
  return PARISH_HISTORY[routeId]?.sections[0]?.paragraphs[0];
}

/**
 * The panel's colours, sampled from the parish's own artboard in
 * "SANCTIWALK UI (1).psd" rather than picked here. The design gives each
 * parish a gradient drawn out of its patron's own image — the blue of Maria
 * Auxiliadora's mantle, the burnt orange of San Roque's habit — so the page
 * belongs to the church it is about rather than to the app.
 */
const PARISH_HISTORY_ACCENT: Record<string, { top: string; bottom: string }> = {
  "route-mhcp": { top: "#3DA8EA", bottom: "#00204C" },
  "route-src": { top: "#D37931", bottom: "#46280F" },
};

const DEFAULT_ACCENT = { top: "#2D5FA8", bottom: "#0B1D3F" };

/**
 * The photograph the history page opens on, taken from the parish's own
 * artboard in the PSD and cropped clear of the mockup's status bar.
 *
 * Separate from PARISH_PATRON_IMAGES on purpose. Those are wide shots of the
 * patron in its niche, which is right for a card on Home but wrong filling
 * half a screen - at that size the figure is small and the frame is mostly
 * altar. The design opens on the face, and these are the frames the design
 * opens on. A parish with no entry falls back to its niche photograph, which
 * is still better than an empty panel.
 */
const PARISH_HISTORY_PHOTOS: Record<string, string> = {
  "route-mhcp": "/parish/mary-help-history.jpg",
  "route-src": "/parish/san-roque-history.jpg",
};

/** Where the face sits in each of those frames, as a fraction of the height. */
const PARISH_HISTORY_FACES: Record<string, number> = {
  "route-mhcp": 0.38,
  "route-src": 0.3,
};

/**
 * The hero photograph for a parish, and where to crop it.
 *
 * Exported so the parish's own page can open on the same frame as its
 * history rather than on a different photograph of the same statue.
 */
export function parishHeroPhoto(routeId: string, managedPhoto?: string | null): {
  src: string | undefined;
  /** An object-position value, already in the form CSS wants. */
  position: string;
} {
  // An admin-uploaded photograph wins, but nobody has said where its subject
  // is, so it gets the neutral crop rather than another parish's measurement.
  if (managedPhoto) return { src: managedPhoto, position: "center 30%" };

  const designed = PARISH_HISTORY_PHOTOS[routeId];
  if (designed) {
    return { src: designed, position: "center " + Math.round(PARISH_HISTORY_FACES[routeId] * 100) + "%" };
  }
  return { src: PARISH_PATRON_IMAGES[routeId], position: "center 30%" };
}

/**
 * A parish's two panel colours. Exported so the parish's own page can wear
 * the same livery as its history rather than the app's flat navy - in the
 * PSD these are one design, and a pilgrim moving between them should not
 * feel they have changed apps.
 */
export function parishAccent(routeId: string): { top: string; bottom: string } {
  return PARISH_HISTORY_ACCENT[routeId] ?? DEFAULT_ACCENT;
}

interface ChurchHistoryProps {
  parish: Route;
  /** Omitted when this page is reached from the tab bar rather than from a parish. */
  onBack?: () => void;
}

/**
 * A parish's history — the "MHCP HISTORY PAGE" and "SRCP HISTORY PAGE"
 * artboards from the client's PSD.
 *
 * The design is one idea: the patron fills the top of the screen, and the
 * history rises over the bottom of that photograph on a panel coloured from
 * the image itself. There is no card, no border and no white page — the words
 * sit on the parish's own colour, which is also why the panel carries a faint
 * second copy of the patron behind the text instead of a flat fill.
 *
 * The title is the patron's name rather than the parish's. That is what the
 * PSD has ("Maria Auxiliadora", "San Roque"), and it is right: this is a
 * devotional history, and the parish name is on every screen that leads here.
 */
export default function ChurchHistory({ parish, onBack }: ChurchHistoryProps) {
  const managed = useParishContent(parish.id);
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");

  // The stored patron is "Maria Auxiliadora (Mary Help of Christians)". The
  // gloss repeats the parish name that led the pilgrim here, and at display
  // size it turned a two-line title into five.
  const patron = PARISH_PATRON_SAINTS[parish.id]?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const title = managed?.historyTitle?.trim() || patron || parishName;
  const hero = parishHeroPhoto(parish.id, managed?.historyPhotoUrl);
  const photo = hero.src;
  const accent = PARISH_HISTORY_ACCENT[parish.id] ?? DEFAULT_ACCENT;

  // Admin-written history replaces the compiled text rather than joining it.
  // A parish that has written its own history has said what it wants said,
  // and running the two together would publish a version nobody approved.
  const managedBody = managed?.historyBody?.trim();
  const sections: ParishHistorySection[] = managedBody
    ? [
        {
          heading: "Our History",
          paragraphs: managedBody
            .split(/\n{2,}/)
            .map(paragraph => paragraph.trim())
            .filter(Boolean),
        },
      ]
    : PARISH_HISTORY[parish.id]?.sections ?? [];

  const style = {
    "--ph-top": accent.top,
    "--ph-bottom": accent.bottom,
    "--ph-face": hero.position,
  } as CSSProperties;

  return (
    <div className="parish-history" style={style}>
      <div className="parish-history__hero">
        {photo ? (
          <img
            className="parish-history__photo"
            src={photo}
            alt={patron ? `${patron}, the patron of ${parishName}` : parishName}
          />
        ) : (
          <div className="parish-history__photo parish-history__photo--empty" aria-hidden />
        )}

        {onBack && (
          // Floating over the photograph rather than sitting in a bar above
          // it. The artboard has no header here at all, and a bar would spend
          // the top of the patron's image saying one word.
          <button type="button" onClick={onBack} className="parish-history__back" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <article className="parish-history__panel">
        {/* The patron again, very faint, behind the words. It is what gives
            the panel its depth in the PSD; a flat fill reads as a coloured
            box. Hidden from assistive tech because the same photograph is
            already described directly above it. */}
        {photo && <img className="parish-history__watermark" src={photo} alt="" aria-hidden />}

        <div className="parish-history__body">
          <h1 className="parish-history__title">{title}</h1>

          {sections.length > 0 ? (
            sections.map(section => (
              <section key={section.heading} className="parish-history__section">
                <h2 className="parish-history__eyebrow">{section.heading}</h2>
                {section.paragraphs.map(paragraph => (
                  <p key={paragraph.slice(0, 48)} className="parish-history__paragraph">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))
          ) : (
            // No compiled text, and nothing written by the parish. Inventing
            // a history would put words in a church's mouth, and a devotional
            // history that is subtly wrong is worse than an honest absence.
            <section className="parish-history__section">
              <h2 className="parish-history__eyebrow">Our History</h2>
              <p className="parish-history__paragraph">
                {parishName} has not had its history written up yet. The parish office can add it
                from the admin portal, and it will appear here.
              </p>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
