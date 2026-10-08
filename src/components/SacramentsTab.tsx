import React, { useState } from "react";
import ParishSectionHeader from "./ParishSectionHeader";
import { SACRAMENTS, SACRAMENT_IMAGES } from "../data";
import { Sparkles, Calendar, BookOpen, ChevronDown, ChevronUp, Check, CheckCircle, AlertCircle, Bookmark, Info, ArrowLeft, ChevronRight } from "lucide-react";
import { Route } from "../types";
import { submitApplication } from "../lib/applications";
import { useParishContent } from "../lib/useParishContent";
import ApplicationForm from "./ApplicationForm";
import SignInFirst from "./SignInFirst";
import ItemDetailSections from "./ItemDetailSections";
import { resolveSacrament } from "../lib/itemContent";
import { isOpenForApplications, closedMessage } from "../lib/availability";
import AvailabilityBadge from "./AvailabilityBadge";

interface SacramentsTabProps {
  parish: Route;
  onAddApplication: (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => void;
  /** The signed-in pilgrim. Applying without one is refused by the rules. */
  uid?: string | null;
  userEmail?: string;
  onOpenSignIn?: () => void;
}

/** Stands in until the parish photographs each sacrament. */
const PLACEHOLDER_SACRAMENT = "/parish/placeholder-photo.svg";

export default function SacramentsTab({
  parish, onAddApplication, uid, userEmail, onOpenSignIn,
}: SacramentsTabProps) {
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");

  // Which sacraments this parish is currently taking applications for.
  const managed = useParishContent(parish.id);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  /// Which sacrament has the whole screen, or null for the list. The same
  /// split as Ministries: a sacrament is either one of several being browsed
  /// or the only thing on the page, and the old accordion made every row
  /// grow downwards while you were reading it.
  const [openId, setOpenId] = useState<string | null>(null);
  /// Which sacrament's application screen is open, or null.
  ///
  /// Apply used to scroll to a form at the bottom of this page - a form
  /// which then asked, again, which sacrament you wanted. Tapping Apply
  /// had already answered that. It is now its own screen, and the
  /// sacrament is the one whose page you were reading.
  const [applyingToId, setApplyingToId] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string>("");

  const applyingTo = SACRAMENTS.find(s => s.id === applyingToId) ?? null;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (applyingTo) {
    if (!uid) {
      return (
        <SignInFirst
          what={applyingTo.name}
          onSignIn={onOpenSignIn ?? (() => {})}
          onBack={() => setApplyingToId(null)}
        />
      );
    }
    // The parish can close a sacrament while this screen is open - the
    // content is live. Checked here as well as on the button, so a
    // screen left open overnight cannot post into a closed queue. The
    // security rules refuse it too; this makes the refusal a sentence.
    if (!isOpenForApplications(managed, applyingTo.id)) {
      setApplyingToId(null);
      return null;
    }
    return (
      <ApplicationForm
        kind="sacrament"
        itemId={applyingTo.id}
        itemName={applyingTo.name}
        parishName={parishName}
        defaults={{ email: userEmail }}
        onClose={() => setApplyingToId(null)}
        onSubmitted={() => setLastSent(applyingTo.name)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      <div hidden={openId !== null}>
      <ParishSectionHeader
        routeId={parish.id}
        eyebrow="Holy Sacraments"
        title="Sacraments Office"
        blurb="Review the guidelines, prepare the documents, and arrange a sacrament with the parish."
        icon={<Sparkles className="w-3.5 h-3.5" />}
        collapsing
      />
      </div>

      <div className="p-4 space-y-4">
        {/* Canon law requirements for these sacraments do not change from
            parish to parish — this note keeps the app honest about that
            rather than implying the list below is {parishName}-specific. */}
        <div className="flex items-start gap-2 p-3 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl"
          hidden={openId !== null}
        >
          <Info className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0 mt-0.5" />
          <p className="text-[15px] text-[var(--color-brand-text)] font-sans leading-snug">
            Canonical requirements are the same diocese-wide. Booking below will be handled by <strong>{parishName}</strong>, your current parish.
          </p>
        </div>

        {/* Sacraments Guide Accordion */}
        <div className="space-y-2.5">
          <h3 className="text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest font-serif italic pl-1">
            Canonical Requirements
          </h3>

          <div className="space-y-2">
            {/* The list: one photo card per sacrament, the same card Ministries
                and the bulletin rail already use. */}
            {openId === null && SACRAMENTS.map(sac => (
              <button
                key={sac.id}
                type="button"
                onClick={() => { setOpenId(sac.id); setExpandedId(sac.id); }}
                className={`ministry-card${isOpenForApplications(managed, sac.id) ? "" : " is-unavailable"}`}
              >
                <span className="ministry-card__media">
                  <img
                    src={SACRAMENT_IMAGES[sac.id] ?? PLACEHOLDER_SACRAMENT}
                    alt=""
                    loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_SACRAMENT; }}
                  />
                  <span className="ministry-card__scrim" aria-hidden />
                  <span className="ministry-card__caption">{sac.name}</span>
                </span>
                <span className="ministry-card__foot">
                  <Bookmark className="w-5 h-5 text-[var(--color-brand-primary)] shrink-0" />
                  <span className="ministry-card__hint">{sac.description}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                </span>
              </button>
            ))}

            {(openId ? SACRAMENTS.filter(x => x.id === openId) : []).map((sac) => {
              const isExpanded = true;
              const resolved = resolveSacrament(managed, sac.id);
              return (
                <div
                  key={sac.id}
                  className="bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] overflow-hidden shadow-xs transition-all"
                >
                  <div className="ministry-hero">
                    <img
                      src={SACRAMENT_IMAGES[sac.id] ?? PLACEHOLDER_SACRAMENT}
                      alt=""
                      onError={e => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_SACRAMENT; }}
                    />
                    <span className="ministry-hero__scrim" aria-hidden />
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      aria-label="Back to the sacraments"
                      className="ministry-hero__back"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h4 className="ministry-hero__name">{sac.name}</h4>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[var(--color-brand-card)] bg-[var(--color-brand-card)]/30 space-y-3 font-sans">
                      <AvailabilityBadge
                        open={isOpenForApplications(managed, sac.id)}
                        kind="sacrament"
                      />

                      {/* The parish's own words where they have written
                          any; the compiled text where they have not.
                          Requirements, schedule, process and reminders
                          each render only when there is something in
                          them - see ItemDetailSections. */}
                      <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed">
                        {resolved?.about ?? sac.description}
                      </p>

                      {resolved && <ItemDetailSections item={resolved} />}

                      {/* The information stays readable either way. A
                          pilgrim whose parish has paused Confirmation
                          still needs the requirements, so they can have
                          the papers ready when it reopens. */}
                      {isOpenForApplications(managed, sac.id) ? (
                        <button
                          onClick={() => setApplyingToId(sac.id)}
                          className="py-1.5 px-3 bg-[var(--color-brand-primary)] text-white text-sm font-bold uppercase tracking-wider rounded-full hover:bg-[var(--color-brand-primary-dark)] transition-colors"
                        >
                          Apply now
                        </button>
                      ) : (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            disabled
                            className="py-1.5 px-3 bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] text-[var(--color-brand-secondary)] text-sm font-bold uppercase tracking-wider rounded-full cursor-not-allowed"
                          >
                            Not available
                          </button>
                          <p className="text-sm leading-relaxed text-[var(--color-brand-secondary)]">
                            {closedMessage("sacrament", sac.name)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
