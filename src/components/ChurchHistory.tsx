import React, { useState } from "react";
import { BookOpen, Sparkles, Compass, ShieldAlert, History } from "lucide-react";

export default function ChurchHistory() {
  const [activeTab, setActiveTab] = useState<"mhcp" | "src">("mhcp");

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <History className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Historical Archive
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Diocesan History
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Explore the spiritual roots, milestones, and architectural legacy of Kalookan's sacred treasures.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Toggle between Churches */}
        <div className="grid grid-cols-2 gap-2 bg-[#EBEBE0] p-1.5 rounded-full border border-[#D6D6C2] select-none">
          <button
            onClick={() => setActiveTab("mhcp")}
            className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
              activeTab === "mhcp"
                ? "bg-[#5A5A40] text-white shadow-xs"
                : "text-[#8A8A70] hover:text-[#5A5A40]"
            }`}
          >
            Mary Help (Maypajo)
          </button>
          <button
            onClick={() => setActiveTab("src")}
            className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
              activeTab === "src"
                ? "bg-[#5A5A40] text-white shadow-xs"
                : "text-[#8A8A70] hover:text-[#5A5A40]"
            }`}
          >
            San Roque Cathedral
          </button>
        </div>

        {activeTab === "mhcp" ? (
          /* Mary Help of Christians Parish history */
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-[#D6D6C2] overflow-hidden shadow-xs">
              {/* Image representing parish */}
              <div className="h-44 bg-[#EBEBE0] relative flex items-center justify-center overflow-hidden border-b border-[#D6D6C2]">
                <img
                  src="https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg"
                  alt="Mary Help of Christians Maypajo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <span className="absolute bottom-3 left-3 text-white text-xs font-bold font-serif italic">
                  Mary Help of Christians Parish
                </span>
                <span className="absolute bottom-3 right-3 text-[9px] bg-[#C2A649] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Maypajo, Caloocan
                </span>
              </div>

              <div className="p-4 space-y-3">
                <h3 className="text-base font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/40 pb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-4.5 h-4.5 text-[#C2A649]" /> Brief History
                </h3>
                
                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  Mary Help of Christians Parish in Maypajo, Caloocan City was established in 1952 to serve the rapidly expanding population of Southern Caloocan and to provide a sacred sanctuary dedicated to Marian devotion. Under the zealous pastoral leadership of the parish priests and active community builders, it grew from a simple chapel of wood and nipa into a beautiful parish that stands as a beacon of Christian faith and Salesian spirit.
                </p>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  Over the decades, the parish has nurtured thousands of families, active lay organizations, and youth ministries, becoming a vital hub for prayer, catechesis, sacraments, and social services.
                </p>

                <h3 className="text-base font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/40 pt-1 pb-1.5 flex items-center gap-1.5">
                  <Compass className="w-4.5 h-4.5 text-[#C2A649]" /> Patroness: Maria Auxiliadora
                </h3>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  The beloved patroness is the Blessed Virgin Mary under the title <strong>Mary, Help of Christians (Maria Auxiliadora)</strong>. This title highlights her powerful maternal role as a helper, protector, and defender of Christians in times of severe trial, hardship, or spiritual battle.
                </p>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  Venerated highly within the Salesian family of St. John Bosco, her image depicts her holding the Child Jesus with both arms open, inviting the faithful to surrender their cares, seek grace, and find victory over life's daily storms through Christ.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* San Roque Cathedral history */
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-[#D6D6C2] overflow-hidden shadow-xs">
              {/* Image representing San Roque */}
              <div className="h-44 bg-[#EBEBE0] relative flex items-center justify-center overflow-hidden border-b border-[#D6D6C2]">
                <img
                  src="https://images.unsplash.com/photo-1590076241314-e2c7c724490d?auto=format&fit=crop&w=800&q=80"
                  alt="San Roque Cathedral Caloocan"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <span className="absolute bottom-3 left-3 text-white text-xs font-bold font-serif italic">
                  San Roque Cathedral
                </span>
                <span className="absolute bottom-3 right-3 text-[9px] bg-[#C2A649] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Diocese of Kalookan
                </span>
              </div>

              <div className="p-4 space-y-3">
                <h3 className="text-base font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/40 pb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-4.5 h-4.5 text-[#C2A649]" /> Historical Milestones
                </h3>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  The historic San Roque Cathedral was originally founded as a parish in <strong>1815</strong> under the Archdiocese of Manila. The church stood witness to the turbulent days of the Philippine Revolution, serving as a military post and safe haven for local revolutionaries. It was repeatedly damaged during wars but rose each time through the absolute devotion of the Caloocan parishioners.
                </p>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  In <strong>2003</strong>, His Holiness Pope John Paul II established the <strong>Diocese of Kalookan</strong>, and San Roque Parish was officially elevated to the dignity of a Cathedral, serving as the central seat of the Bishop, guiding the spiritual flock of Caloocan, Malabon, and Navotas.
                </p>

                <h3 className="text-base font-bold text-[#4A4A35] font-serif italic border-b border-[#D6D6C2]/40 pt-1 pb-1.5 flex items-center gap-1.5">
                  <Compass className="w-4.5 h-4.5 text-[#C2A649]" /> Patron: San Roque (Saint Roch)
                </h3>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  The Cathedral is named in honor of <strong>San Roque (Saint Roch)</strong>, a 14th-century lay saint who traveled across Europe nursing patients afflicted with the horrific bubonic plague. He is depicted pointing to a plague sore on his thigh, flanked by his faithful dog who brought him daily loaves of bread when he was isolated in the forest.
                </p>

                <p className="text-xs text-[#33332D] leading-relaxed font-sans text-justify">
                  San Roque is beloved as the patron saint of the sick, plague victims, healthcare workers, and epidemics, standing as a testament of pure Christian charity, selfless volunteerism, and healing.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
