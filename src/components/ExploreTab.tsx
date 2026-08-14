import React, { useState } from "react";
import { Route } from "../types";
import { ROUTES } from "../data";
import { Search, MapPin, Compass, Play, Star, ChevronRight, Sparkles } from "lucide-react";

interface ExploreTabProps {
  onSelectRoute: (routeId: string) => void;
}

export default function ExploreTab({ onSelectRoute }: ExploreTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Historic Heritage", "Spiritual Retreat", "Marian Church"];

  const filteredRoutes = ROUTES.filter((route) => {
    const matchesSearch =
      route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || route.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] pb-20">
      {/* Header Banner */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden select-none border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Compass className="w-32 h-32 text-white" />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
            <Sparkles className="w-3.5 h-3.5" /> Philippines Heritage Guide
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif italic tracking-tight">
              Begin Your Walk
            </h2>
            <p className="text-xs text-[#EBEBE0] opacity-90 mt-1 max-w-xs leading-relaxed font-sans">
              Rediscover historical churches, scenic trails, and wellness milestones on foot.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5">
        {/* Search Bar Input */}
        <div className="bg-white rounded-xl shadow-xs border border-[#D6D6C2] p-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#8A8A70] shrink-0 ml-1" />
          <input
            id="search-routes"
            type="text"
            placeholder="Search historic trails, cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[#33332D] outline-none placeholder-[#8A8A70]"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider shrink-0 transition-all border ${
                selectedCategory === cat
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                  : "bg-[#EBEBE0] text-[#8A8A70] border-[#D6D6C2] hover:bg-[#D6D6C2]/45"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Trail Cards */}
      <div className="px-4 mt-5 space-y-4 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#8A8A70] uppercase tracking-wider font-serif italic">
            Recommended Routes ({filteredRoutes.length})
          </h3>
        </div>

        {filteredRoutes.length > 0 ? (
          filteredRoutes.map((route) => (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden shadow-xs hover:shadow-sm hover:border-[#5A5A40] transition-all cursor-pointer group flex flex-col"
            >
              {/* Image banner */}
              <div className="relative h-32 bg-[#EBEBE0] overflow-hidden">
                <img
                  src={route.stations[0]?.imageUrl || "https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg"}
                  alt={route.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2.5 left-2.5 bg-black/45 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider">
                  {route.category}
                </div>
                <div className="absolute bottom-2 left-2.5 flex items-center gap-1 bg-[#5A5A40]/95 backdrop-blur-xs text-[10px] text-white px-2.5 py-0.5 rounded-full font-medium border border-[#D6D6C2]/40">
                  <MapPin className="w-3 h-3 text-[#C2A649]" /> {route.location}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#4A4A35] font-serif italic group-hover:text-[#5A5A40] transition-colors leading-tight">
                    {route.name}
                  </h4>
                  <p className="text-xs text-[#8A8A70] line-clamp-2 mt-1 leading-normal font-sans">
                    {route.description}
                  </p>
                </div>

                {/* Trail Details */}
                <div className="flex items-center justify-between border-t border-[#D6D6C2]/40 pt-2.5 mt-2 text-[10px] text-[#8A8A70] font-mono">
                  <div className="flex gap-4">
                    <div>
                      <span className="block text-[#8A8A70] uppercase text-[8px] font-bold">Distance</span>
                      <strong className="text-[#33332D] text-xs font-semibold">{route.distanceKm} km</strong>
                    </div>
                    <div>
                      <span className="block text-[#8A8A70] uppercase text-[8px] font-bold">Duration</span>
                      <strong className="text-[#33332D] text-xs font-semibold">{route.durationMins} mins</strong>
                    </div>
                    <div>
                      <span className="block text-[#8A8A70] uppercase text-[8px] font-bold">Difficulty</span>
                      <span className={`inline-block text-[10px] font-bold ${
                        route.difficulty === "Easy" ? "text-emerald-700" : "text-[#C2A649]"
                      }`}>{route.difficulty}</span>
                    </div>
                  </div>

                  <button className="h-7 w-7 rounded-full bg-[#EBEBE0] text-[#5A5A40] flex items-center justify-center border border-[#D6D6C2] hover:bg-[#5A5A40] hover:text-white hover:border-[#5A5A40] transition-colors group-hover:scale-105">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-[#D6D6C2] shadow-xs">
            <p className="text-xs text-[#8A8A70]">No walking routes found for your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
