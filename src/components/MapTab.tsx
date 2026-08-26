import React, { useState, useEffect, useRef } from "react";
import { Route, Station } from "../types";
import { ROUTES } from "../data";
import { MapPin, Navigation, Volume2, CheckCircle2, Play, Pause, ChevronLeft, Award, BookOpen, AlertCircle, Sparkles } from "lucide-react";

interface MapTabProps {
  routeId: string | null;
  onSelectRoute: (routeId: string | null) => void;
  isOffline: boolean;
  onStationVisited: (stationId: string, stepsToAdd: number, distanceToAdd: number) => void;
  visitedStations: string[];
}

export default function MapTab({
  routeId,
  onSelectRoute,
  isOffline,
  onStationVisited,
  visitedStations
}: MapTabProps) {
  const currentRoute = ROUTES.find((r) => r.id === routeId) || ROUTES[0];
  
  // Simulation States
  const [activeStationIndex, setActiveStationIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isSimulatingWalk, setIsSimulatingWalk] = useState(false);
  const [walkProgress, setWalkProgress] = useState(0); // 0 to 100 between stations
  const [diaryNote, setDiaryNote] = useState("");
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [simLat, setSimLat] = useState(currentRoute.stations[0]?.coordinates.lat);
  const [simLng, setSimLng] = useState(currentRoute.stations[0]?.coordinates.lng);

  const activeStation = currentRoute.stations[activeStationIndex];

  // Reset indices on route change
  useEffect(() => {
    setActiveStationIndex(0);
    setWalkProgress(0);
    setIsSimulatingWalk(false);
    setIsPlayingAudio(false);
    setAudioProgress(0);
    if (currentRoute.stations[0]) {
      setSimLat(currentRoute.stations[0].coordinates.lat);
      setSimLng(currentRoute.stations[0].coordinates.lng);
    }
  }, [routeId]);

  // Audio Playback Simulation Interval
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingAudio) {
      timer = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 5;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlayingAudio]);

  // Simulated Speech Synthesis option
  const speakReflection = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeStation.reflection);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    } else {
      setIsPlayingAudio(true);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  // Walk Simulation Interval
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSimulatingWalk) {
      timer = setInterval(() => {
        setWalkProgress((prev) => {
          if (prev >= 100) {
            setIsSimulatingWalk(false);
            // Arrived at next station!
            const nextIndex = (activeStationIndex + 1) % currentRoute.stations.length;
            setActiveStationIndex(nextIndex);
            
            // Set coordinates
            const targetStation = currentRoute.stations[nextIndex];
            setSimLat(targetStation.coordinates.lat);
            setSimLng(targetStation.coordinates.lng);
            
            return 0;
          }
          
          // Interpolate coordinates
          const currentIndex = activeStationIndex;
          const nextIndex = (activeStationIndex + 1) % currentRoute.stations.length;
          const start = currentRoute.stations[currentIndex].coordinates;
          const end = currentRoute.stations[nextIndex].coordinates;
          const pct = prev / 100;
          setSimLat(start.lat + (end.lat - start.lat) * pct);
          setSimLng(start.lng + (end.lng - start.lng) * pct);

          return prev + 10;
        });
      }, 300);
    }
    return () => clearInterval(timer);
  }, [isSimulatingWalk, activeStationIndex, currentRoute]);

  const handleNextStationSim = () => {
    if (currentRoute.stations.length <= 1) return;
    setIsSimulatingWalk(true);
    setWalkProgress(0);
  };

  const handleCheckIn = () => {
    // Generate reward and add progress
    onStationVisited(activeStation.id, 800, 0.6);
  };

  const handleSaveDiary = () => {
    if (!diaryNote.trim()) return;
    setSavedNotes((prev) => ({
      ...prev,
      [activeStation.id]: diaryNote
    }));
    setDiaryNote("");
  };

  // SVG coordinate calculator for map trail representation
  const stationsCount = currentRoute.stations.length;
  const mapWidth = 320;
  const mapHeight = 180;

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] pb-20 select-none">
      {/* Route Navigation Header */}
      <div className="bg-[var(--color-brand-primary)] text-white px-4 py-3 flex items-center gap-3 shrink-0 border-b border-[var(--color-brand-border)]">
        <button
          onClick={() => onSelectRoute(null)}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-[15px] font-bold text-[var(--color-brand-on-accent)] font-serif italic uppercase tracking-wider">Active SanctiWalk Guide</h3>
          <h2 className="text-sm font-bold tracking-tight line-clamp-1 font-serif">{currentRoute.name}</h2>
        </div>
      </div>

      {/* Geolocation Telemetry Display */}
      <div className="bg-[var(--color-brand-text)] text-[var(--color-brand-secondary)] font-mono text-sm px-4 py-2 flex items-center justify-between shadow-inner shrink-0 border-b border-[var(--color-brand-border)]/45">
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3 text-[var(--color-brand-on-accent)] animate-pulse" />
          LAT: <span className="text-[var(--color-brand-on-accent)] font-bold">{simLat.toFixed(6)}</span> 
          &nbsp; LNG: <span className="text-[var(--color-brand-on-accent)] font-bold">{simLng.toFixed(6)}</span>
        </span>
        <span className="text-sm bg-[var(--color-brand-primary-dark)] text-[var(--color-brand-secondary)] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          GPS Sim
        </span>
      </div>

      {/* Interactive Map Section */}
      <div className="p-4 shrink-0">
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] p-3.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic">
              Sancti Trail Visualizer
            </span>
            {isOffline && (
              <span className="flex items-center gap-1 text-sm font-bold text-[var(--color-brand-text)] bg-[var(--color-brand-card)] px-2 py-0.5 rounded-full border border-[var(--color-brand-border)]">
                <AlertCircle className="w-2.5 h-2.5" /> Cached Offline Map
              </span>
            )}
          </div>

          {/* SVG Map Canvas */}
          <div className="relative h-[160px] bg-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)] flex items-center justify-center overflow-hidden">
            {/* Background elements representing parks & roads */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(var(--color-brand-primary)_1px,transparent_1px)] [background-size:20px_20px]">
              <div className="absolute top-1/4 left-1/12 w-16 h-16 bg-[var(--color-brand-primary)]/40 rounded-full blur-md"></div>
              <div className="absolute bottom-1/4 right-1/10 w-24 h-24 bg-[var(--color-brand-primary)]/30 rounded-full blur-lg"></div>
              <div className="absolute top-1/2 left-1/2 w-40 h-2 bg-[var(--color-brand-border)] rotate-12"></div>
              <div className="absolute top-1/3 left-1/3 w-2 bg-[var(--color-brand-border)] h-40 rotate-45"></div>
            </div>

            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full relative z-10">
              {/* Draw walk path/trail */}
              {stationsCount > 1 && (
                <path
                  d={`M 40 ${mapHeight / 2} Q 160 ${mapHeight / 5} 280 ${mapHeight / 2}`}
                  fill="none"
                  stroke="var(--color-brand-primary)"
                  strokeWidth="3"
                  strokeDasharray="6,4"
                  strokeOpacity="0.6"
                />
              )}

              {/* Station Markers */}
              {currentRoute.stations.map((st, idx) => {
                const ratio = idx / (stationsCount - 1 || 1);
                const x = 40 + ratio * 240;
                // Simple quadratic bezier path height estimation for positioning points
                const t = ratio;
                const y = (1 - t) * (1 - t) * (mapHeight / 2) + 2 * (1 - t) * t * (mapHeight / 5) + t * t * (mapHeight / 2);
                
                const isCurrent = idx === activeStationIndex;
                const isVisited = visitedStations.includes(st.id);

                return (
                  <g key={st.id}>
                    {/* Ring glow for current active stop */}
                    {isCurrent && (
                      <circle
                        cx={x}
                        cy={y}
                        r="14"
                        fill="none"
                        stroke="var(--color-brand-primary)"
                        strokeWidth="1.5"
                        className="animate-ping"
                        style={{ transformOrigin: `${x}px ${y}px` }}
                      />
                    )}
                    {/* Outer border */}
                    <circle
                      cx={x}
                      cy={y}
                      r="9"
                      fill={isCurrent ? "var(--color-brand-primary)" : isVisited ? "var(--color-brand-success)" : "var(--color-brand-card)"}
                      stroke={isCurrent ? "var(--color-brand-accent)" : "var(--color-brand-border)"}
                      strokeWidth="2.5"
                    />
                    {/* Inner gold core */}
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill={isCurrent ? "var(--color-brand-accent)" : "var(--color-brand-card)"}
                    />
                    {/* Station Number Text */}
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fill="var(--color-brand-text)"
                      fontSize="14"
                      fontWeight="bold"
                      fontFamily="Lora, serif"
                    >
                      Stop {idx + 1}
                    </text>
                  </g>
                );
              })}

              {/* Avatar position simulation along bezier trail */}
              {stationsCount > 1 && !isSimulatingWalk && (
                (() => {
                  const ratio = activeStationIndex / (stationsCount - 1);
                  const x = 40 + ratio * 240;
                  const t = ratio;
                  const y = (1 - t) * (1 - t) * (mapHeight / 2) + 2 * (1 - t) * t * (mapHeight / 5) + t * t * (mapHeight / 2);
                  return (
                    <g>
                      <circle cx={x} cy={y} r="15" fill="var(--color-brand-primary)" fillOpacity="0.2" />
                      <g transform={`translate(${x - 7}, ${y - 18})`}>
                        <MapPin className="w-3.5 h-3.5 text-[var(--color-brand-secondary)] fill-[var(--color-brand-gold)]" />
                      </g>
                    </g>
                  );
                })()
              )}

              {/* Walking simulation avatar */}
              {isSimulatingWalk && (
                (() => {
                  const nextIndex = (activeStationIndex + 1) % stationsCount;
                  const currentRatio = activeStationIndex / (stationsCount - 1);
                  const nextRatio = nextIndex / (stationsCount - 1);
                  const stepRatio = currentRatio + (nextRatio - currentRatio) * (walkProgress / 100);
                  const x = 40 + stepRatio * 240;
                  const t = stepRatio;
                  const y = (1 - t) * (1 - t) * (mapHeight / 2) + 2 * (1 - t) * t * (mapHeight / 5) + t * t * (mapHeight / 2);
                  return (
                    <g className="animate-bounce">
                      <circle cx={x} cy={y} r="8" fill="var(--color-brand-accent)" stroke="var(--color-brand-primary)" strokeWidth="2" />
                    </g>
                  );
                })()
              )}
            </svg>

            {/* Float simulation guide button overlay */}
            <div className="absolute bottom-2.5 right-2.5 z-20">
              <button
                id="btn-simulate-walk"
                disabled={isSimulatingWalk || stationsCount <= 1}
                onClick={handleNextStationSim}
                className="bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white font-bold uppercase tracking-wider text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md disabled:bg-[var(--color-brand-border)] disabled:text-[var(--color-brand-secondary)] disabled:shadow-none transition-colors border border-[var(--color-brand-primary-dark)]"
              >
                <Navigation className="w-3 h-3 rotate-45 fill-current" />
                {isSimulatingWalk ? "Walking..." : "Simulate Walk"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Station Detail Drawer */}
      <div className="px-4 flex-1 overflow-y-auto space-y-4">
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] p-4 shadow-xs space-y-4">
          <div className="flex gap-3">
            <img
              src={activeStation.imageUrl}
              alt={activeStation.name}
              className="w-20 h-20 rounded-2xl object-cover border border-[var(--color-brand-border)]/50 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <span className="text-sm font-bold text-[var(--color-brand-gold)] uppercase tracking-widest block font-serif italic">
                Current Station {activeStationIndex + 1} of {stationsCount}
              </span>
              <h4 className="text-[15px] font-bold text-[var(--color-brand-text)] font-serif italic leading-tight">
                {activeStation.name}
              </h4>
              <p className="text-[15px] text-[var(--color-brand-secondary)] leading-normal line-clamp-2">
                {activeStation.description}
              </p>
            </div>
          </div>

          {/* Historical Details */}
          <div className="p-3 bg-[var(--color-brand-card)]/60 rounded-2xl space-y-1 border border-[var(--color-brand-border)]/50">
            <h5 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-brand-secondary)]" /> Heritage & History
            </h5>
            <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans">
              {activeStation.history}
            </p>
          </div>

          {/* Spiritual Reflection Segment */}
          <div className="p-3.5 bg-[var(--color-brand-card)]/30 rounded-2xl border border-[var(--color-brand-border)] space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-serif italic flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-brand-gold)]" /> Pilgrim Reflection Prompt
              </h5>
              
              {/* Voice Guided Audio Button */}
              <button
                onClick={isPlayingAudio ? stopSpeaking : speakReflection}
                className="flex items-center gap-1 bg-[var(--color-brand-primary)] text-white px-2.5 py-0.5 rounded-full text-sm font-bold border border-[var(--color-brand-primary-dark)] uppercase tracking-wider hover:bg-[var(--color-brand-primary-dark)] transition-all"
              >
                <Volume2 className="w-3 h-3" />
                {isPlayingAudio ? "Stop Guide" : "Listen Guide"}
              </button>
            </div>

            <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed italic font-medium font-sans">
              "{activeStation.reflection}"
            </p>

            {/* Audio guide animated sound wave */}
            {isPlayingAudio && (
              <div className="flex items-center gap-1 pt-1.5">
                <span className="w-1.5 h-3 bg-[var(--color-brand-primary)] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-5 bg-[var(--color-brand-primary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1.5 h-2 bg-[var(--color-brand-primary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                <span className="w-1.5 h-4 bg-[var(--color-brand-primary)] rounded-full animate-bounce" style={{ animationDelay: "450ms" }}></span>
                <span className="text-sm font-mono text-[var(--color-brand-secondary)] ml-1.5">Playing Audio Guide...</span>
              </div>
            )}

            {/* Local Notes/Reflections Diary input */}
            <div className="space-y-2 pt-2 border-t border-[var(--color-brand-border)]/45">
              {savedNotes[activeStation.id] ? (
                <div className="p-2.5 bg-white rounded-xl border border-[var(--color-brand-border)] text-[15px] text-gray-700 space-y-1">
                  <span className="text-sm text-[var(--color-brand-secondary)] font-mono block font-bold uppercase">Your Saved Note:</span>
                  <p className="italic font-medium text-[var(--color-brand-text)]">"{savedNotes[activeStation.id]}"</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="diary-note-input"
                    type="text"
                    placeholder="Write down your thoughts here..."
                    value={diaryNote}
                    onChange={(e) => setDiaryNote(e.target.value)}
                    className="flex-1 bg-white border border-[var(--color-brand-border)] text-[15px] px-2.5 py-1.5 rounded-xl outline-none placeholder-[var(--color-brand-secondary)] text-[var(--color-brand-text)]"
                  />
                  <button
                    onClick={handleSaveDiary}
                    className="bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white font-bold uppercase tracking-wider text-sm px-3 py-1.5 rounded-xl shrink-0"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Check In */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-sm text-[var(--color-brand-secondary)] font-mono flex items-center gap-1 font-bold">
              QR Code: <strong className="text-[var(--color-brand-text)]">{activeStation.qrCode}</strong>
            </span>

            {visitedStations.includes(activeStation.id) ? (
              <span className="flex items-center gap-1.5 text-[15px] text-green-700 bg-green-50 px-3.5 py-1.5 rounded-full font-bold border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Arrived & Checked-In
              </span>
            ) : (
              <button
                id="btn-station-checkin"
                onClick={handleCheckIn}
                className="bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white font-bold text-[15px] px-4 py-2.5 rounded-full flex items-center gap-1.5 shadow-sm border border-[var(--color-brand-primary-dark)] transition-all uppercase tracking-wider hover:scale-[1.02]"
              >
                <Award className="w-4 h-4" /> Stamp Passport
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
