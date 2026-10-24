import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, FileText, ShieldCheck } from "lucide-react";

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
  const [reading, setReading] = useState<Doc | null>(null);

  if (!outstanding) return <>{children}</>;

  if (reading) {
    return <FullDocument doc={reading} onBack={() => setReading(null)} />;
  }

  const ready = terms && privacy;

  return (
    <div className="consent">
      <div className="consent__sheet">
        <img
          className="consent__mark"
          src="/ui/sanctiwalk-icon-512.png"
          alt=""
          aria-hidden
        />

        <h1 className="consent__title">Welcome to SanctiWalk</h1>
        <p className="consent__lede">
          Your companion for Mary Help of Christians Parish and San Roque
          Cathedral Parish. Before you begin, please read these two short
          notices.
        </p>

        <Card
          icon={<FileText className="w-[18px] h-[18px]" aria-hidden />}
          doc={TERMS}
          onRead={() => setReading(TERMS)}
        />
        <Card
          icon={<ShieldCheck className="w-[18px] h-[18px]" aria-hidden />}
          doc={PRIVACY}
          onRead={() => setReading(PRIVACY)}
        />

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
          Continue
        </button>

        <p className="consent__foot">
          You can use SanctiWalk without an account. You only need to sign in
          to apply for a ministry or a sacrament. Last updated {LAST_UPDATED}.
        </p>
      </div>
    </div>
  );
}

function Card({
  icon,
  doc,
  onRead,
}: {
  icon: ReactNode;
  doc: Doc;
  onRead: () => void;
}) {
  return (
    <section className="consent__card">
      <h2 className="consent__card-title">
        {icon}
        {doc.title}
      </h2>
      {doc.summary.map(line => (
        <p key={line} className="consent__card-line">
          {line}
        </p>
      ))}
      <button type="button" className="consent__read" onClick={onRead}>
        Read in full
      </button>
    </section>
  );
}

/**
 * One document, in full.
 *
 * A screen rather than a scrolling box inside the card: the summary
 * stays short enough to actually be read, and anybody who wants the
 * whole thing gets it with room to read it.
 */
function FullDocument({ doc, onBack }: { doc: Doc; onBack: () => void }) {
  return (
    <div className="consent consent--doc">
      <div className="consent__sheet">
        <button type="button" className="consent__back" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back
        </button>

        <h1 className="consent__title">{doc.title}</h1>
        <p className="consent__updated">Last updated {LAST_UPDATED}</p>

        {doc.sections.map(section => (
          <section key={section.heading} className="consent__section">
            <h2 className="consent__heading">{section.heading}</h2>
            {section.body.map(para => (
              <p key={para} className="consent__para">
                {para}
              </p>
            ))}
          </section>
        ))}

        <button type="button" className="consent__go" onClick={onBack}>
          <Check className="w-4 h-4" aria-hidden />
          Done
        </button>
      </div>
    </div>
  );
}
