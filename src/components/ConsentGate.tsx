import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, ShieldCheck } from "lucide-react";

import { needsConsent, saveConsent } from "../lib/consent";
import { LAST_UPDATED, PRIVACY, TERMS, type Doc } from "../lib/consentContent";

/**
 * The first thing the installed app shows, once.
 *
 * ## Why only in the installed app
 *
 * The browser is the parish's public site and a visitor there has not
 * installed anything, created anything or agreed to anything; stopping
 * them at a consent wall to read the house rules of an app they are
 * only looking at is the wrong place for it. The APK is where somebody
 * has deliberately taken the thing onto their phone, which is the
 * moment the terms are about.
 *
 * ## Why two checkboxes and not one
 *
 * Agreeing to the Terms and acknowledging the Privacy Notice are
 * different acts, and the Data Privacy Act treats them differently.
 * One box covering both would make it impossible to show afterwards
 * that the person was told how their data is handled as a separate
 * matter from accepting the rules of use.
 *
 * Neither box is a blanket consent to process personal data. Nothing
 * personal is collected until somebody signs in and applies for
 * something, and that is where the real purpose is explained.
 *
 * ## Why it does not block the app forever
 *
 * If storage refuses the write - private mode, a device clearing data
 * under pressure - the session continues and the screen simply appears
 * again next launch. Being unable to remember an answer is not a
 * reason to lock somebody out of their parish's Mass times.
 */
export default function ConsentGate({ children }: { children: ReactNode }) {
  // Read once. Re-reading on every render would send somebody back to
  // this screen the moment another tab cleared storage.
  const [outstanding, setOutstanding] = useState(needsConsent);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const scroller = useRef<HTMLDivElement | null>(null);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * Whether the whole thing has been scrolled through.
   *
   * ## Why both documents are on this one screen now
   *
   * They used to be summaries with a "Read in full" button that opened
   * each one as its own screen. Somebody could tick both boxes without
   * ever opening either, and gating the boxes on having opened them
   * only moved the problem: two more screens to visit, two more Done
   * buttons, and the agreement still happening somewhere other than
   * where the text was.
   *
   * So the text is here, in full, and the only way past it is through
   * it. One scroll, one place, nothing to open.
   *
   * ## The short-document case
   *
   * Content that fits the screen can never fire a scroll event, so
   * waiting for one would lock somebody out of the app permanently.
   * If there is nothing to scroll, it has been shown.
   *
   * ## Why zero height is not "nothing to scroll"
   *
   * Before layout both heights are 0, and 0 <= 0 + 1 is true - which
   * would unlock the button before a word had been painted. On a slow
   * handset that is exactly when this runs.
   */
  const check = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (el.scrollHeight === 0) return;

    const nothingToScroll = el.scrollHeight <= el.clientHeight + 1;
    // A tolerance: scrollTop is fractional on a high-density screen
    // and routinely lands a pixel or two short of the arithmetic
    // bottom, so an exact comparison never fires on a real phone.
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (nothingToScroll || reachedBottom) setAtEnd(true);
  }, []);

  useEffect(() => {
    if (!outstanding) return;
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [outstanding, check]);

  if (!outstanding) return <>{children}</>;

  const ready = atEnd && terms && privacy;

  return (
    <div className="consent" ref={scroller} onScroll={check}>
      <div className="consent__sheet">
        <img
          className="consent__mark"
          src="/ui/sanctiwalk-mark-navy.png"
          alt=""
          aria-hidden
        />

        <h1 className="consent__title">Welcome to SanctiWalk</h1>
        <p className="consent__lede">
          Your companion for Mary Help of Christians Parish and San Roque
          Cathedral Parish. Please read these two notices before you begin —
          scroll to the end to continue.
        </p>

        <FullText icon={<FileText className="w-[18px] h-[18px]" aria-hidden />} doc={TERMS} />
        <FullText icon={<ShieldCheck className="w-[18px] h-[18px]" aria-hidden />} doc={PRIVACY} />

        <label className="consent__check">
          <input
            type="checkbox"
            checked={terms}
            onChange={e => setTerms(e.target.checked)}
          />
          <span>I have read and agree to the Terms and Conditions.</span>
        </label>

        <label className="consent__check">
          <input
            type="checkbox"
            checked={privacy}
            onChange={e => setPrivacy(e.target.checked)}
          />
          <span>I have read and understood the Privacy Notice.</span>
        </label>

        <button
          type="button"
          className="consent__go"
          disabled={!ready}
          onClick={() => {
            saveConsent(true, true);
            setOutstanding(false);
          }}
        >
          {atEnd ? "Continue" : "Scroll to the end to continue"}
        </button>

        <p className="consent__foot">
          You can use SanctiWalk without an account. You only need to sign in
          to apply for a ministry or a sacrament. Last updated {LAST_UPDATED}.
        </p>
      </div>
    </div>
  );
}

/**
 * One document, in full, on the consent screen itself.
 *
 * Replaces the summary card and its "Read in full" button. The whole
 * point of this screen is that the text was read, and text behind a
 * button is text nobody read.
 */
function FullText({ icon, doc }: { icon: ReactNode; doc: Doc }) {
  return (
    <section className="consent__card">
      <h2 className="consent__card-title">
        <span className="consent__card-icon" aria-hidden>{icon}</span>
        {doc.title}
      </h2>

      {doc.sections.map(section => (
        <div key={section.heading} className="consent__section">
          <h3 className="consent__heading">{section.heading}</h3>
          {section.body.map(para => (
            <p key={para} className="consent__para">{para}</p>
          ))}
        </div>
      ))}
    </section>
  );
}
