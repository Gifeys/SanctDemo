import React, { useState } from "react";
import { MINISTRIES, Ministry } from "../data";
import { Users, ChevronDown, ChevronUp, Check, CheckCircle, Sparkles, AlertCircle } from "lucide-react";

interface MinistriesTabProps {
  onAddApplication: (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => void;
}

export default function MinistriesTab({ onAddApplication }: MinistriesTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("min-socom");
  
  // Application Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !email) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    const targetMin = MINISTRIES.find(m => m.id === selectedMinistryId);
    
    // Create simulated application log
    const newApp = {
      id: "app-" + Date.now(),
      type: "Ministry Application",
      applicant: fullName,
      details: `${targetMin?.name || "SOCOM"} (Tel: ${phone}, Email: ${email}) - Note: ${message || "No notes"}`,
      date: new Date().toLocaleDateString(),
      status: "Awaiting Interview"
    };

    onAddApplication(newApp);
    setIsSubmitted(true);
    setErrorMsg("");
    
    // Clear form
    setFullName("");
    setPhone("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Users className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Serve and Volunteer
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Parish Ministries
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            "Go into the world and preach the Gospel." Join our lay ministries to serve the parish community.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Ministries List Accordion */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest font-serif italic pl-1">
            Available Ministries
          </h3>

          <div className="space-y-2">
            {MINISTRIES.map((min) => {
              const isExpanded = expandedId === min.id;
              return (
                <div
                  key={min.id}
                  className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden shadow-xs transition-all"
                >
                  <button
                    onClick={() => toggleExpand(min.id)}
                    className="w-full p-4 flex items-center justify-between text-left select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[#4A4A35] font-serif italic">
                        {min.name}
                      </h4>
                      <p className="text-[10px] text-[#8A8A70] line-clamp-1 font-sans mt-0.5">
                        {min.description}
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
                        {min.description}
                      </p>
                      
                      <div className="space-y-1.5">
                        <h5 className="text-[9px] font-bold text-[#8A8A70] uppercase tracking-wider">
                          Requirements to Join:
                        </h5>
                        <ul className="space-y-1 text-xs text-[#33332D]">
                          {min.requirements.map((req, idx) => (
                            <li key={idx} className="flex gap-2 items-center text-[11px]">
                              <Check className="w-3.5 h-3.5 text-green-700 shrink-0" />
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedMinistryId(min.id);
                          setIsSubmitted(false);
                          const element = document.getElementById("application-form");
                          element?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="py-1.5 px-3 bg-[#5A5A40] text-white text-[10px] font-bold uppercase tracking-wider rounded-full hover:bg-[#4A4A35] transition-colors"
                      >
                        Apply for this Guild
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Application Form Section */}
        <div id="application-form" className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/45 pb-1.5">
            Submit Ministry Application
          </h3>

          {isSubmitted ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-green-700 mx-auto" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-green-900 font-serif italic">Application Filed Successfully!</h4>
                <p className="text-[11px] text-green-800 leading-relaxed font-sans">
                  Your volunteer profile has been sent to Father Paul Woo and the parish panel. A SOCOM coordinator will contact you shortly for an interview.
                </p>
              </div>
              <button
                onClick={() => setIsSubmitted(false)}
                className="mt-1.5 text-[10px] bg-[#5A5A40] text-white px-3 py-1 rounded-full font-bold uppercase tracking-wide"
              >
                Apply for Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleApply} className="space-y-2.5 text-xs">
              {errorMsg && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-[10px] font-bold">{errorMsg}</span>
                </div>
              )}

              {/* Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Select Target Ministry
                </label>
                <select
                  value={selectedMinistryId}
                  onChange={(e) => setSelectedMinistryId(e.target.value)}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2 font-bold font-serif italic text-xs outline-none"
                >
                  {MINISTRIES.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Juan dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D]"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                    Mobile No.
                  </label>
                  <input
                    type="tel"
                    placeholder="0917-XXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="juan@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D]"
                  />
                </div>
              </div>

              {/* Cover Letter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Why do you wish to join?
                </label>
                <textarea
                  rows={2}
                  placeholder="I want to offer my talents for social media live streaming..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-xs outline-none text-[#33332D] font-sans resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-[11px] font-bold uppercase tracking-wider rounded-full border border-[#4A4A35] shadow-xs"
              >
                Submit Volunteer Registration
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
