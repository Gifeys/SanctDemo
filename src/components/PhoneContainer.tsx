import React, { useState, useEffect } from "react";
import { Smartphone, Monitor, ShieldCheck, Cpu, Wifi, WifiOff, Battery, RefreshCw } from "lucide-react";

interface PhoneContainerProps {
  children: React.ReactNode;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  isMobileOnly: boolean;
  setIsMobileOnly: (mobileOnly: boolean) => void;
}

export default function PhoneContainer({
  children,
  isOffline,
  setIsOffline,
  isMobileOnly,
  setIsMobileOnly
}: PhoneContainerProps) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    // flex-col-reverse below lg: the phone is the second child, so reversing
    // puts the app itself at the top on narrow screens and pushes the capstone
    // guide beneath it. Without this the guide is the front door and the app
    // renders ~1200px down the page, which reads as "the feature is missing".
    // On lg and up the original side-by-side layout is unchanged.
    <div id="phone-container" className="flex flex-col-reverse lg:flex-row gap-6 w-full max-w-7xl mx-auto px-4 py-6">
      {/* Sidebar Controls & Capstone Guide */}
      <div className="flex-1 flex flex-col justify-between space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2.5 py-1 bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] text-[15px] font-bold rounded-full uppercase tracking-wider font-serif italic border border-[var(--color-brand-border)]">
              STI Capstone 1-2 Scope
            </span>
            <span className="flex items-center gap-1 text-[15px] text-[var(--color-brand-secondary)] bg-[var(--color-brand-card)] px-2 py-1 rounded-full font-medium border border-[var(--color-brand-border)]">
              <ShieldCheck className="w-3.5 h-3.5" /> PWA Certified
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold font-serif italic text-[var(--color-brand-text)] tracking-tight leading-tight">
            SanctiWalk <span className="text-[var(--color-brand-accent)] not-italic">PWA</span>
          </h1>
          <p className="text-base text-[var(--color-brand-secondary)] mt-2 max-w-xl leading-relaxed font-sans">
            A beautiful, fully-responsive walking tour & pilgrimage companion.
            Because iOS development requires macOS & Apple credentials, changing your Capstone 2
            scope to a <strong className="text-[var(--color-brand-text)]">Progressive Web App (PWA)</strong> is the perfect, industry-standard
            solution to deploy cross-platform seamlessly from a Windows setup!
          </p>
        </div>

        {/* Device Mode Switcher */}
        <div className="bg-[var(--color-brand-card)] p-5 rounded-2xl border border-[var(--color-brand-border)] shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-[var(--color-brand-text)] flex items-center gap-2 font-serif italic">
            <Cpu className="w-4 h-4 text-[var(--color-brand-secondary)]" /> Interactive Simulation Controls
          </h3>
          <p className="text-[15px] text-[var(--color-brand-secondary)] leading-normal">
            Toggle settings to test how SanctiWalk behaves on different viewports and offline environments.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              id="btn-toggle-mobile"
              onClick={() => setIsMobileOnly(true)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-[15px] font-bold uppercase tracking-wider transition-all border ${
                isMobileOnly
                  ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-xs"
                  : "bg-white text-[var(--color-brand-secondary)] border-[var(--color-brand-border)] hover:bg-[var(--color-brand-card)]"
              }`}
            >
              <Smartphone className="w-4 h-4" /> Smartphone Frame
            </button>
            <button
              id="btn-toggle-responsive"
              onClick={() => setIsMobileOnly(false)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-[15px] font-bold uppercase tracking-wider transition-all border ${
                !isMobileOnly
                  ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-xs"
                  : "bg-white text-[var(--color-brand-secondary)] border-[var(--color-brand-border)] hover:bg-[var(--color-brand-card)]"
              }`}
            >
              <Monitor className="w-4 h-4" /> Full Responsive
            </button>
          </div>

          <div className="border-t border-[var(--color-brand-border)] pt-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-[var(--color-brand-text)]">Simulate Offline Mode</span>
              <span className="text-sm text-[var(--color-brand-secondary)]">Tests Service Worker client fallback</span>
            </div>
            <button
              id="btn-toggle-offline"
              onClick={() => setIsOffline(!isOffline)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[15px] font-bold uppercase tracking-wider transition-all border ${
                isOffline
                  ? "bg-[var(--color-brand-gold)]/20 text-[var(--color-brand-gold)] border-[var(--color-brand-gold)]/55 animate-pulse"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" /> Offline State
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Online (Sim)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Defense Bulletins */}
        <div className="bg-[var(--color-brand-card)] p-5 rounded-2xl border border-[var(--color-brand-border)] space-y-3 shadow-xs">
          <h4 className="text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest font-serif italic">
            Capstone Defense Bulletin
          </h4>
          <ul className="text-[15px] text-[var(--color-brand-text)] space-y-2 list-disc list-inside leading-relaxed font-sans">
            <li><strong className="text-[var(--color-brand-text)]">Zero App Store Tax:</strong> PWAs bypass Apple App Store ($99/year fee) & Google Play Console, distributing instantly via URL.</li>
            <li><strong className="text-[var(--color-brand-text)]">Storage footprint:</strong> Weighs under 3MB compared to 80MB+ native builds.</li>
            <li><strong className="text-[var(--color-brand-text)]">Hardware Access:</strong> Securely triggers Geolocation and Camera natively without compilation on a Mac.</li>
          </ul>
        </div>
      </div>

      {/* Main Container Render */}
      <div className="flex justify-center items-center">
        {isMobileOnly ? (
          /* High Fidelity Smartphone Mockup */
          <div className="relative mx-auto w-[385px] h-[780px] bg-[var(--color-brand-ink-surface)] rounded-[54px] shadow-2xl border-[12px] border-[var(--color-brand-ink-surface)] flex flex-col overflow-hidden ring-4 ring-[var(--color-brand-ink-surface)]">
            {/* Speaker Notching & Camera Hole */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[30px] w-[140px] bg-black rounded-b-[18px] z-50 flex items-center justify-center">
              <div className="w-[40px] h-[4px] bg-[#222] rounded-full absolute top-[6px]"></div>
              <div className="w-[8px] h-[8px] bg-[#111] rounded-full absolute right-[24px] top-[4px] ring-2 ring-[#222]"></div>
            </div>

            {/* Simulated Phone Status Bar */}
            <div className="h-[44px] bg-[var(--color-brand-card)] border-b border-[var(--color-brand-border)]/40 text-[var(--color-brand-text)] px-6 flex items-end justify-between pb-1.5 text-[15px] font-semibold select-none z-40 shrink-0">
              <span>{currentTime || "10:00 AM"}</span>
              <div className="flex items-center gap-1.5">
                {isOffline ? (
                  <WifiOff className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-green-700" />
                )}
                <span className="text-sm">LTE</span>
                <Battery className="w-4 h-4 text-gray-800 rotate-90 scale-90 translate-y-[1px]" />
                <span className="text-sm">98%</span>
              </div>
            </div>

            {/* Virtual App Screen Canvas */}
            <div className="flex-1 bg-[var(--color-brand-card)] flex flex-col overflow-y-auto relative z-30">
              {children}
            </div>

            {/* iOS Bottom Navigation Bar Handle Indicator */}
            <div className="h-[24px] bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)]/40 flex items-center justify-center pb-2 shrink-0 z-40">
              <div className="w-[120px] h-[5px] bg-gray-300 rounded-full"></div>
            </div>
          </div>
        ) : (
          /* Desktop Responsive Frame (Max width styled container) */
          <div className="w-full lg:w-[460px] min-h-[680px] h-[750px] bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] shadow-xl flex flex-col overflow-hidden relative">
            {/* Standard Mini Header for Responsive simulation */}
            <div className="bg-[var(--color-brand-primary)] text-white px-4 py-2 flex items-center justify-between text-[15px] font-serif italic">
              <div className="flex items-center gap-1.5 font-medium">
                <span>SanctiWalk Web View</span>
                {isOffline && <span className="bg-[var(--color-brand-gold)] text-white text-sm px-1.5 py-0.5 rounded uppercase font-bold">Offline</span>}
              </div>
              <span className="opacity-85 text-sm font-mono">100% Fluid Width</span>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-[var(--color-brand-card)] flex flex-col">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
