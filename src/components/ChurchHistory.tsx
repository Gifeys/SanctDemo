import React, { type CSSProperties } from "react";
import HistoryQuiz from "./HistoryQuiz";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import type { Route } from "../types";
import { PARISH_PATRON_IMAGES, PARISH_PATRON_SAINTS } from "../data";
import { useParishContent } from "../lib/useParishContent";
import { useLanguage } from "../lib/useLanguage";
import { pick, type Bilingual, type Language } from "../lib/language";
import { parishTheme } from "../lib/parishTheme";
import { MHCP_HISTORY } from "../data/mhcpHistory";
import { useNarration } from "../lib/useNarration";
import { historyScript, spokenLength } from "../lib/historyNarration";

/** The heading the parish's own Filipino account starts at. */
const FIRST_OWN_SECTION = pick(MHCP_HISTORY[0]?.heading, "fil");

/**
 * A photograph from the parish's own record, with what the parish
 * called it.
 *
 * `srcs` is a list because some captions cover a set - "Ilan sa mga
 * Lumang Larawan ng Iba't Ibang Samahan" names three photographs at
 * once, and splitting them would invent three captions the parish did
 * not write.
 *
 * `caption` is optional. Two of the photographs in the parish's
 * document carry none, and naming the people in them from the
 * surrounding text would be a guess printed under a face.
 */
export interface ParishFigure {
  srcs: string[];
  caption?: Bilingual | string;
  /** Where the parish got it: the souvenir programme, a photographer. */
  source: string;
}

