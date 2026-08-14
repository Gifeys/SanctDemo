import React, { useState, useEffect } from "react";
import { AGOS_BOOK_PAGES, AgosBookPage } from "../data";
import { Sparkles, Camera, BookOpen, Volume2, Play, Pause, AlertCircle, ShieldCheck, CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";

interface AgosBookARProps {
  onEarnBadge: (badgeId: string) => void;
  onAddPoints: (points: number) => void;
  onAddApplication: (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => void;
}

export default function AgosBookAR({ onEarnBadge, onAddPoints, onAddApplication }: AgosBookARProps) {
  const [selectedPageId, setSelectedPageId] = useState<string>("agos-p5");
  const [arState, setArState] = useState<"idle" | "requesting" | "scanning" | "rendering" | "completed">("idle");
  
  // Audio Narrator State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  
  // User Reflection State
  const [reflectionText, setReflectionText] = useState("");
  const [isReflectionSaved, setIsReflectionSaved] = useState(false);

  const activePage = AGOS_BOOK_PAGES.find(p => p.id === selectedPageId) || AGOS_BOOK_PAGES[0];

  useEffect(() => {
    let interval: any;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress(p => {
          if (p >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return p + 2.5;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const handleStartScan = () => {
    setArState("requesting");
  };

  const handleGrantPermission = () => {
    setArState("scanning");
    // Auto progress from scanning to rendering to completed
    setTimeout(() => {
      setArState("rendering");
      setTimeout(() => {
        setArState("completed");
        setIsPlayingAudio(true);
        setAudioProgress(0);
        onAddPoints(300); // 300 pts for AR scan
        onEarnBadge("badge-3"); // Unlock Agos Scholar Badge
        
        // Log to database
        onAddApplication({
          id: "ar-log-" + Date.now(),
          type: "AR Sensor Scan",
          applicant: "Public User",
          details: `Scanned Agos Book Page ${activePage.pageNumber} (${activePage.arModelName})`,
          date: new Date().toLocaleDateString(),
          status: "Database Synchronized"
        });
      }, 1500);
    }, 2000);
  };

  const handleDenyPermission = () => {
    setArState("idle");
  };

  const handleSaveReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionText) return;
    setIsReflectionSaved(true);
    onAddPoints(150); // bonus points
    
    // Log reflection to database
    onAddApplication({
      id: "ref-log-" + Date.now(),
      type: "Spiritual Reflection",
      applicant: "Public Pilgrim",
      details: `Agos Ch ${activePage.pageNumber} Reflection: "${reflectionText.substring(0, 60)}..."`,
      date: new Date().toLocaleDateString(),
      status: "Moderated Approval"
    });
  };

  const handleReset = () => {
    setArState("idle");
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setReflectionText("");
    setIsReflectionSaved(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Camera className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Augmented Reality SDK
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Agos Book AR
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Point your device at pages of the parish book <strong>'Agos'</strong> to trigger 3D overlays and voice guides!
          </p>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        {arState === "idle" && (
          <div className="space-y-4 flex-1">
            {/* Guide Info */}
            <div className="p-4 bg-white rounded-3xl border border-[#D6D6C2] space-y-2">
              <h3 className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest font-serif italic flex items-center gap-1">
                <BookOpen className="w-4 h-4" /> How to Scan
              </h3>
              <p className="text-xs text-[#33332D] leading-relaxed font-sans">
                The parish history book <strong>'Agos'</strong> records miracles and foundation dates. Turn to any chapter in the physical book, select the corresponding chapter page below, and click <strong>"Scan Book Page"</strong> to activate the camera overlay.
              </p>
            </div>

            {/* Page Selectors */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-[#8A8A70] uppercase tracking-wider pl-1">
                Select Book Page to Scan
              </h4>

              <div className="space-y-2">
                {AGOS_BOOK_PAGES.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPageId(page.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex gap-3 items-center transition-all ${
                      selectedPageId === page.id
                        ? "bg-white border-[#5A5A40] shadow-xs"
                        : "bg-[#EBEBE0]/40 border-[#D6D6C2] hover:bg-white"
                    }`}
                  >
                    <span className="h-7 w-7 rounded-full bg-[#EBEBE0] text-[#5A5A40] flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-[#D6D6C2]">
                      {page.pageNumber}
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-[#4A4A35] font-serif italic">
                        {page.title}
                      </h5>
                      <p className="text-[10px] text-[#8A8A70] line-clamp-1 font-sans">
                        {page.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scan Launcher button */}
            <button
              onClick={handleStartScan}
              className="w-full py-3.5 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-xs font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-1.5 shadow-sm border border-[#4A4A35] transition-all"
            >
              <Camera className="w-4.5 h-4.5" /> Initialize AR Lens Scanner
            </button>
          </div>
        )}

        {/* Figure 37 Style: Camera Authorization box */}
        {arState === "requesting" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-6 text-center max-w-xs space-y-4 shadow-xl">
              <div className="h-12 w-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mx-auto text-[#5A5A40]">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">
                  "SanctiWalk" would like to Access the Camera
                </h4>
                <p className="text-xs text-gray-500 leading-normal">
                  To scan parish book markers, history booklets, and holy altars to display immersive 3D AR content.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDenyPermission}
                  className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-xl transition-colors"
                >
                  Don't Allow
                </button>
                <button
                  onClick={handleGrantPermission}
                  className="py-2 px-4 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-xs font-bold uppercase rounded-xl transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Camera Viewfinder */}
        {(arState === "scanning" || arState === "rendering") && (
          <div className="flex-1 bg-black rounded-3xl overflow-hidden relative min-h-[300px] flex flex-col items-center justify-center">
            {/* Camera Simulated background: dynamic rotating book illustration */}
            <div className="absolute inset-0 bg-[#33332D]/90 flex flex-col items-center justify-center text-center p-6 space-y-4 select-none">
              <BookOpen className="w-20 h-20 text-[#C2A649]/40 animate-pulse" />
              <div className="space-y-1">
                <p className="text-xs text-[#EBEBE0] font-mono">TARGETING BOOK MARKER...</p>
                <p className="text-[10px] text-[#8A8A70] font-bold uppercase tracking-wider">Agos Chapter Page {activePage.pageNumber}</p>
              </div>
            </div>

            {/* Blue animated sweeping scan line */}
            {arState === "scanning" && (
              <div className="absolute inset-x-0 h-1 bg-cyan-400 shadow-md shadow-cyan-300 animate-bounce"></div>
            )}

            {/* High-quality scanning overlay */}
            <div className="absolute inset-6 border-2 border-white/20 rounded-xl flex items-center justify-center">
              <div className="h-10 w-10 border-t-2 border-l-2 border-cyan-400 absolute top-0 left-0"></div>
              <div className="h-10 w-10 border-t-2 border-r-2 border-cyan-400 absolute top-0 right-0"></div>
              <div className="h-10 w-10 border-b-2 border-l-2 border-cyan-400 absolute bottom-0 left-0"></div>
              <div className="h-10 w-10 border-b-2 border-r-2 border-cyan-400 absolute bottom-0 right-0"></div>
              
              <p className="text-[10px] text-cyan-400 font-bold font-mono tracking-wider animate-pulse uppercase">
                {arState === "scanning" ? "Detecting marker..." : "Rendering 3D Overlay..."}
              </p>
            </div>
          </div>
        )}

        {/* Scan Completed: 3D Hologram projection overlay + Audio Guide */}
        {arState === "completed" && (
          <div className="space-y-4 flex-1">
            {/* Hologram card */}
            <div className="bg-gradient-to-b from-[#33332D] to-[#22221E] text-white p-5 rounded-3xl shadow-lg border border-[#D6D6C2]/20 space-y-4 relative overflow-hidden text-center">
              {/* Particle Sparks */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,166,73,0.15),transparent)] animate-pulse"></div>

              <span className="text-[9px] bg-[#C2A649] text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest mx-auto block w-fit">
                AR Overlay Connected
              </span>

              {/* 3D Holographic SVG Representation */}
              <div className="h-32 flex items-center justify-center relative">
                <div className="absolute h-24 w-24 rounded-full border border-[#C2A649]/20 animate-ping" style={{ animationDuration: "3s" }}></div>
                <div className="h-20 w-20 rounded-full bg-[#5A5A40]/40 border border-[#C2A649] flex items-center justify-center shadow-lg relative z-10 animate-bounce" style={{ animationDuration: "4s" }}>
                  <Sparkles className="w-10 h-10 text-[#C2A649] fill-current" />
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <h4 className="text-xs font-bold text-[#C2A649] font-mono tracking-widest uppercase">
                  {activePage.arModelName}
                </h4>
                <p className="text-xs text-[#EBEBE0] font-sans leading-relaxed text-justify px-2 italic">
                  "{activePage.overlayText}"
                </p>
              </div>
            </div>

            {/* Audio Tour Guide Panel */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <h5 className="text-[10px] font-bold text-[#8A8A70] uppercase tracking-wider flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-[#5A5A40]" /> Audio Tour Guide Narrator
                </h5>
                <span className="text-[9px] font-mono font-bold text-[#5A5A40] bg-[#EBEBE0] px-2 py-0.5 rounded">
                  Voice Guide v1.0
                </span>
              </div>

              {/* Audio Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="h-10 w-10 rounded-full bg-[#5A5A40] text-white hover:bg-[#4A4A35] flex items-center justify-center shrink-0 shadow-xs border border-[#4A4A35]"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-current text-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5 text-white" />
                  )}
                </button>

                {/* Progress soundwave */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-end gap-0.5 h-6 select-none">
                    {Array.from({ length: 30 }).map((_, i) => {
                      const isActive = (i / 30) * 100 <= audioProgress;
                      const randomHeight = isPlayingAudio ? Math.floor(Math.random() * 16) + 6 : 8;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            isActive ? "bg-[#5A5A40]" : "bg-[#D6D6C2]"
                          }`}
                          style={{ height: `${randomHeight}px` }}
                        ></div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-[#8A8A70]">
                    <span>Playing: Ch {activePage.pageNumber} Guide</span>
                    <span>{Math.floor(audioProgress)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Spiritual Reflection Prompt & Entry */}
            <div className="bg-[#EBEBE0]/30 rounded-3xl border border-[#D6D6C2] p-4 space-y-3">
              <div className="space-y-1">
                <h5 className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                  Spiritual Contemplation
                </h5>
                <p className="text-xs text-[#33332D] font-sans leading-relaxed italic text-justify">
                  "{activePage.reflectionPrompt}"
                </p>
              </div>

              {isReflectionSaved ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                  <span className="text-[10px] font-bold text-green-900 font-sans leading-relaxed">
                    Reflection logged to Passport and points rewarded (+150 pts bonus)!
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSaveReflection} className="space-y-2">
                  <textarea
                    rows={2}
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    placeholder="Type your personal spiritual thoughts here..."
                    className="w-full bg-white border border-[#D6D6C2] rounded-2xl p-2.5 text-xs outline-none text-[#33332D] font-sans resize-none placeholder-[#8A8A70]"
                  />
                  <button
                    type="submit"
                    disabled={!reflectionText}
                    className="w-full py-2 bg-[#5A5A40] hover:bg-[#4A4A35] disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-wider rounded-full border border-[#4A4A35] transition-colors"
                  >
                    Post Pilgrim Reflection Notes
                  </button>
                </form>
              )}
            </div>

            {/* Scan Another book page */}
            <button
              onClick={handleReset}
              className="w-full py-2.5 bg-[#EBEBE0] border border-[#D6D6C2] text-[#5A5A40] text-xs font-bold uppercase tracking-wider rounded-full hover:bg-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Scan Another Book Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
