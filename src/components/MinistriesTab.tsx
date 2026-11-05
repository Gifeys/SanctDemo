import React, { useEffect, useState } from "react";
import ParishSectionHeader from "./ParishSectionHeader";
import { MINISTRY_IMAGES, ministriesForParish } from "../data";
import { searchMinistries, suggestionsFor } from "../lib/ministrySearch";
import { Users, ChevronDown, ChevronUp, Check, CheckCircle, Sparkles, AlertCircle, AlertTriangle, Info, X, ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Route } from "../types";
import { type MinistryApplicationDoc } from "../lib/ministryApplication";
import ApplicationForm from "./ApplicationForm";
import { watchMyMemberships } from "../lib/membershipStore";
import {
  alreadyMemberWarning, isMember, type MembershipDoc, type RegistrationType,
} from "../lib/memberships";
import SignInFirst from "./SignInFirst";
import ItemDetailSections from "./ItemDetailSections";
import { resolveMinistry } from "../lib/itemContent";
import { useLanguage } from "../lib/useLanguage";
import { pick } from "../lib/language";
import { MINISTRY_DESCRIPTION_EN, bilingualFor } from "../lib/contentTranslations";
import { submitApplication } from "../lib/applications";
import { blockedMessage, stillHoldsLock } from "../lib/applicationLock";
import type { ApplicationStatus } from "../types";
import { useParishContent } from "../lib/useParishContent";
import { watchItemPhotos } from "../lib/itemPhoto";
import { isOpenForApplications, closedMessage } from "../lib/availability";
import AvailabilityBadge from "./AvailabilityBadge";
import WatchBell from "./WatchBell";

interface MinistriesTabProps {
  parish: Route;
  onAddApplication: (app: MinistryApplicationDoc) => void;
  /** The signed-in pilgrim's uid, or null when signed out. */
  uid: string | null;
  /** Their account email. The form never asks for what the account knows. */
  userEmail: string;
  onOpenSignIn: () => void;
  /**
   * A request from outside to open one ministry to its own screen.
   *
   * Sancti sets this when a pilgrim names a ministry: "open Teatro
   * Pilipino" should open Teatro Pilipino, not a list of fifteen with
   * it somewhere inside. The id makes a repeat request its own event -
   * ask twice with a look at the list in between and a bare itemId
   * would be unchanged and the second ask would do nothing.
   */
  openRequest?: { itemId: string; id: number };
  /**
   * The pilgrim's own applications, already streaming in App.
   *
   * Passed rather than fetched so the Apply button can say why it is
   * unavailable without a second subscription - and so the reason is
   * the same one the database will give, rather than a guess.
   */
  myApplications?: Array<{ kind?: string; status?: string; type?: string }>;
}

/**
 * Stands in until the parish photographs each ministry. An illustration of
 * nothing in particular rather than a stock photo of somebody else's choir,
 * which in this card would read as a photo of THIS parish's choir.
 */
const PLACEHOLDER_MINISTRY = "/parish/placeholder-photo.svg";

/**
 * The parishes whose own ministry photographs we actually hold.
 *
 * MINISTRY_IMAGES came out of Mary Help of Christians' PDF - its
 * altar servers, its choirs, its lectors. Keyed by ministry id alone,
 * they were shown to every parish, so San Roque's page carried
 * photographs of another parish's people. The ministry ids are shared
 * between parishes; the congregations in the pictures are not.
 */
const PARISHES_WITH_OWN_PHOTOS = new Set(["route-mhcp"]);

