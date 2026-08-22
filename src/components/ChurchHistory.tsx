import React from "react";
import { BookOpen, Sparkles, Compass, History } from "lucide-react";
import { Route } from "../types";

interface ParishHistoryContent {
  photo: string;
  photoAlt: string;
  badge: string;
  historyHeading: string;
  historyParagraphs: string[];
  patronHeading: string;
  patronParagraphs: string[];
}

// Real parish-specific history text, keyed by route id. Both of these came
// from the diocese's own material — nothing here is invented. A parish with
// no entry falls back to the honest "not yet documented" card below rather
// than showing either of these.
const PARISH_HISTORY: Record<string, ParishHistoryContent> = {
  "route-mhcp": {
    photo: "https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg",
    photoAlt: "Mary Help of Christians Maypajo",
    badge: "Maypajo, Caloocan",
    historyHeading: "Brief History",
    historyParagraphs: [
      "Mary Help of Christians Parish in Maypajo, Caloocan City was established in 1952 to serve the rapidly expanding population of Southern Caloocan and to provide a sacred sanctuary dedicated to Marian devotion. Under the zealous pastoral leadership of the parish priests and active community builders, it grew from a simple chapel of wood and nipa into a beautiful parish that stands as a beacon of Christian faith and Salesian spirit.",
      "Over the decades, the parish has nurtured thousands of families, active lay organizations, and youth ministries, becoming a vital hub for prayer, catechesis, sacraments, and social services.",
    ],
    patronHeading: "Patroness: Maria Auxiliadora",
    patronParagraphs: [
      "The beloved patroness is the Blessed Virgin Mary under the title Mary, Help of Christians (Maria Auxiliadora). This title highlights her powerful maternal role as a helper, protector, and defender of Christians in times of severe trial, hardship, or spiritual battle.",
      "Venerated highly within the Salesian family of St. John Bosco, her image depicts her holding the Child Jesus with both arms open, inviting the faithful to surrender their cares, seek grace, and find victory over life's daily storms through Christ.",
    ],
  },
  "route-src": {
    photo: "https://images.unsplash.com/photo-1590076241314-e2c7c724490d?auto=format&fit=crop&w=800&q=80",
    photoAlt: "San Roque Cathedral Caloocan",
    badge: "Diocese of Kalookan",
    historyHeading: "Historical Milestones",
    historyParagraphs: [
      "The historic San Roque Cathedral was originally founded as a parish in 1815 under the Archdiocese of Manila. The church stood witness to the turbulent days of the Philippine Revolution, serving as a military post and safe haven for local revolutionaries. It was repeatedly damaged during wars but rose each time through the absolute devotion of the Caloocan parishioners.",
      "In 2003, His Holiness Pope John Paul II established the Diocese of Kalookan, and San Roque Parish was officially elevated to the dignity of a Cathedral, serving as the central seat of the Bishop, guiding the spiritual flock of Caloocan, Malabon, and Navotas.",
    ],
    patronHeading: "Patron: San Roque (Saint Roch)",
    patronParagraphs: [
      "The Cathedral is named in honor of San Roque (Saint Roch), a 14th-century lay saint who traveled across Europe nursing patients afflicted with the horrific bubonic plague. He is depicted pointing to a plague sore on his thigh, flanked by his faithful dog who brought him daily loaves of bread when he was isolated in the forest.",
      "San Roque is beloved as the patron saint of the sick, plague victims, healthcare workers, and epidemics, standing as a testament of pure Christian charity, selfless volunteerism, and healing.",
    ],
  },
};

interface ChurchHistoryProps {
  parish: Route;
}

export default function ChurchHistory({ parish }: ChurchHistoryProps) {
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");
  const content = PARISH_HISTORY[parish.id];

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <History className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#5FC7DE] font-bold text-[15px] tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Historical Archive
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            {parishName} History
          </h2>
          <p className="text-[15px] text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Explore the spiritual roots, milestones, and architectural legacy of this parish.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {content ? (
          <div className="bg-white rounded-3xl border border-[#D6D6C2] overflow-hidden shadow-xs">
            {/* Image representing parish */}
            <div className="h-44 bg-[#EBEBE0] relative flex items-center justify-center overflow-hidden border-b border-[#D6D6C2]">
              <img
                src={content.photo}
                alt={content.photoAlt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span className="absolute bottom-3 left-3 text-white text-[15px] font-bold font-serif italic bg-black/70 px-2 py-0.5 rounded-lg">
                {parishName}
              </span>
              <span className="absolute bottom-3 right-3 text-sm bg-[#C2A649] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {content.badge}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <h3 className="text-base font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/40 pb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-4.5 h-4.5 text-[#C2A649]" /> {content.historyHeading}
              </h3>

              {content.historyParagraphs.map((p, idx) => (
                <p key={idx} className="text-[15px] text-[#33332D] leading-relaxed font-sans text-justify">
                  {p}
                </p>
              ))}

              <h3 className="text-base font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/40 pt-1 pb-1.5 flex items-center gap-1.5">
                <Compass className="w-4.5 h-4.5 text-[#C2A649]" /> {content.patronHeading}
              </h3>

              {content.patronParagraphs.map((p, idx) => (
                <p key={idx} className="text-[15px] text-[#33332D] leading-relaxed font-sans text-justify">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-5 text-center space-y-1.5">
            <p className="text-[15px] text-[#4A4A35] font-bold font-sans">
              History not yet documented for {parishName}.
            </p>
            <p className="text-sm text-[#8A8A70] font-sans">
              Check back soon, or ask the parish office directly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
