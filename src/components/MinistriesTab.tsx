import React, { useState } from "react";
import ParishSectionHeader from "./ParishSectionHeader";
import { MINISTRIES, MINISTRY_IMAGES } from "../data";
import { searchMinistries, suggestionsFor } from "../lib/ministrySearch";
import { Users, ChevronDown, ChevronUp, Check, CheckCircle, Sparkles, AlertCircle, Info, X, ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Route } from "../types";
import { type MinistryApplicationDoc } from "../lib/ministryApplication";
import ApplicationForm from "./ApplicationForm";
import SignInFirst from "./SignInFirst";
import ItemDetailSections from "./ItemDetailSections";
import { resolveMinistry } from "../lib/itemContent";
import { useLanguage } from "../lib/useLanguage";
import { pick } from "../lib/language";
import { MINISTRY_DESCRIPTION_EN, bilingualFor } from "../lib/contentTranslations";
import { submitApplication } from "../lib/applications";
import { useParishContent } from "../lib/useParishContent";
import { isOpenForApplications, closedMessage } from "../lib/availability";
import AvailabilityBadge from "./AvailabilityBadge";

interface MinistriesTabProps {
  parish: Route;
  onAddApplication: (app: MinistryApplicationDoc) => void;
  /** The signed-in pilgrim's uid, or null when signed out. */
  uid: string | null;
  /** Their account email. The form never asks for what the account knows. */
  userEmail: string;
  onOpenSignIn: () => void;
}

/**
 * Stands in until the parish photographs each ministry. An illustration of
 * nothing in particular rather than a stock photo of somebody else's choir,
 * which in this card would read as a photo of THIS parish's choir.
 */
const PLACEHOLDER_MINISTRY = "/parish/placeholder-photo.svg";