export default function MinistriesTab({ parish, onAddApplication, uid, userEmail, onOpenSignIn, openRequest, myApplications = [] }: MinistriesTabProps) {
  /**
   * The ministry application the parish is still deciding on, if any.
   *
   * One at a time, across all ministries. Derived from the list App
   * already streams, so this costs no extra read - and it is the same
   * condition the rules enforce, so the button and the database agree
   * rather than the button guessing.
   */
  const openMinistryApplication = myApplications.find(
    a => a.kind === "ministry" && stillHoldsLock((a.status ?? "pending") as ApplicationStatus),
  );
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");

  // Which ministries this parish is currently taking applications for.
  // Parish-scoped, not global: the choir may be full at Mary Help and
  // short-handed at San Roque, and the ministries themselves are shared.
  const managed = useParishContent(parish.id);

  // The parish's own uploads, live. Kept in their own documents rather
  // than in the parish record, so fifteen photographs cannot overflow
  // it - see lib/itemPhoto.
  const [parishPhotos, setParishPhotos] = useState<Record<string, string>>({});
  useEffect(() => watchItemPhotos(parish.id, setParishPhotos), [parish.id]);

  // A photograph only when it is this parish's own, and the parish's
  // own upload ahead of anything compiled in: a secretary who has put
  // a photograph on this ministry has said what it should look like,
  // and no shipped default should override that.
  const photoFor = (ministryId: string) =>
    parishPhotos[ministryId]
    ?? (PARISHES_WITH_OWN_PHOTOS.has(parish.id)
          ? MINISTRY_IMAGES[ministryId] ?? PLACEHOLDER_MINISTRY
          : PLACEHOLDER_MINISTRY);
  const { language } = useLanguage();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  /// Which ministry has been opened to its own full screen, or null for the
  /// list. Separate from expandedId, which the accordion still uses: a
  /// ministry is either one of several being browsed or the only thing on
  /// the screen, and conflating those is what made the old page a list of
  /// rows that grew downwards while you read them.
  const [openId, setOpenId] = useState<string | null>(null);

  // Seeds the local state rather than replacing it, so the back button
  // and the list still work after Sancti has opened something.
  useEffect(() => {
    if (openRequest) setOpenId(openRequest.itemId);
  }, [openRequest?.id, openRequest?.itemId]);

  /// What has been typed into the search box. Fifteen ministries is more
  /// than anyone scrolls through looking for one they half-remember the
  /// name of.
  const [query, setQuery] = useState("");

  // This parish's ministries, not the app's. The list used to be the
  // same fifteen everywhere, which offered a pilgrim at San Roque
  // groups the cathedral had never been asked about.
  const ministries = ministriesForParish(parish?.id);
  const matches = searchMinistries(ministries, query);
  const suggestions = suggestionsFor(ministries);

  /// Which ministry's application screen is open, or null.
  ///
  /// Applying now takes over the whole screen rather than unfolding a
  /// form under the card. Reading about a ministry and applying to it
  /// are two different jobs, and the form needs room for its steps, its
  /// validation and its review - none of which fit under a description
  /// without burying the thing you were reading.
  const [applyingToId, setApplyingToId] = useState<string | null>(null);

  /// Joining, or confirming a membership they already have.
  ///
  /// Two buttons rather than a question inside the form, because the
  /// answer changes which form it is - somebody already serving gets
  /// five fields, not four steps. Asking first and then rebuilding the
  /// form underneath them would lose what they had typed.
  const [applyingAs, setApplyingAs] = useState<RegistrationType>("new_applicant");

  /// The ministry somebody has tapped "Already a Server" on, before
  /// they have confirmed it.
  ///
  /// Claiming a membership is a statement about yourself that the
  /// parish will take to a coordinator, and the button sits beside
  /// "Apply now" where a mis-tap is easy. Applying has no such step -
  /// a four-page form is its own confirmation - so this guards only
  /// the claim.
  const [claiming, setClaiming] = useState<{ id: string; name: string } | null>(null);

  /// The ministry somebody already in another ministry has tapped
  /// "Apply now" on, before they have confirmed it.
  ///
  /// A notice inside the form was not enough: by the time they read
  /// it they are already filling the thing in, and the question -
  /// "does this replace what I already have?" - is one they need
  /// answered BEFORE they start, not on the first page of four.
  const [confirmApply, setConfirmApply] =
    useState<{ id: string; name: string; warning: string } | null>(null);

  /// This pilgrim's approved memberships.
  ///
  /// Read here so a ministry they already belong to can say so instead
  /// of offering to let them join it again.
  const [memberships, setMemberships] = useState<MembershipDoc[]>([]);
  useEffect(() => {
    if (!uid) { setMemberships([]); return; }
    // Failures are silent on purpose: not knowing about a membership
    // costs a badge, and the submit path still enforces the rules. A
    // red box on the ministries list over it would be worse.
    return watchMyMemberships(uid, setMemberships, () => setMemberships([]));
  }, [uid]);

  /// What the pilgrim last sent, so the list can say so when they come
  /// back out of the application screen.
  const [submittedMinistry, setSubmittedMinistry] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const applyingTo = ministries.find(m => m.id === applyingToId) ?? null;

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
        registrationType={applyingAs}
        notice={uid ? alreadyMemberWarning(memberships, uid, applyingTo.id) : null}
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
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto scroll-safe">
      {confirmApply && (
        <ConfirmAnotherMinistry
          ministryName={confirmApply.name}
          warning={confirmApply.warning}
          onCancel={() => setConfirmApply(null)}
          onConfirm={() => {
            setApplyingToId(confirmApply.id);
            setApplyingAs("new_applicant");
            setIsSubmitted(false);
            setConfirmApply(null);
          }}
        />
      )}

      {claiming && (
        <ConfirmClaim
          ministryName={claiming.name}
          warning={uid ? alreadyMemberWarning(memberships, uid, claiming.id) : null}
          onCancel={() => setClaiming(null)}
          onConfirm={() => {
            setApplyingToId(claiming.id);
            setApplyingAs("existing_member");
            setIsSubmitted(false);
            setClaiming(null);
          }}
        />
      )}

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
            These are the ministries of <strong>{parishName}</strong>. Applying below sends your application to that parish office.
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
                {query.trim() ? `${matches.length} of ${ministries.length}` : ministries.length}
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
                      src={photoFor(min.id)}
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
            {(openId ? ministries.filter(m => m.id === openId) : []).map((min) => {
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
                      src={photoFor(min.id)}
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
                      {/* Closed today is not closed forever. Without
                          this the only way to find out ministry reopened
                          was to keep coming back and looking at the same
                          badge. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <AvailabilityBadge
                          open={isOpenForApplications(managed, min.id)}
                          kind="ministry"
                        />
                        {!isOpenForApplications(managed, min.id) && (
                          <WatchBell
                            watch={{ kind: "ministry", parishId: parish.id, itemId: min.id }}
                            label={min.name}
                          />
                        )}
                      </div>

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
                      {/* Already waiting on a decision.
                          Checked before the parish's own switch,
                          because this reason is about the pilgrim
                          rather than the ministry - and "not
                          available" would be the wrong sentence for
                          a ministry that is open and taking people. */}
                      {isOpenForApplications(managed, min.id) && openMinistryApplication ? (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            disabled
                            className="py-1.5 px-3 bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] text-[var(--color-brand-secondary)] text-sm font-bold uppercase tracking-wider rounded-full cursor-not-allowed"
                          >
                            Waiting on the parish
                          </button>
                          <p className="text-sm leading-relaxed text-[var(--color-brand-secondary)]">
                            {blockedMessage(openMinistryApplication.type)}
                          </p>
                        </div>
                      ) : uid && isMember(memberships, uid, min.id) ? (
                        /* Already in this one. Offering to let them
                           join it again would invite a duplicate
                           application the parish then has to decide
                           on. */
                        <div className="space-y-1.5">
                          <span className="inline-block py-1.5 px-3 bg-[var(--color-brand-gold)] text-white text-sm font-bold uppercase tracking-wider rounded-full">
                            Member
                          </span>
                          <p className="text-sm leading-relaxed text-[var(--color-brand-secondary)]">
                            The parish records you as serving in {min.name}.
                          </p>
                        </div>
                      ) : isOpenForApplications(managed, min.id) ? (
                        /* Two doors.
                           Somebody already serving is not applying -
                           they are telling the parish the records are
                           behind, and putting them through a
                           motivation letter and an availability grid
                           to do it is how a record stays wrong. */
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => {
                                // Somebody already serving elsewhere is
                                // asked first. Everybody else goes
                                // straight to the form - a dialog with
                                // nothing to warn about is a tap for
                                // its own sake.
                                const warning = uid
                                  ? alreadyMemberWarning(memberships, uid, min.id)
                                  : null;
                                if (warning) {
                                  setConfirmApply({ id: min.id, name: min.name, warning });
                                  return;
                                }
                                setApplyingToId(min.id);
                                setApplyingAs("new_applicant");
                                setIsSubmitted(false);
                              }}
                              className="py-1.5 px-3 bg-[var(--color-brand-primary)] text-white text-sm font-bold uppercase tracking-wider rounded-full hover:bg-[var(--color-brand-primary-dark)] transition-colors"
                            >
                              Apply now
                            </button>
                            <button
                              onClick={() => setClaiming({ id: min.id, name: min.name })}
                              className="py-1.5 px-3 bg-transparent border border-[var(--color-brand-border)] text-[var(--color-brand-text)] text-sm font-bold uppercase tracking-wider rounded-full hover:bg-[var(--color-brand-card-sunk)] transition-colors"
                            >
                              Already a Server
                            </button>
                          </div>
                          <p className="text-sm leading-relaxed text-[var(--color-brand-secondary)]">
                            Already serving in {min.name}? Use
                            <strong> Already a Server</strong> and the parish
                            will verify it with your coordinator.
                          </p>
                        </div>
                      ) : (
                        /* Closed, but only to new applicants.
                           A parish that has stopped taking people into
                           the choir has not stopped wanting to know who
                           is already in it - and somebody who has sung
                           there for ten years would otherwise be locked
                           out of correcting the records by a setting
                           that was never about them. */
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled
                              className="py-1.5 px-3 bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] text-[var(--color-brand-secondary)] text-sm font-bold uppercase tracking-wider rounded-full cursor-not-allowed"
                            >
                              Not available
                            </button>
                            <button
                              onClick={() => setClaiming({ id: min.id, name: min.name })}
                              className="py-1.5 px-3 bg-transparent border border-[var(--color-brand-border)] text-[var(--color-brand-text)] text-sm font-bold uppercase tracking-wider rounded-full hover:bg-[var(--color-brand-card-sunk)] transition-colors"
                            >
                              Already a Server
                            </button>
                          </div>
                          <p className="text-sm leading-relaxed text-[var(--color-brand-secondary)]">
                            {closedMessage("ministry", min.name)} If you already
                            serve in {min.name}, you can still tell the parish
                            so — they will verify it with your coordinator.
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

/**
 * The step before claiming a membership.
 *
 * ## Why this one and not "Apply now"
 *
 * Applying is four pages; nobody completes it by accident. Claiming a
 * membership is one tap on a button sitting beside Apply, and it is a
 * statement about yourself that a parish secretary will carry to a
 * coordinator. The cost of a mis-tap is somebody's time, so it gets a
 * sentence and a second tap.
 *
 * ## Why it says what happens next
 *
 * A warning that only warns makes people hesitate without telling them
 * what they are hesitating about. This one says who checks it, which
 * is both the reassurance for the honest case and the deterrent for
 * the careless one.
 */
function ConfirmClaim({ ministryName, warning, onCancel, onConfirm }: {
  ministryName: string;
  /**
   * The ministries they already serve in, if any. Shown here too:
   * claiming a second membership raises the same question as applying
   * for one, and the answer should not depend on which button they
   * happened to press.
   */
  warning?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Confirm that you already serve in ${ministryName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
    >
      <div className="w-full max-w-[400px] rounded-[22px] bg-[var(--color-brand-card)] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-brand-gold-deep)]" />
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold font-serif italic text-[var(--color-brand-text)]">
              Do you already serve here?
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
              This tells the parish you are already part of {ministryName}. They
              will check it with the coordinator you name, so only continue if
              you serve there now.
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
              If you would like to join instead, go back and use Apply now.
            </p>
            {warning && (
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
                {warning}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border-[1.5px] border-[var(--color-brand-border)] py-3 text-[15px] font-bold text-[var(--color-brand-text)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-[var(--color-brand-primary)] text-white py-3 text-[15px] font-bold"
          >
            Yes, I serve here
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The step before applying to a SECOND ministry.
 *
 * ## Why this is a dialog and not the notice inside the form
 *
 * The notice is still there, but it arrives too late to answer the
 * question somebody actually has: does applying here take away what I
 * already serve in? Asked on the first page of a four-page form, that
 * doubt either stops them or follows them all the way to submit.
 *
 * So it is answered before they start, in the one place they cannot
 * scroll past.
 *
 * ## Why it does not refuse
 *
 * The parish allows a pilgrim to serve in more than one ministry.
 * This is a check that they meant it, not a gate - which is why the
 * confirming button is the ordinary primary colour and not a warning
 * red.
 */
function ConfirmAnotherMinistry({ ministryName, warning, onCancel, onConfirm }: {
  ministryName: string;
  /** From alreadyMemberWarning(): names the ministries they are in. */
  warning: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`You are already in a ministry — confirm applying to ${ministryName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
    >
      <div className="w-full max-w-[400px] rounded-[22px] bg-[var(--color-brand-card)] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-brand-gold-deep)]" />
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold font-serif italic text-[var(--color-brand-text)]">
              You already serve in a ministry
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
              {warning}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
              Applying to {ministryName} is a new application. The parish will
              decide on it separately.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border-[1.5px] border-[var(--color-brand-border)] py-3 text-[15px] font-bold text-[var(--color-brand-text)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-[var(--color-brand-primary)] text-white py-3 text-[15px] font-bold"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
