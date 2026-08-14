import React, { useState } from "react";
import { SACRAMENTS, Sacrament } from "../data";
import { Sparkles, Calendar, BookOpen, ChevronDown, ChevronUp, Check, CheckCircle, AlertCircle, Bookmark } from "lucide-react";

interface SacramentsTabProps {
  onAddApplication: (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => void;
}

export default function SacramentsTab({ onAddApplication }: SacramentsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Bookmark className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Holy Sacraments
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Sacraments Office
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Review canonical guidelines, prepare documents, and schedule holy sacraments for your family.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Sacraments Guide Accordion */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest font-serif italic pl-1">
            Canonical Requirements
          </h3>

          <div className="space-y-2">
            {SACRAMENTS.map((sac) => {
              const isExpanded = expandedId === sac.id;
              return (
                <div
                  key={sac.id}
                  className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden shadow-xs transition-all"
                >
                  <button
                    onClick={() => toggleExpand(sac.id)}
                    className="w-full p-4 flex items-center justify-between text-left select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[#4A4A35] font-serif italic">
                        {sac.name}
                      </h4>
                      <p className="text-[10px] text-[#8A8A70] line-clamp-1 font-sans mt-0.5">
                        {sac.description}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#5A5A40]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8A8A70]" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[#F5F5F0] bg-[#F5F5F0]/30 space-y-3 font-sans">
                      <p className="text-xs text-[#33332D] leading-relaxed">
                        {sac.description}
                      </p>

                      <div className="p-2.5 bg-[#EBEBE0]/40 rounded-xl border border-[#D6D6C2]/40 text-[11px]">
                        <span className="font-bold text-[#5A5A40] block font-serif italic">Parish Schedule:</span>
                        <span className="text-[#33332D]">{sac.scheduleDetails}</span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <h5 className="text-[9px] font-bold text-[#8A8A70] uppercase tracking-wider">
                          Required Documents to Submit:
                        </h5>
                        <ul className="space-y-1 text-xs text-[#33332D]">
                          {sac.requirements.map((req, idx) => (
                            <li key={idx} className="flex gap-2 items-center text-[11px]">
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
                        className="py-1.5 px-3 bg-[#5A5A40] text-white text-[10px] font-bold uppercase tracking-wider rounded-full hover:bg-[#4A4A35] transition-colors"
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
        <div id="booking-form" className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/45 pb-1.5">
            Pre-Schedule Sacrament
          </h3>

          {isBooked ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-amber-700 mx-auto" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-amber-900 font-serif italic">Pre-Booking Submitted!</h4>
                <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                  Your reservation request has been logged! Please bring the physical documents to our Maypajo Parish Office for verification and canonical approval.
                </p>
              </div>
              <button
                onClick={() => setIsBooked(false)}
                className="mt-1.5 text-[10px] bg-[#5A5A40] text-white px-3 py-1 rounded-full font-bold uppercase tracking-wide"
              >
                Schedule Another Sacrament
              </button>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="space-y-2.5 text-xs">
              {errorMsg && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-[10px] font-bold">{errorMsg}</span>
                </div>
              )}

              {/* Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Select Sacrament
                </label>
                <select
                  value={selectedSacramentId}
                  onChange={(e) => {
                    setSelectedSacramentId(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2 font-bold font-serif italic text-xs outline-none"
                >
                  {SACRAMENTS.map(s => (
                    <option key={s.id} value={s.id}>{m => m.name} {s.name}</option>
                  ))}
                </select>
              </div>

              {/* Applicant Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Applicant's Full Name
                </label>
                <input
                  type="text"
                  placeholder="Name of child / couple / baptismal candidate"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D]"
                />
              </div>

              {/* Target Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Desired Date of Sacrament
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D]"
                />
              </div>

              {/* Parent/Sponsor Information */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Parent / Primary Sponsor Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Primary parent or key sponsor name"
                  value={parentOrSponsor}
                  onChange={(e) => setParentOrSponsor(e.target.value)}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D]"
                />
              </div>

              {/* Document Checklist Validation */}
              <div className="space-y-1.5 pt-1.5 border-t border-[#F5F5F0]">
                <span className="text-[10px] font-bold text-[#8A8A70] uppercase tracking-wider">
                  Document Readiness:
                </span>
                
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-[11px] text-[#33332D] select-none">
                    <input
                      type="checkbox"
                      checked={hasPSA}
                      onChange={(e) => setHasPSA(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-[#5A5A40]"
                    />
                    <span>I have prepared the official PSA Birth Certificate</span>
                  </label>

                  {(selectedSacramentId === "sac-matrimony" || selectedSacramentId === "sac-confirmation") && (
                    <label className="flex items-center gap-2 text-[11px] text-[#33332D] select-none">
                      <input
                        type="checkbox"
                        checked={hasBaptismal}
                        onChange={(e) => setHasBaptismal(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[#5A5A40]"
                      />
                      <span>I have prepared the Catholic Baptismal Certificate</span>
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-1.5 py-2.5 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-[11px] font-bold uppercase tracking-wider rounded-full border border-[#4A4A35] shadow-xs"
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
