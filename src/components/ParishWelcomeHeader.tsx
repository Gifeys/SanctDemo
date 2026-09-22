import { MapPin, User } from "lucide-react";

interface ParishWelcomeHeaderProps {
  parishName: string;
  location?: string;
  /** The parish's patron image, bled in behind the text from the right. */
  imageUrl?: string;
  /** First name of the signed-in pilgrim, or undefined when signed out. */
  firstName?: string;
  onOpenProfile: () => void;
  /** Rendered so the date matches the rest of the screen's clock. */
  now: Date;
}

/**
 * The welcome header from the design: a dark navy band with the parish's
 * patron image bleeding in from the right, the SanctiWalk mark, a greeting,
 * the date, the parish name and where it is.
 *
 * It replaces a date row plus a collapsing photograph. That earlier header
 * put the picture in a card with the name underneath, so the top of the
 * screen read as a list item rather than as arriving somewhere; the design
 * has the image behind everything, which is what makes it feel like the
 * parish's own page.
 *
 * The greeting degrades rather than inventing a name: signed out it reads
 * "Welcome" alone. The design shows "WELCOME, ADRICH" because the designer
 * was signed in.
 */
export default function ParishWelcomeHeader({
  parishName,
  location,
  imageUrl,
  firstName,
  onOpenProfile,
  now,
}: ParishWelcomeHeaderProps) {
  const date = now
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  return (
    <header className="parish-welcome">
      {imageUrl && (
        <div
          className="parish-welcome__image"
          style={{ backgroundImage: `url("${imageUrl}")` }}
          aria-hidden="true"
        />
      )}
      {/* Two scrims, not one. A single left-to-right fade left the parish
          name legible but washed the top row out; this darkens the whole
          band a little and the text side a lot. */}
      <div className="parish-welcome__scrim" aria-hidden="true" />

      <div className="parish-welcome__content">
        <div className="parish-welcome__top">
          <span className="parish-welcome__brand">
            <img src="/ui/diocese-crest.png" alt="" className="parish-welcome__crest" />
            SanctiWalk
          </span>

          <button
            type="button"
            onClick={onOpenProfile}
            className="parish-welcome__avatar"
            aria-label="Your profile"
          >
            <User className="w-[18px] h-[18px]" />
          </button>
        </div>

        <p className="parish-welcome__greeting">
          {firstName ? (
            <>
              Welcome,
              <br />
              {firstName}
            </>
          ) : (
            "Welcome"
          )}
        </p>

        <p className="parish-welcome__date">{date}</p>

        <h1 className="parish-welcome__parish">{parishName}</h1>

        {location && (
          <p className="parish-welcome__location">
            <MapPin className="w-[15px] h-[15px] shrink-0" />
            {location}
          </p>
        )}
      </div>
    </header>
  );
}
