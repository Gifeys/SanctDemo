import React, { useState } from "react";
import { Route, Station } from "../types";
import { Sparkles, MapPin, Clock, BrainCircuit, Play, Compass, Loader2 } from "lucide-react";

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
      const res = await fetch("/api/generate-walk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
          audioDuration: s.audioDuration || "2:00",
          imageUrl: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80",
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
    <div className="flex-1 flex flex-col bg-[#F5F5F0] pb-20 select-none">
      {/* Hero Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm border-b border-[#D6D6C2]">
        <h3 className="text-xs font-bold text-[#C2A649] font-serif italic uppercase tracking-wider flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5 text-[#C2A649]" /> AI Walk Companion
        </h3>
        <h2 className="text-xl font-bold font-serif italic tracking-tight mt-0.5">
          Custom Pilgrim Route Planner
        </h2>
        <p className="text-xs text-[#EBEBE0] opacity-90 mt-1 max-w-sm font-sans leading-relaxed">
          Fulfill complex capstone requirements! Leverage server-side Gemini to construct a fully custom heritage walk based on your precise interest.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          /* High-quality animated loading panel */
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-8 text-center space-y-4 shadow-xs">
            <Loader2 className="w-8 h-8 text-[#5A5A40] animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#4A4A35] font-serif italic">Generating Your SanctiWalk...</h4>
              <p className="text-xs text-[#8A8A70] italic animate-pulse">{loadingMessage}</p>
            </div>
          </div>
        ) : generatedRoute ? (
          /* Generated Custom Route View */
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm space-y-4">
            <div className="bg-[#EBEBE0] text-[#5A5A40] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider w-fit flex items-center gap-1 border border-[#D6D6C2]">
              <Sparkles className="w-3.5 h-3.5 text-[#C2A649]" /> Custom Gemini Gen
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#4A4A35] font-serif italic leading-tight">{generatedRoute.name}</h3>
              <p className="text-xs text-[#8A8A70] mt-1 leading-normal font-sans">{generatedRoute.description}</p>
            </div>

            {/* Custom walk stats */}
            <div className="grid grid-cols-3 gap-2 border-y border-[#D6D6C2] py-3 text-center">
              <div>
                <span className="block text-[8px] text-[#8A8A70] uppercase font-mono font-bold">Distance</span>
                <strong className="text-xs text-[#33332D] font-bold">{generatedRoute.distanceKm} km</strong>
              </div>
              <div>
                <span className="block text-[8px] text-[#8A8A70] uppercase font-mono font-bold">Time</span>
                <strong className="text-xs text-[#33332D] font-bold">{generatedRoute.durationMins} mins</strong>
              </div>
              <div>
                <span className="block text-[8px] text-[#8A8A70] uppercase font-mono font-bold">Est. Steps</span>
                <strong className="text-xs text-[#33332D] font-bold">{generatedRoute.estimatedSteps.toLocaleString()}</strong>
              </div>
            </div>

            {/* Stations Summary List */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-[#8A8A70] uppercase tracking-wider font-serif italic">Stations along Route</h4>
              <div className="space-y-2">
                {generatedRoute.stations.map((st, idx) => (
                  <div key={st.id} className="p-3 bg-[#EBEBE0]/30 rounded-2xl border border-[#D6D6C2] flex gap-2.5 items-start">
                    <span className="h-5 w-5 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-[10px] font-bold font-mono shrink-0 border border-[#4A4A35]">
                      0{idx + 1}
                    </span>
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-[#4A4A35] font-serif italic leading-tight">{st.name}</h5>
                      <p className="text-[11px] text-[#8A8A70] leading-normal line-clamp-1 font-sans">{st.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onLoadCustomRoute(generatedRoute)}
              className="w-full py-2.5 px-4 bg-[#5A5A40] hover:bg-[#4A4A35] text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 shadow-sm border border-[#4A4A35] uppercase tracking-wider transition-all hover:scale-[1.01]"
            >
              <Play className="w-4 h-4 fill-current ml-0.5 text-white" /> Start AI Guide Now
            </button>
          </div>
        ) : (
          /* Setup / Customizer Form */
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-4">
            <p className="text-xs text-[#8A8A70] leading-relaxed font-sans">
              Define your surroundings and preferences below. The Gemini AI engine will synthesize architectural history, custom routes, and wellness meditations dynamically.
            </p>

            {/* Location Input */}
            <div className="space-y-1">
              <label htmlFor="input-location" className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                Where are you walking?
              </label>
              <div className="bg-[#F5F5F0] border border-[#D6D6C2] rounded-2xl p-2.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#5A5A40] shrink-0" />
                <input
                  id="input-location"
                  type="text"
                  placeholder="e.g. Antipolo Rizal / Quiapo Manila / Cebu City"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#33332D] outline-none placeholder-[#8A8A70] font-sans"
                />
              </div>
            </div>

            {/* Interest Input */}
            <div className="space-y-1">
              <label htmlFor="input-interest" className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                What is your walk interest/focus?
              </label>
              <div className="bg-[#F5F5F0] border border-[#D6D6C2] rounded-2xl p-2.5 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#5A5A40] shrink-0" />
                <input
                  id="input-interest"
                  type="text"
                  placeholder="e.g. Baroque Carvings / Mental Peace / Local folklore"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#33332D] outline-none placeholder-[#8A8A70] font-sans"
                />
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1">
              <label htmlFor="select-duration" className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                Target Walking Time (Minutes)
              </label>
              <div className="bg-[#F5F5F0] border border-[#D6D6C2] rounded-2xl p-2.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#5A5A40] shrink-0" />
                <select
                  id="select-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#33332D] outline-none font-bold cursor-pointer font-serif italic"
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
              className="w-full py-2.5 px-4 bg-[#5A5A40] hover:bg-[#4A4A35] text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 shadow-sm border border-[#4A4A35] uppercase tracking-wider transition-all hover:scale-[1.01]"
            >
              <Sparkles className="w-4 h-4 text-[#C2A649]" /> Generate Custom AI Walk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
