import React from "react";
import { Clock, Phone, Mail, MapPin, Calendar, Sparkles } from "lucide-react";

export default function MassSchedule() {
  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Clock className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Liturgical Hours
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Mass & Sacraments
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Plan your visitation and sacramental prayers around our daily liturgical schedule.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Schedule Card */}
        <div className="bg-white rounded-3xl border border-[#D6D6C2] overflow-hidden shadow-xs p-5 space-y-4">
          {/* Altar Photo representation */}
          <div className="rounded-2xl overflow-hidden h-28 border border-[#D6D6C2]/40 relative">
            <img
              src="https://images.unsplash.com/photo-1478147427282-58a87a120781?auto=format&fit=crop&w=800&q=80"
              alt="Maypajo Altar"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="text-white text-xs font-bold font-serif italic tracking-wider text-center uppercase px-4">
                Mary Help of Christians Parish
              </span>
            </div>
          </div>

          <h3 className="text-base font-bold text-center text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/45 pb-1.5">
            Holy Mass Schedule
          </h3>

          <div className="space-y-3 font-sans">
            {/* Monday & Tuesday */}
            <div className="flex justify-between items-center p-2.5 bg-[#F5F5F0]/60 rounded-xl border border-[#D6D6C2]/30">
              <span className="text-xs font-bold text-[#4A4A35]">Monday & Tuesday</span>
              <span className="text-xs font-mono font-bold text-[#33332D]">6:00 AM</span>
            </div>

            {/* Wednesday - Saturday */}
            <div className="flex justify-between items-center p-2.5 bg-[#F5F5F0]/60 rounded-xl border border-[#D6D6C2]/30">
              <span className="text-xs font-bold text-[#4A4A35]">Wednesday - Saturday</span>
              <span className="text-xs font-mono font-bold text-[#33332D]">6:00 AM / 6:00 PM</span>
            </div>

            {/* Sunday */}
            <div className="p-2.5 bg-[#EBEBE0]/50 rounded-xl border border-[#D6D6C2]/60 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#5A5A40]">Sunday Masses</span>
                <span className="text-[9px] bg-[#5A5A40] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Lord's Day
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono font-bold text-[#33332D] pt-1">
                <div className="p-1.5 bg-white rounded border border-[#D6D6C2]/40">6:00 AM</div>
                <div className="p-1.5 bg-white rounded border border-[#D6D6C2]/40">7:30 AM</div>
                <div className="p-1.5 bg-white rounded border border-[#D6D6C2]/40">9:00 AM</div>
                <div className="p-1.5 bg-white rounded border border-[#D6D6C2]/40">10:30 AM</div>
                <div className="p-1.5 bg-white rounded border border-[#D6D6C2]/40">4:30 PM</div>
                <div className="p-1.5 bg-white rounded border border-[#D6D6C2]/40">6:00 PM</div>
              </div>
            </div>
          </div>

          {/* Confessions block */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
            <h4 className="text-xs font-bold text-amber-800 font-serif italic">
              Sacrament of Reconciliation
            </h4>
            <p className="text-[11px] text-amber-900 leading-normal font-sans">
              Confessions are available every first Friday of the month, or you can inquire at the Parish office to request an advanced schedule with our priest.
            </p>
          </div>
        </div>

        {/* Parish info card */}
        <div className="p-4 bg-[#EBEBE0]/30 rounded-3xl border border-[#D6D6C2] space-y-2 text-xs text-[#33332D]">
          <h4 className="font-bold text-[#4A4A35] font-serif italic uppercase tracking-wider text-[10px] flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> Contact & Administration
          </h4>
          
          <div className="space-y-1.5 font-sans text-[#5A5A40] font-medium pl-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>J.P Rizal Street, Maypajo, Caloocan City</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>(8) 288-7482 / 0945 253 5329</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="break-all">maryhelpofchristians@dioceseofkalookan.ph</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
