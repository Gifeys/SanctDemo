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
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] pb-20">
      {/* Header Banner */}
      <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden select-none border-b border-[var(--color-brand-border)]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Compass className="w-32 h-32 text-white" />
        </div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-1.5 text-[var(--color-brand-on-accent)] font-bold text-[15px] tracking-wider uppercase font-serif italic">
            <Sparkles className="w-3.5 h-3.5" /> Philippines Heritage Guide
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif italic tracking-tight">
              Begin Your Walk
            </h2>
            <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-90 mt-1 max-w-xs leading-relaxed font-sans">
              Rediscover historical churches, scenic trails, and wellness milestones on foot.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5">
        {/* Search Bar Input */}
        <div className="bg-white rounded-xl shadow-xs border border-[var(--color-brand-border)] p-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0 ml-1" />
          <input
            id="search-routes"
            type="text"
            placeholder="Search historic trails, cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[15px] text-[var(--color-brand-text)] outline-none placeholder-[var(--color-brand-secondary)]"
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
              className={`text-[15px] px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider shrink-0 transition-all border ${
                selectedCategory === cat
                  ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-xs"
                  : "bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] border-[var(--color-brand-border)] hover:bg-[var(--color-brand-border)]/45"
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
          <h3 className="text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
            Recommended Routes ({filteredRoutes.length})
          </h3>
        </div>

        {filteredRoutes.length > 0 ? (
          filteredRoutes.map((route) => (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className="bg-white rounded-2xl border border-[var(--color-brand-border)] overflow-hidden shadow-xs hover:shadow-sm hover:border-[var(--color-brand-primary)] transition-all cursor-pointer group flex flex-col"
            >
              {/* Image banner */}
              <div className="relative h-32 bg-[var(--color-brand-card)] overflow-hidden">
                <img
                  src={route.stations[0]?.imageUrl || "https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg"}
                  alt={route.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-sm font-bold text-white uppercase tracking-wider">
                  {route.category}
                </div>
                <div className="absolute bottom-2 left-2.5 flex items-center gap-1 bg-[var(--color-brand-primary)]/95 backdrop-blur-xs text-sm text-white px-2.5 py-0.5 rounded-full font-medium border border-[var(--color-brand-border)]/40">
                  <MapPin className="w-3 h-3 text-[var(--color-brand-gold)]" /> {route.location}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-brand-text)] font-serif italic group-hover:text-[var(--color-brand-secondary)] transition-colors leading-tight">
                    {route.name}
                  </h4>
                  <p className="text-[15px] text-[var(--color-brand-secondary)] line-clamp-2 mt-1 leading-normal font-sans">
                    {route.description}
                  </p>
                </div>

                {/* Trail Details */}
                <div className="flex items-center justify-between border-t border-[var(--color-brand-border)]/40 pt-2.5 mt-2 text-sm text-[var(--color-brand-secondary)] font-mono">
                  <div className="flex gap-4">
                    <div>
                      <span className="block text-[var(--color-brand-secondary)] uppercase text-sm font-bold">Distance</span>
                      <strong className="text-[var(--color-brand-text)] text-[15px] font-semibold">{route.distanceKm} km</strong>
                    </div>
                    <div>
                      <span className="block text-[var(--color-brand-secondary)] uppercase text-sm font-bold">Duration</span>
                      <strong className="text-[var(--color-brand-text)] text-[15px] font-semibold">{route.durationMins} mins</strong>
                    </div>
                    <div>
                      <span className="block text-[var(--color-brand-secondary)] uppercase text-sm font-bold">Difficulty</span>
                      <span className={`inline-block text-sm font-bold ${
                        route.difficulty === "Easy" ? "text-emerald-700" : "text-[var(--color-brand-gold)]"
                      }`}>{route.difficulty}</span>
                    </div>
                  </div>

                  <button className="h-7 w-7 rounded-full bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] flex items-center justify-center border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-primary)] hover:text-white hover:border-[var(--color-brand-primary)] transition-colors group-hover:scale-105">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-[var(--color-brand-border)] shadow-xs">
            <p className="text-[15px] text-[var(--color-brand-secondary)]">No walking routes found for your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
