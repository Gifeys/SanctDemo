import type { CSSProperties, ReactNode } from "react";
import { PARISH_HEADER_FACES, PARISH_HEADER_IMAGES, PARISH_PATRON_IMAGES } from "../data";
import { parishThemeStyle } from "../lib/parishTheme";

interface ParishSectionHeaderProps {
  /** Route id, so the photograph and the colours are this parish's. */
  routeId: string;
  /** The small line above the title: "Serve and Volunteer". */
  eyebrow: string;
  title: string;
  blurb?: string;
  /** Sits in the eyebrow, before the words. */
  icon?: ReactNode;
}

/**
 * The header on Ministries, Sacraments and the section pages like them.
 *
 * It used to be a flat navy panel with a giant faded outline icon in the
 * corner — the same panel on every screen, for every parish. Two things were
 * wrong with that. The colour was Mary Help's blue, so San Roque's ministries
 * were introduced in another parish's livery; and the decoration was a
 * clip-art icon where the app everywhere else uses the parish's own
 * photography.
 *
 * This is the welcome band from Home, reused: the patron's photograph bled in
 * from the right behind the words, the parish's own ink underneath, and the
 * one italic serif the design uses for a parish's name. A pilgrim moving
 * from Home into Ministries should not feel they have changed apps.
 */
export default function ParishSectionHeader({
  routeId,
  eyebrow,
  title,
  blurb,
  icon,
}: ParishSectionHeaderProps) {
  const photo = PARISH_HEADER_IMAGES[routeId] ?? PARISH_PATRON_IMAGES[routeId];

  // Where the patron's face sits in that photograph, as a fraction of its
  // height. Without it the crop is top-aligned and Mary's face ends up
  // above the band while the band shows her hem.
  const face = PARISH_HEADER_FACES[routeId];

  const style = {
    ...parishThemeStyle(routeId),
    ...(face != null ? { "--psh-face": `${Math.round(face * 100)}%` } : {}),
  } as CSSProperties;

  return (
    <header className="parish-section" style={style}>
      {photo && (
        <>
          <div
            className="parish-section__photo"
            style={{ backgroundImage: `url(${photo})` }}
            aria-hidden
          />
          {/* A scrim, not a shadow. These are gilded statues under warm
              light, so the brightness behind the text cannot be assumed: a
              shadow holds over dark vestments and vanishes over gold. */}
          <div className="parish-section__scrim" aria-hidden />
        </>
      )}

      <div className="parish-section__content">
        <p className="parish-section__eyebrow">
          {icon}
          {eyebrow}
        </p>
        <h2 className="parish-section__title">{title}</h2>
        {blurb && <p className="parish-section__blurb">{blurb}</p>}
      </div>
    </header>
  );
}
