import type { ReactNode } from "react";
import { Sparkles, Users } from "lucide-react";
import { MINISTRIES, SACRAMENTS } from "../data";
import { t } from "../lib/ui";
import type { Language } from "../lib/language";

/**
 * These two photographs are Mary Help of Christians' own.
 *
 * They came out of that parish's PDF: its altar servers, a christening
 * in its church. They were shown on every parish's Home, so somebody
 * opening San Roque was looking at a photograph of another parish's
 * people and reasonably taking it for their own. For a guide whose
 * whole claim is that it tells you the truth about the church you are
 * standing in, that is the worst kind of wrong - confident and
 * plausible.
 *
 * San Roque's own photographs have not been collected yet. Until they
 * are, it gets the mark instead of somebody else's congregation.
 */
const PARISH_PHOTOS: Record<string, { ministry: string; sacrament: string }> = {
  "route-mhcp": {
    ministry: "/parish/ministry-altar-servers.jpg",
    sacrament: "/parish/sacraments-christening.jpg",
  },
};

/**
 * The two ways in, as their own section on Home.
 *
 * They used to live inside the bulletin, between the verse and the
 * announcements. The bulletin is now the last thing on Home — it is
 * the part that changes daily, not the part people come looking for —
 * and these two are a destination the directory at the top jumps to,
 * so they need to be a section of their own rather than a passenger
 * inside another one.
 */
export default function MinistrySacramentPair({
  language,
  onNavigate,
  parishId,
}: {
  language: Language;
  onNavigate: (tab: "ministries" | "sacraments") => void;
  /** Whose Home this is. Decides whether there are photographs to show. */
  parishId?: string;
}) {
  const photos = parishId ? PARISH_PHOTOS[parishId] : undefined;

  return (
    <div className="bulletin-pair">
      <Card
        icon={<Users className="w-4 h-4" />}
        label={t("quick.ministries", language)}
        hint={language === "fil" ? "Sumali sa isang grupo sa parokyang ito." : "Join a group in this parish."}
        caption={MINISTRIES[0]?.name}
        imageUrl={photos?.ministry}
        onClick={() => onNavigate("ministries")}
      />
      <Card
        icon={<Sparkles className="w-4 h-4" />}
        label={t("quick.sacraments", language)}
        hint={language === "fil" ? "Inaayos kasama ang tanggapan ng parokya." : "Arranged with the parish office."}
        caption={SACRAMENTS[0]?.name}
        imageUrl={photos?.sacrament}
        onClick={() => onNavigate("sacraments")}
      />
    </div>
  );
}

function Card({
  icon, label, hint, caption, imageUrl, onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  /** Named over the photograph — an example of what is inside. */
  caption?: string;
  imageUrl?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="bulletin-section">
      {!imageUrl && (
        /* No photograph for this parish yet. The mark, on the parish's
           own tint, rather than a stock picture or another church's
           congregation - it says "nothing here yet" without pretending
           otherwise. */
        <span className="bulletin-section__photo bulletin-section__photo--mark">
          <img src="/ui/sanctiwalk-icon-512.png" alt="" loading="lazy" />
        </span>
      )}

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
          {label}
        </span>
        <span className="bulletin-section__hint">{hint}</span>
      </span>
    </button>
  );
}
