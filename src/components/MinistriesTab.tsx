import React, { useState } from "react";
import { MINISTRIES } from "../data";
import { Users, ChevronDown, ChevronUp, Check, CheckCircle, Sparkles, AlertCircle, Info, X } from "lucide-react";
import { Route } from "../types";
import { buildMinistryApplication, type MinistryApplicationDoc } from "../lib/ministryApplication";

interface MinistriesTabProps {
  parish: Route;
  onAddApplication: (app: MinistryApplicationDoc) => void;
  /** The signed-in pilgrim's uid, or null when signed out. */
  uid: string | null;
  /** Their account email. The form never asks for what the account knows. */
  userEmail: string;
  onOpenSignIn: () => void;
}

export default function MinistriesTab({ parish, onAddApplication, uid, userEmail, onOpenSignIn }: MinistriesTabProps) {
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // No ministry until one is chosen. The form used to sit at the bottom of
  // the page permanently, with its own "select target ministry" dropdown -
  // so the page asked which ministry twice, once by tapping Apply and again
  // in the form. Now Apply is what opens the form, and the ministry is the
  // one whose card was tapped.
  const [applyingToId, setApplyingToId] = useState<string | null>(null);

  // Application Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedMinistry, setSubmittedMinistry] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  const applyingTo = MINISTRIES.find(m => m.id === applyingToId) ?? null;

  const closeForm = () => {
    setApplyingToId(null);
    setErrorMsg("");
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingTo) return;

    if (!uid) {
      // The Firestore rules require an owning uid, and My Application has
      // nowhere to appear without an account.
      setErrorMsg("Please sign in first, so the parish can reply to you and you can follow your application.");
      return;
    }
    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!userEmail) {
      setErrorMsg("Your account has no email address, so the parish would have no way to reply.");
      return;
    }
    if (!consent) {
      setErrorMsg("Please agree to be contacted about your application.");
      return;
    }

    onAddApplication(
      buildMinistryApplication({
        uid,
        fullName,
        email: userEmail,
        mobile: phone,
        ministryId: applyingTo.id,
        ministryName: applyingTo.name,
        // Taken from the dashboard the pilgrim is already inside, never
        // asked for again.
        parishId: parish.id,
        parishName,
        message,
        consent,
      }),
    );

    setSubmittedMinistry(applyingTo.name);
    setIsSubmitted(true);
    setErrorMsg("");
    setApplyingToId(null);

    setFullName("");
    setPhone("");
    setMessage("");
    setConsent(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[var(--color-brand-border)]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Users className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[var(--color-brand-on-accent)] font-bold text-[15px] tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Serve and Volunteer
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Parish Ministries
          </h2>
          <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            "Go into the world and preach the Gospel." Join our lay ministries to serve the parish community.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* These ministry types are the same across the diocese — this is
            not {parishName}'s own private list, and the app should say so
            rather than implying otherwise. */}
        <div className="flex items-start gap-2 p-3 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl">
          <Info className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0 mt-0.5" />
          <p className="text-[15px] text-[var(--color-brand-text)] font-sans leading-snug">
            These ministries are offered diocese-wide. Applying below will route your application to <strong>{parishName}</strong>, your current parish.
          </p>
        </div>

        {/* Ministries List Accordion */}
        <div className="space-y-2.5">
          <h3 className="text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest font-serif italic pl-1">
            Available Ministries
          </h3>

          <div className="space-y-2">
            {MINISTRIES.map((min) => {
              const isExpanded = expandedId === min.id;
              return (
                <div
                  key={min.id}
                  className="bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] overflow-hidden shadow-xs transition-all"
                >
                  <button
                    onClick={() => toggleExpand(min.id)}
                    className="w-full p-4 flex items-center justify-between text-left select-none"
                  >
                    <div>
                      <h4 className="text-[15px] font-bold text-[var(--color-brand-text)] font-serif italic">
                        {min.name}
                      </h4>
                      <p className="text-sm text-[var(--color-brand-secondary)] line-clamp-1 font-sans mt-0.5">
                        {min.description}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--color-brand-secondary)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--color-brand-secondary)]" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[var(--color-brand-card)] bg-[var(--color-brand-card)]/30 space-y-3 font-sans">
                      <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed">
                        {min.description}
                      </p>
                      
                      <div className="space-y-1.5">
                        <h5 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider">
                          Requirements to Join:
                        </h5>
                        <ul className="space-y-1 text-[15px] text-[var(--color-brand-text)]">
                          {min.requirements.map((req, idx) => (
                            <li key={idx} className="flex gap-2 items-center text-[15px]">
                              <Check className="w-3.5 h-3.5 text-green-700 shrink-0" />
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => {
                          setApplyingToId(min.id);
                          setIsSubmitted(false);
                          setErrorMsg("");
                          // The form is rendered directly under this card,
                          // so there is nothing to scroll to - it appears
                          // where the pilgrim is already looking.
                        }}
                        className="py-1.5 px-3 bg-[var(--color-brand-primary)] text-white text-sm font-bold uppercase tracking-wider rounded-full hover:bg-[var(--color-brand-primary-dark)] transition-colors"
                      >
                        Apply
                      </button>

                      {/* The form for THIS ministry, opened by the button
                          above. Nothing asks which ministry, and nothing
                          asks which parish: tapping Apply answered the
                          first and the dashboard answers the second. */}
                      {applyingToId === min.id && (
                        <form
                          onSubmit={handleApply}
                          className="mt-3 pt-3 border-t border-[var(--color-brand-border)] space-y-2.5 text-[15px]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-[15px] font-bold text-[var(--color-brand-text)] font-serif italic">
                                Apply to {min.name}
                              </h5>
                              <p className="text-sm text-[var(--color-brand-secondary)]">
                                {parishName}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={closeForm}
                              aria-label="Cancel this application"
                              className="p-1 text-[var(--color-brand-secondary)] shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {errorMsg && (
                            <div className="p-2 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                              <span className="text-sm font-bold">{errorMsg}</span>
                            </div>
                          )}

                          {!uid && (
                            <button
                              type="button"
                              onClick={onOpenSignIn}
                              className="w-full p-2.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl text-left text-sm font-semibold text-[var(--color-brand-text)]"
                            >
                              Sign in first &mdash; the parish replies by email, and your
                              application appears under Me so you can follow it.
                            </button>
                          )}

                          <div className="space-y-1">
                            <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              placeholder="Juan dela Cruz"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] outline-none text-[var(--color-brand-text)]"
                            />
                          </div>

                          {/* Shown, not asked. The account already has it,
                              and it is what the coordinator will reply to. */}
                          <div className="space-y-1">
                            <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                              Email Address *
                            </label>
                            <p className="w-full bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] text-[var(--color-brand-text)] break-all">
                              {userEmail || "Sign in to use your account email"}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                              Mobile Number
                            </label>
                            <input
                              type="tel"
                              placeholder="0917-XXXXXXX"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] outline-none text-[var(--color-brand-text)]"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                              Why would you like to join this ministry?
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Optional"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] outline-none text-[var(--color-brand-text)] font-sans resize-none"
                            />
                          </div>

                          <label className="flex items-start gap-2 text-[15px] text-[var(--color-brand-text)] font-sans">
                            <input
                              type="checkbox"
                              checked={consent}
                              onChange={(e) => setConsent(e.target.checked)}
                              className="mt-1 shrink-0"
                            />
                            <span>I agree to be contacted regarding my ministry application.</span>
                          </label>

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-[15px] font-bold uppercase tracking-wider rounded-full border border-[var(--color-brand-primary-dark)] shadow-xs"
                          >
                            Submit Application
                          </button>
                        </form>
                      )}
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