export interface ParishHistorySection {
  /**
   * Sits above the paragraphs in small caps, as "OUR HISTORY" does.
   *
   * A plain string where only one language exists - the compiled
   * English sections and San Roque's - and a pair where the parish's
   * own text has been translated. `pick` takes either.
   */
  heading: Bilingual | string;
  paragraphs: (Bilingual | string)[];
  figures?: ParishFigure[];
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
        heading: { en: "Our History", fil: "Ang Aming Kasaysayan" },
        paragraphs: [
          {
            en: "Mary Help of Christians Parish in Maypajo, Caloocan City was established in 1952 to serve the rapidly expanding population of Southern Caloocan and to provide a sacred sanctuary dedicated to Marian devotion. Under the zealous pastoral leadership of the parish priests and active community builders, it grew from a simple chapel of wood and nipa into a beautiful parish that stands as a beacon of Christian faith and Salesian spirit.",
            fil: "Ang Parokya ng Mary Help of Christians sa Maypajo, Lungsod ng Caloocan ay itinatag noong 1952 upang paglingkuran ang mabilis na lumalaking populasyon ng Timog Caloocan at upang magbigay ng banal na santuwaryo na nakalaan sa debosyon kay Maria. Sa masigasig na pamumuno ng mga kura-paroko at ng mga aktibong tagapagtaguyod ng pamayanan, ito ay lumago mula sa isang simpleng kapilyang kahoy at nipa tungo sa isang magandang parokya na naninindigan bilang tanglaw ng pananampalatayang Kristiyano at ng diwang Salesiano.",
          },
          {
            en: "Over the decades, the parish has nurtured thousands of families, active lay organizations, and youth ministries, becoming a vital hub for prayer, catechesis, sacraments, and social services.",
            fil: "Sa paglipas ng mga dekada, inalagaan ng parokya ang libu-libong pamilya, mga aktibong samahang layko, at mga ministeryo ng kabataan, at naging mahalagang sentro ng panalangin, katesismo, mga sakramento, at paglilingkod sa lipunan.",
          },
        ],
      },
      {
        heading: { en: "Our Patroness", fil: "Ang Aming Patrona" },
        paragraphs: [
          {
            en: "The beloved patroness is the Blessed Virgin Mary under the title Mary, Help of Christians (Maria Auxiliadora). This title highlights her powerful maternal role as a helper, protector, and defender of Christians in times of severe trial, hardship, or spiritual battle.",
            fil: "Ang minamahal na patrona ay ang Mahal na Birheng Maria sa titulong Maria, Katulong ng mga Kristiyano (Maria Auxiliadora). Itinatampok ng titulong ito ang kanyang makapangyarihang papel bilang ina — katulong, tagapagtanggol, at tagapag-ingat ng mga Kristiyano sa panahon ng matinding pagsubok, kahirapan, o espirituwal na labanan.",
          },
          {
            en: "Venerated highly within the Salesian family of St. John Bosco, her image depicts her holding the Child Jesus with both arms open, inviting the faithful to surrender their cares, seek grace, and find victory over life's daily storms through Christ.",
            fil: "Lubos siyang iginagalang sa pamilyang Salesiano ni San Juan Bosco. Ipinapakita ng kanyang imahen na kalong niya ang Batang Hesus habang bukas ang kanyang mga bisig, na nag-aanyaya sa mga mananampalataya na ipagkatiwala ang kanilang mga alalahanin, humingi ng biyaya, at magtagumpay laban sa pang-araw-araw na unos ng buhay sa pamamagitan ni Kristo.",
          },
        ],
      },
      // The parish's own full account, in its own words and its own
      // language, after the two compiled sections above. See
      // data/mhcpHistory.ts.
      ...MHCP_HISTORY,
    ],
  },
  "route-src": {
    sections: [
      {
        heading: { en: "Our History", fil: "Ang Aming Kasaysayan" },
        paragraphs: [
          {
            en: "The historic San Roque Cathedral was originally founded as a parish in 1815 under the Archdiocese of Manila. The church stood witness to the turbulent days of the Philippine Revolution, serving as a military post and safe haven for local revolutionaries. It was repeatedly damaged during wars but rose each time through the absolute devotion of the Caloocan parishioners.",
            fil: "Ang makasaysayang Katedral ng San Roque ay orihinal na itinatag bilang parokya noong 1815 sa ilalim ng Arkidiyosesis ng Maynila. Ang simbahan ay naging saksi sa magulong mga araw ng Himagsikang Pilipino, na nagsilbing himpilang militar at ligtas na kanlungan ng mga lokal na rebolusyonaryo. Paulit-ulit itong nasira sa panahon ng mga digmaan ngunit muli itong nabangon sa bawat pagkakataon dahil sa lubos na debosyon ng mga parokyano ng Caloocan.",
          },
          {
            en: "In 2003, His Holiness Pope John Paul II established the Diocese of Kalookan, and San Roque Parish was officially elevated to the dignity of a Cathedral, serving as the central seat of the Bishop, guiding the spiritual flock of Caloocan, Malabon, and Navotas.",
            fil: "Noong 2003, itinatag ng Kanyang Kabanalan Papa Juan Pablo II ang Diyosesis ng Kalookan, at opisyal na itinaas ang Parokya ng San Roque sa dangal ng pagiging Katedral. Ito ang nagsisilbing pangunahing luklukan ng Obispo, na gumagabay sa espirituwal na kawan ng Caloocan, Malabon, at Navotas.",
          },
        ],
      },
      {
        heading: { en: "Our Patron", fil: "Ang Aming Patron" },
        paragraphs: [
          {
            en: "The Cathedral is named in honor of San Roque (Saint Roch), a 14th-century lay saint who traveled across Europe nursing patients afflicted with the horrific bubonic plague. He is depicted pointing to a plague sore on his thigh, flanked by his faithful dog who brought him daily loaves of bread when he was isolated in the forest.",
            fil: "Ang Katedral ay ipinangalan bilang parangal kay San Roque (Saint Roch), isang laykong santo noong ika-14 na siglo na naglakbay sa buong Europa upang alagaan ang mga maysakit na tinamaan ng kakila-kilabot na salot na bubonic. Siya ay inilalarawan na nakaturo sa sugat ng salot sa kanyang hita, kasama ang kanyang tapat na aso na araw-araw na nagdadala sa kanya ng tinapay noong siya ay nakabukod sa gubat.",
          },
          {
            en: "San Roque is beloved as the patron saint of the sick, plague victims, healthcare workers, and epidemics, standing as a testament of pure Christian charity, selfless volunteerism, and healing.",
            fil: "Si San Roque ay minamahal bilang patron ng mga maysakit, ng mga biktima ng salot, ng mga manggagawa sa kalusugan, at ng mga epidemya. Siya ay naninindigan bilang patotoo ng dalisay na pag-ibig Kristiyano, mapagkawanggawang paglilingkod, at paggaling.",
          },
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
/**
 * A parish's compiled history, for anything that has to read it rather
 * than render it.
 *
 * Exported for the quiz's test, which asserts that every correct answer
 * really is a sentence on this page. Without that check a question
 * could drift away from the history it claims to be about, or be
 * invented outright - which is the one thing this feature must not do.
 */
export function parishHistorySections(routeId: string): ParishHistorySection[] {
  return PARISH_HISTORY[routeId]?.sections ?? [];
}

export function hasParishHistory(routeId: string, managedBody?: string | null): boolean {
  return Boolean(managedBody?.trim()) || (PARISH_HISTORY[routeId]?.sections.length ?? 0) > 0;
}

/**
 * The opening of a parish's compiled history, for the card that links
 * to it. Takes the reader's language, since a parish's own sections
 * now carry both.
 */
export function parishHistoryLede(
  routeId: string,
  language: Language = "en",
): string | undefined {
  const first = PARISH_HISTORY[routeId]?.sections[0]?.paragraphs[0];
  return first === undefined ? undefined : pick(first, language);
}



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
 * A parish's two panel colours, from the one table that holds every
 * parish's livery. Kept as a named export because three call sites read the
 * panel gradient specifically, and "the history panel's colours" is a
 * clearer thing to ask for than two fields of a theme.
 */
export function parishAccent(routeId: string): { top: string; bottom: string } {
  const theme = parishTheme(routeId);
  return { top: theme.panelTop, bottom: theme.panelBottom };
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
  const { language } = useLanguage();
  const managed = useParishContent(parish.id);
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");

  // The stored patron is "Maria Auxiliadora (Mary Help of Christians)". The
  // gloss repeats the parish name that led the pilgrim here, and at display
  // size it turned a two-line title into five.
  const patron = PARISH_PATRON_SAINTS[parish.id]?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const title = managed?.historyTitle?.trim() || patron || parishName;
  const hero = parishHeroPhoto(parish.id, managed?.historyPhotoUrl);
  const photo = hero.src;
  const accent = parishAccent(parish.id);

  // Admin-written history replaces the compiled text rather than joining it.
  // A parish that has written its own history has said what it wants said,
  // and running the two together would publish a version nobody approved.
  const managedBody = managed?.historyBody?.trim();
  const sections: ParishHistorySection[] = managedBody
    ? [
        {
          // The heading is ours and is translated. The BODY is not:
          // it is whatever the parish office typed, in whichever
          // language they chose, and translating a parish's own words
          // for them would be publishing a version nobody approved.
          heading: { en: "Our History", fil: "Ang Aming Kasaysayan" },
          paragraphs: managedBody
            .split(/\n{2,}/)
            .map(paragraph => paragraph.trim())
            .filter(Boolean),
        },
      ]
    : PARISH_HISTORY[parish.id]?.sections ?? [];

  /*
   * The history, read aloud.
   *
   * The same voice the rest of SanctiWalk uses - native text-to-speech
   * on the phone, the browser's own on a laptop - asking for fil-PH or
   * en-US to match the language on screen. It reads the language the
   * reader is looking at, never a fixed one: a Filipino page narrated
   * in English would be the app talking over the parish.
   *
   * The engine is not everywhere. A browser with no installed voice
   * reports none, and `supported` is false there, so the control is
   * absent rather than present and dead.
   */
  const narration = useNarration(language);
  const script = historyScript(title, sections, language);
  const length = spokenLength(script, language);

  // Switching language mid-sentence would leave the previous language
  // playing under the new text. Stopping is the honest reaction; the
  // reader can tap again and hear it in the language they just chose.
  const stopNarration = narration.stop;
  React.useEffect(() => {
    stopNarration();
  }, [language, stopNarration]);

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

          {/* Directly under the title, where someone decides whether to
              read or to listen - not floating over the photograph, which
              is where a media control goes when it belongs to the image
              rather than to the words. */}
          {narration.supported && script && (
            <button
              type="button"
              onClick={() => narration.toggle(script)}
              className="parish-history__listen"
              aria-pressed={narration.speaking}
              aria-label={
                narration.speaking
                  ? "Stop reading this history aloud"
                  : `Read this history aloud${length ? `, ${length}` : ""}`
              }
            >
              {narration.speaking ? (
                <>
                  <VolumeX className="w-4 h-4" aria-hidden />
                  <span>{language === "fil" ? "Ihinto" : "Stop"}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" aria-hidden />
                  <span>{language === "fil" ? "Pakinggan" : "Listen"}</span>
                  {length && <span className="parish-history__listen-time">{length}</span>}
                </>
              )}
            </button>
          )}

          {sections.length > 0 ? (
            sections.map(section => (
              <React.Fragment key={pick(section.heading, "fil")}>
              {/* Said once, at the point the parish's own words begin.
                  Ten sections of Filipino arriving with no explanation
                  would read to an English reader as a translation the
                  app had failed to do, rather than as the parish's own
                  record left as the parish wrote it. */}
              {pick(section.heading, "fil") === FIRST_OWN_SECTION && (
                <p className="parish-history__language-note">
                  {language === "fil"
                    ? "Ang sumusunod ay ang buong kasaysayan na isinulat mismo ng parokya."
                    : "What follows is the parish's own history, written in Filipino and translated here for readers. The Filipino is the original; where the two differ, the parish's own words are the ones that stand."}
                </p>
              )}
              <section className="parish-history__section">
                <h2 className="parish-history__eyebrow">
                  {pick(section.heading, language)}
                </h2>
                {section.paragraphs.map(paragraph => {
                  const text = pick(paragraph, language);
                  return (
                    <p key={text.slice(0, 48)} className="parish-history__paragraph">
                      {text}
                    </p>
                  );
                })}

                {section.figures?.map(figure => (
                  <figure key={figure.srcs[0]} className="parish-figure">
                    <div
                      className={`parish-figure__frame${
                        figure.srcs.length > 1 ? " is-set" : ""}`}
                    >
                      {figure.srcs.map(src => (
                        <img
                          key={src}
                          src={src}
                          /* The caption is directly beneath and says the
                             same thing, so repeating it here would have a
                             screen reader read every photograph twice. */
                          alt=""
                          loading="lazy"
                          className="parish-figure__img"
                        />
                      ))}
                    </div>
                    <figcaption className="parish-figure__caption">
                      {figure.caption && <span>{pick(figure.caption, language)}</span>}
                      <span className="parish-figure__source">
                        Sanggunian: {figure.source}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </section>
              </React.Fragment>
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

          {/* At the very bottom, after the history has been read. See
              HistoryQuiz: it renders nothing for a parish whose
              history is not written up. */}
          <HistoryQuiz routeId={parish.id} />
        </div>
      </article>
    </div>
  );
}