export default function MinistriesTab({ parish, onAddApplication, uid, userEmail, onOpenSignIn }: MinistriesTabProps) {
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");

  // Which ministries this parish is currently taking applications for.
  // Parish-scoped, not global: the choir may be full at Mary Help and
  // short-handed at San Roque, and the ministries themselves are shared.
  const managed = useParishContent(parish.id);
  const { language } = useLanguage();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  /// Which ministry has been opened to its own full screen, or null for the
  /// list. Separate from expandedId, which the accordion still uses: a
  /// ministry is either one of several being browsed or the only thing on
  /// the screen, and conflating those is what made the old page a list of
  /// rows that grew downwards while you read them.
  const [openId, setOpenId] = useState<string | null>(null);

  /// What has been typed into the search box. Fifteen ministries is more
  /// than anyone scrolls through looking for one they half-remember the
  /// name of.
  const [query, setQuery] = useState("");

  const matches = searchMinistries(MINISTRIES, query);
  const suggestions = suggestionsFor(MINISTRIES);

  /// Which ministry's application screen is open, or null.
  ///
  /// Applying now takes over the whole screen rather than unfolding a
  /// form under the card. Reading about a ministry and applying to it
  /// are two different jobs, and the form needs room for its steps, its
  /// validation and its review - none of which fit under a description
  /// without burying the thing you were reading.
  const [applyingToId, setApplyingToId] = useState<string | null>(null);

  /// What the pilgrim last sent, so the list can say so when they come
  /// back out of the application screen.
  const [submittedMinistry, setSubmittedMinistry] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const applyingTo = MINISTRIES.find(m => m.id === applyingToId) ?? null;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // The application screen replaces everything, including the tab's own
  // header. Rendering it alongside would leave "Parish Ministries" and a
  // search box above a form, which is the half-measure this replaced.
  if (applyingTo) {
    if (!uid) {
      return (
        <SignInFirst
          what={applyingTo.name}
          onSignIn={onOpenSignIn}
          onBack={() => setApplyingToId(null)}
        />
      );
    }
    return (
      <ApplicationForm
        kind="ministry"
        itemId={applyingTo.id}
        itemName={applyingTo.name}
        parishName={parishName}
        defaults={{ email: userEmail }}
        onClose={() => setApplyingToId(null)}
        onSubmitted={() => {
          setSubmittedMinistry(applyingTo.name);
          setIsSubmitted(true);
          // Deliberately NOT onAddApplication. That prop writes a second
          // document straight to the applications collection, and
          // ApplicationForm has already written the real one through
          // lib/applications - the one with the reference number, the
          // history entry and the notification. Calling both would file
          // every application twice.
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      <ParishSectionHeader
        routeId={parish.id}
        eyebrow="Serve and Volunteer"
        title="Parish Ministries"
        blurb="Join our lay ministries to serve the parish community."
        icon={<Sparkles className="w-3.5 h-3.5" />}
        collapsing
      />

      <div className="p-4 space-y-4">
        {/* These ministry types are the same across the diocese — this is
            not {parishName}'s own private list, and the app should say so
            rather than implying otherwise. */}
        <div
          className="flex items-start gap-2 p-3 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl"
          hidden={openId !== null}
        >
          <Info className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0 mt-0.5" />
          <p className="text-[15px] text-[var(--color-brand-text)] font-sans leading-snug">
            These ministries are offered diocese-wide. Applying below will route your application to <strong>{parishName}</strong>, your current parish.
          </p>
        </div>

        {/* The list: one photo card per ministry, the same card the bulletin
            rail uses on Home. It was a stack of text rows, which read as a
            form to fill in rather than as people to join. */}
        {openId === null && (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-3 pl-1">
              <h3 className="text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest font-serif italic">
                Available Ministries
              </h3>
              <span className="text-[14px] text-[var(--color-brand-secondary)] shrink-0 tabular-nums">
                {query.trim() ? `${matches.length} of ${MINISTRIES.length}` : MINISTRIES.length}
              </span>
            </div>

            {/* In the flow, not floating over it. An overlay here would sit
                on top of the very cards it filters, which is the thing it
                exists to help you read. */}
            <div className="ministry-search">
              <Search className="w-4 h-4 shrink-0 text-[var(--color-brand-secondary)]" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search a ministry"
                aria-label="Search the ministries"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear the search"
                  className="shrink-0 text-[var(--color-brand-secondary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Shown only before anything is typed. Each one is checked
                against the ministries actually present, so a suggestion can
                never lead to an empty screen. */}
            {!query.trim() && suggestions.length > 0 && (
              <div className="ministry-chips">
                {suggestions.map(chip => (
                  <button key={chip} type="button" onClick={() => setQuery(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {query.trim() && matches.length === 0 && (
              <p className="px-1 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
                No ministry matches &ldquo;{query.trim()}&rdquo;. Try a shorter word, or the
                short name the parish uses &mdash; MAS, EMHC, SOCCOM.
              </p>
            )}

            <div className="space-y-3">
              {matches.map(min => (
                <button
                  key={min.id}
                  type="button"
                  onClick={() => {
                    setOpenId(min.id);
                    setExpandedId(min.id);
                    setApplyingToId(null);
                    setIsSubmitted(false);
                  }}
                  className={`ministry-card${isOpenForApplications(managed, min.id) ? "" : " is-unavailable"}`}
                >
                  <span className="ministry-card__media">
                    <img
                      src={MINISTRY_IMAGES[min.id] ?? PLACEHOLDER_MINISTRY}
                      alt=""
                      loading="lazy"
                      onError={e => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_MINISTRY; }}
                    />
                    <span className="ministry-card__scrim" aria-hidden />
                    <span className="ministry-card__caption">{min.name}</span>
                  </span>
                  <span className="ministry-card__foot">
                    <Users className="w-5 h-5 text-[var(--color-brand-primary)] shrink-0" />
                    <span className="ministry-card__hint">{pick(bilingualFor(min.description, MINISTRY_DESCRIPTION_EN[min.id], "fil"), language)}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                  </span>
                  {/* On the list too, not only inside. Otherwise the only
                      way to find out the choir is closed is to open it. */}
                  {!isOpenForApplications(managed, min.id) && (
                    <span className="block px-3 pb-3">
                      <AvailabilityBadge open={false} kind="ministry" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* One ministry, on its own screen. Only the opened one is rendered,
            so the accordion below is always the expanded state - there is
            nothing else on the page to collapse against. */}
        <div className="space-y-2.5">
          <div className="space-y-2">
            {(openId ? MINISTRIES.filter(m => m.id === openId) : []).map((min) => {
              const isExpanded = true;
              const resolved = resolveMinistry(managed, min.id, language);
              return (
                <div
                  key={min.id}
                  className={`bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] overflow-hidden shadow-xs transition-all${
                    isOpenForApplications(managed, min.id) ? "" : " is-unavailable"
                  }`}
                >
                  <div className="ministry-hero">
                    <img
                      src={MINISTRY_IMAGES[min.id] ?? PLACEHOLDER_MINISTRY}
                      alt=""
                      onError={e => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_MINISTRY; }}
                    />
                    <span className="ministry-hero__scrim" aria-hidden />
                    <button
                      type="button"
                      onClick={() => { setOpenId(null); setApplyingToId(null); }}
                      aria-label="Back to the ministries"
                      className="ministry-hero__back"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h4 className="ministry-hero__name">{min.name}</h4>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[var(--color-brand-card)] bg-[var(--color-brand-card)]/30 space-y-3 font-sans">
                      <AvailabilityBadge
                        open={isOpenForApplications(managed, min.id)}
                        kind="ministry"
                      />

                      {/* The parish's own words where they have written
                          any, the compiled description where they have
                          not. Every section below renders only when it
                          has something in it - a heading over an empty
                          list reads as a page that failed to load. */}
                      <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed">
                        {resolved?.about ?? min.description}
                      </p>

                      {resolved && <ItemDetailSections item={resolved} />}

                      {/* Closed ministries keep their card, their
                          description and their requirements. Hiding them
                          would leave a pilgrim wondering whether the
                          ministry had been disbanded or whether the app
                          was broken; greyed out, the answer is on the
                          card. */}
                      {isOpenForApplications(managed, min.id) ? (
                        <button
                          onClick={() => {
                            setApplyingToId(min.id);
                            setIsSubmitted(false);
                          }}
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
                            {closedMessage("ministry", min.name)}
                          </p>
                        </div>
                      )}

                      {/* The form for THIS ministry, opened by the button
                          above. Nothing asks which ministry, and nothing
                          asks which parish: tapping Apply answered the
                          first and the dashboard answers the second. */}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation. The form lives inside the ministry card now, and
            that card may well be collapsed by the time this shows, so the
            confirmation stands on its own rather than inside it. */}
        {isSubmitted && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-green-700 mx-auto" />
            <div className="space-y-0.5">
              <h4 className="text-[15px] font-bold text-green-900 font-serif italic">Application submitted</h4>
              <p className="text-[15px] text-green-800 leading-relaxed font-sans">
                Your application to {submittedMinistry} at {parishName} is now
                <strong> Pending</strong>. We will contact you through your
                registered email regarding your application. You can follow its
                status under <strong>Me &rarr; My Application</strong>.
              </p>
            </div>
            <button
              onClick={() => setIsSubmitted(false)}
              className="mt-1.5 text-sm bg-[var(--color-brand-primary)] text-white px-3 py-1 rounded-full font-bold uppercase tracking-wide"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
