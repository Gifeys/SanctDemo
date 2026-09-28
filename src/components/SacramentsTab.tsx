import React, { useState } from "react";
import ParishSectionHeader from "./ParishSectionHeader";
import { SACRAMENTS, SACRAMENT_IMAGES } from "../data";
import { Sparkles, Calendar, BookOpen, ChevronDown, ChevronUp, Check, CheckCircle, AlertCircle, Bookmark, Info, ArrowLeft, ChevronRight } from "lucide-react";
import { Route } from "../types";

interface SacramentsTabProps {
  parish: Route;
  onAddApplication: (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => void;
}

/** Stands in until the parish photographs each sacrament. */
const PLACEHOLDER_SACRAMENT = "/parish/placeholder-photo.svg";

export default function SacramentsTab({ parish, onAddApplication }: SacramentsTabProps) {
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /// Which sacrament has the whole screen, or null for the list. The same
  /// split as Ministries: a sacrament is either one of several being browsed
  /// or the only thing on the page, and the old accordion made every row
  /// grow downwards while you were reading it.
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedSacramentId, setSelectedSacramentId] = useState<string>("sac-baptism");
  
  // Booking Form State
  const [applicantName, setApplicantName] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [parentOrSponsor, setParentOrSponsor] = useState("");
  const [hasPSA, setHasPSA] = useState(false);
  const [hasBaptismal, setHasBaptismal] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !bookingDate) {
      setErrorMsg("Please fill in the Applicant Name and select a Date.");
      return;
    }

    const targetSac = SACRAMENTS.find(s => s.id === selectedSacramentId);
    
    // Check specific checkbox requirements depending on sacrament type
    if (selectedSacramentId === "sac-baptism" && !hasPSA) {
      setErrorMsg("Please confirm that you have prepared the PSA Birth Certificate copy.");
      return;
    }
    if (selectedSacramentId === "sac-matrimony" && (!hasPSA || !hasBaptismal)) {
      setErrorMsg("Holy Matrimony requires preparing both PSA Birth Certificates and Baptismal annotations.");
      return;
    }

    // Create booking record
    const newBooking = {
      id: "sac-" + Date.now(),
      type: "Sacrament Booking",
      applicant: applicantName,
      details: `${targetSac?.name || "Baptism"} - Scheduled Date: ${bookingDate} (Sponsor/Parent: ${parentOrSponsor || "None specified"})`,
      date: new Date().toLocaleDateString(),
      status: "Awaiting Parish Interview"
    };

    onAddApplication(newBooking);
    setIsBooked(true);
    setErrorMsg("");

    // Clear form
    setApplicantName("");
    setBookingDate("");
    setParentOrSponsor("");
    setHasPSA(false);
    setHasBaptismal(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      <div hidden={openId !== null}>
      <ParishSectionHeader
        routeId={parish.id}
        eyebrow="Holy Sacraments"
        title="Sacraments Office"
        blurb="Review the guidelines, prepare the documents, and arrange a sacrament with the parish."
        icon={<Sparkles className="w-3.5 h-3.5" />}
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
                className="ministry-card"
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
                      <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed">
                        {sac.description}
                      </p>

                      <div className="p-2.5 bg-[var(--color-brand-card)]/40 rounded-xl border border-[var(--color-brand-border)]/40 text-[15px]">
                        <span className="font-bold text-[var(--color-brand-secondary)] block font-serif italic">Parish Schedule:</span>
                        <span className="text-[var(--color-brand-text)]">{sac.scheduleDetails}</span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <h5 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider">
                          Required Documents to Submit:
                        </h5>
                        <ul className="space-y-1 text-[15px] text-[var(--color-brand-text)]">
                          {sac.requirements.map((req, idx) => (
                            <li key={idx} className="flex gap-2 items-center text-[15px]">
                              <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSacramentId(sac.id);
                          setIsBooked(false);
                          const element = document.getElementById("booking-form");
                          element?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="py-1.5 px-3 bg-[var(--color-brand-primary)] text-white text-sm font-bold uppercase tracking-wider rounded-full hover:bg-[var(--color-brand-primary-dark)] transition-colors"
                      >
                        Schedule / Book Now
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Booking Form Section */}
        <div id="booking-form" className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-4 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[var(--color-brand-text)] font-serif italic border-b border-[var(--color-brand-border)]/45 pb-1.5">
            Pre-Schedule Sacrament
          </h3>

          {isBooked ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-amber-700 mx-auto" />
              <div className="space-y-0.5">
                <h4 className="text-[15px] font-bold text-amber-900 font-serif italic">Pre-Booking Submitted!</h4>
                <p className="text-[15px] text-amber-800 leading-relaxed font-sans">
                  Your reservation request has been logged! Please bring the physical documents to the {parishName} Parish Office for verification and canonical approval.
                </p>
              </div>
              <button
                onClick={() => setIsBooked(false)}
                className="mt-1.5 text-sm bg-[var(--color-brand-primary)] text-white px-3 py-1 rounded-full font-bold uppercase tracking-wide"
              >
                Schedule Another Sacrament
              </button>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="space-y-2.5 text-[15px]">
              {errorMsg && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-sm font-bold">{errorMsg}</span>
                </div>
              )}

              {/* Selection */}
              <div className="space-y-1">
                <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                  Select Sacrament
                </label>
                <select
                  value={selectedSacramentId}
                  onChange={(e) => {
                    setSelectedSacramentId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2 font-bold font-serif italic text-[15px] outline-none"
                >
                  {SACRAMENTS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Applicant Name */}
              <div className="space-y-1">
                <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                  Applicant's Full Name
                </label>
                <input
                  type="text"
                  placeholder="Name of child / couple / baptismal candidate"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] outline-none text-[var(--color-brand-text)]"
                />
              </div>

              {/* Target Date */}
              <div className="space-y-1">
                <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                  Desired Date of Sacrament
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] outline-none text-[var(--color-brand-text)]"
                />
              </div>

              {/* Parent/Sponsor Information */}
              <div className="space-y-1">
                <label className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                  Parent / Primary Sponsor Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Primary parent or key sponsor name"
                  value={parentOrSponsor}
                  onChange={(e) => setParentOrSponsor(e.target.value)}
                  className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-xl p-2.5 text-[15px] outline-none text-[var(--color-brand-text)]"
                />
              </div>

              {/* Document Checklist Validation */}
              <div className="space-y-1.5 pt-1.5 border-t border-[var(--color-brand-card)]">
                <span className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider">
                  Document Readiness:
                </span>
                
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-[15px] text-[var(--color-brand-text)] select-none">
                    <input
                      type="checkbox"
                      checked={hasPSA}
                      onChange={(e) => setHasPSA(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-[var(--color-brand-primary)]"
                    />
                    <span>I have prepared the official PSA Birth Certificate</span>
                  </label>

                  {(selectedSacramentId === "sac-matrimony" || selectedSacramentId === "sac-confirmation") && (
                    <label className="flex items-center gap-2 text-[15px] text-[var(--color-brand-text)] select-none">
                      <input
                        type="checkbox"
                        checked={hasBaptismal}
                        onChange={(e) => setHasBaptismal(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[var(--color-brand-primary)]"
                      />
                      <span>I have prepared the Catholic Baptismal Certificate</span>
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-1.5 py-2.5 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-[15px] font-bold uppercase tracking-wider rounded-full border border-[var(--color-brand-primary-dark)] shadow-xs"
              >
                File Sacrament Request Form
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
