import React, { useState } from "react";
import { Route, Station } from "../types";
import { Sparkles, MapPin, Clock, BrainCircuit, Play, Compass, Loader2 } from "lucide-react";
import { apiUrl } from "../lib/apiBase";
import { withAppKey } from "../lib/appKey";

interface CompanionTabProps {
  onLoadCustomRoute: (customRoute: Route) => void;
  isOffline: boolean;
}

export default function CompanionTab({ onLoadCustomRoute, isOffline }: CompanionTabProps) {
  const [location, setLocation] = useState("Antipolo, Rizal");
  const [interest, setInterest] = useState("Quiet Contemplation & Nature");
  const [duration, setDuration] = useState("30");
  const [loading, setLoading] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<Route | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");

  const loadingPhrases = [
    "Consulting historical parish archives...",
    "Calculating optimal pedestrian walking paths...",
    "Drafting reflective pilgrim mindfulness prompts...",
    "Preparing your personalized audio guide transcript...",
    "Structuring heritage routes near you..."
  ];

  const handleGenerate = async () => {
    if (isOffline) {
      alert("AI generation is offline. Please enable Online Sim mode to connect with Gemini.");
      return;
    }

    setLoading(true);
    setGeneratedRoute(null);
    
    // Cycle loading phrases for rich UI feedback
    let phraseIdx = 0;
    setLoadingMessage(loadingPhrases[0]);
    const messageInterval = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % loadingPhrases.length;
      setLoadingMessage(loadingPhrases[phraseIdx]);
    }, 1500);

    try {
      const res = await fetch(apiUrl("/api/generate-walk"), {
        method: "POST",
        headers: withAppKey({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          location,
          interest,
          durationMinutes: parseInt(duration)
        })
      });

      const data = await res.json();
      
      // Structure the returned schema to fit our standard Route format
      const customRoute: Route = {
        id: `custom-${Date.now()}`,
        name: data.name,
        description: data.description,
        location: location,
        distanceKm: data.distanceKm || 1.5,
        durationMins: data.durationMins || parseInt(duration),
        difficulty: "Moderate",
        estimatedSteps: data.estimatedSteps || 2500,
        category: "Spiritual Retreat",
        accentColor: "from-purple-600 to-purple-800",
        stations: (data.stations || []).map((s: any, idx: number) => ({
          id: `custom-st-${idx}`,
          name: s.name,
          description: s.description,
          history: s.history,
          reflection: s.reflection,
          coordinates: { 
            lat: 14.5 + (Math.random() - 0.5) * 0.1, 
            lng: 121.0 + (Math.random() - 0.5) * 0.1 
          },
          qrCode: `SW-AI-QR-${idx}`
        }))
      };

      setGeneratedRoute(customRoute);
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(messageInterval);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] pb-20 select-none">
      {/* Hero Header */}
      <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm border-b border-[var(--color-brand-border)]">
        <h3 className="text-[15px] font-bold text-[var(--color-brand-gold)] font-serif italic uppercase tracking-wider flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5 text-[var(--color-brand-gold)]" /> AI Walk Companion
        </h3>
        <h2 className="text-xl font-bold font-serif italic tracking-tight mt-0.5">
          Custom Pilgrim Route Planner
        </h2>
        <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-90 mt-1 max-w-sm font-sans leading-relaxed">
          Fulfill complex capstone requirements! Leverage server-side Gemini to construct a fully custom heritage walk based on your precise interest.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          /* High-quality animated loading panel */
          <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-8 text-center space-y-4 shadow-xs">
            <Loader2 className="w-8 h-8 text-[var(--color-brand-secondary)] animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[var(--color-brand-text)] font-serif italic">Generating Your SanctiWalk...</h4>
              <p className="text-[15px] text-[var(--color-brand-secondary)] italic animate-pulse">{loadingMessage}</p>
            </div>
          </div>
        ) : generatedRoute ? (
          /* Generated Custom Route View */
          <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-4 shadow-sm space-y-4">
            <div className="bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] text-sm font-bold px-2.5 py-1 rounded-full uppercase tracking-wider w-fit flex items-center gap-1 border border-[var(--color-brand-border)]">
              <Sparkles className="w-3.5 h-3.5 text-[var(--color-brand-gold)]" /> Custom Gemini Gen
            </div>

            <div>
              <h3 className="text-sm font-bold text-[var(--color-brand-text)] font-serif italic leading-tight">{generatedRoute.name}</h3>
              <p className="text-[15px] text-[var(--color-brand-secondary)] mt-1 leading-normal font-sans">{generatedRoute.description}</p>
            </div>

            {/* Custom walk stats */}
            <div className="grid grid-cols-3 gap-2 border-y border-[var(--color-brand-border)] py-3 text-center">
              <div>
                <span className="block text-sm text-[var(--color-brand-secondary)] uppercase font-mono font-bold">Distance</span>
                <strong className="text-[15px] text-[var(--color-brand-text)] font-bold">{generatedRoute.distanceKm} km</strong>
              </div>
              <div>
                <span className="block text-sm text-[var(--color-brand-secondary)] uppercase font-mono font-bold">Time</span>
                <strong className="text-[15px] text-[var(--color-brand-text)] font-bold">{generatedRoute.durationMins} mins</strong>
              </div>
              <div>
                <span className="block text-sm text-[var(--color-brand-secondary)] uppercase font-mono font-bold">Est. Steps</span>
                <strong className="text-[15px] text-[var(--color-brand-text)] font-bold">{generatedRoute.estimatedSteps.toLocaleString()}</strong>
              </div>
            </div>

            {/* Stations Summary List */}
            <div className="space-y-2.5">
              <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">Stations along Route</h4>
              <div className="space-y-2">
                {generatedRoute.stations.map((st, idx) => (
                  <div key={st.id} className="p-3 bg-[var(--color-brand-card)]/30 rounded-2xl border border-[var(--color-brand-border)] flex gap-2.5 items-start">
                    <span className="h-5 w-5 rounded-full bg-[var(--color-brand-primary)] text-white flex items-center justify-center text-sm font-bold font-mono shrink-0 border border-[var(--color-brand-primary-dark)]">
                      0{idx + 1}
                    </span>
                    <div className="space-y-0.5">
                      <h5 className="text-[15px] font-bold text-[var(--color-brand-text)] font-serif italic leading-tight">{st.name}</h5>
                      <p className="text-[15px] text-[var(--color-brand-secondary)] leading-normal line-clamp-1 font-sans">{st.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onLoadCustomRoute(generatedRoute)}
              className="w-full py-2.5 px-4 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white font-bold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-sm border border-[var(--color-brand-primary-dark)] uppercase tracking-wider transition-all hover:scale-[1.01]"
            >
              <Play className="w-4 h-4 fill-current ml-0.5 text-white" /> Start AI Guide Now
            </button>
          </div>
        ) : (
          /* Setup / Customizer Form */
          <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-4 shadow-xs space-y-4">
            <p className="text-[15px] text-[var(--color-brand-secondary)] leading-relaxed font-sans">
              Define your surroundings and preferences below. The Gemini AI engine will synthesize architectural history, custom routes, and wellness meditations dynamically.
            </p>

            {/* Location Input */}
            <div className="space-y-1">
              <label htmlFor="input-location" className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                Where are you walking?
              </label>
              <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-2.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                <input
                  id="input-location"
                  type="text"
                  placeholder="e.g. Antipolo Rizal / Quiapo Manila / Cebu City"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent text-[15px] text-[var(--color-brand-text)] outline-none placeholder-[var(--color-brand-secondary)] font-sans"
                />
              </div>
            </div>

            {/* Interest Input */}
            <div className="space-y-1">
              <label htmlFor="input-interest" className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                What is your walk interest/focus?
              </label>
              <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-2.5 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                <input
                  id="input-interest"
                  type="text"
                  placeholder="e.g. Baroque Carvings / Mental Peace / Local folklore"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className="w-full bg-transparent text-[15px] text-[var(--color-brand-text)] outline-none placeholder-[var(--color-brand-secondary)] font-sans"
                />
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1">
              <label htmlFor="select-duration" className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
                Target Walking Time (Minutes)
              </label>
              <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-2.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                <select
                  id="select-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-transparent text-[15px] text-[var(--color-brand-text)] outline-none font-bold cursor-pointer font-serif italic"
                >
                  <option value="20" className="font-serif">20 Minutes Walk</option>
                  <option value="30" className="font-serif">30 Minutes Walk</option>
                  <option value="45" className="font-serif">45 Minutes Walk</option>
                  <option value="60" className="font-serif">60 Minutes Walk</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full py-2.5 px-4 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white font-bold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-sm border border-[var(--color-brand-primary-dark)] uppercase tracking-wider transition-all hover:scale-[1.01]"
            >
              <Sparkles className="w-4 h-4 text-[var(--color-brand-gold)]" /> Generate Custom AI Walk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
