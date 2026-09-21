import React, { useState, useEffect } from "react";
import { Smartphone, Monitor, Wifi, WifiOff, Battery } from "lucide-react";
import { useDeviceSurface } from "../lib/displayMode";

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

  // On a real phone there is nothing to simulate: the device IS the frame.
  // Drawing a mockup there cost most of the screen and made sign-in - which
  // covers the whole display - look like the app changing size.
  const deviceSurface = useDeviceSurface();

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

  if (deviceSurface) {
    // The app, and only the app, edge to edge. No toolbar, no notch, no
    // invented battery percentage, and no viewport switch - a phone cannot
    // usefully be shown "the desktop version" of a layout built for it.
    return <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] min-h-0">{children}</div>;
  }

  return (
    // A centred column: a slim toolbar, then the app. The page used to be a
    // two-column marketing layout — a "SanctiWalk PWA" headline, a paragraph
    // on why the capstone scope changed, and a defense bulletin — with the
    // app itself as a panel beside it. That is a page ABOUT the app, which is
    // why it read as a website rather than as the product on a laptop. The
    // writing has not been thrown away; it belongs in the defense document,
    // not wrapped around the running app.
    <div id="phone-container" className="flex flex-col items-center gap-4 w-full px-4 py-6">
      {/* The viewport switch, and nothing else. Two buttons plus the offline
          simulation, which is a real test of the service worker rather than
          promotional copy. */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <div className="flex items-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-1">
          <button
            id="btn-toggle-mobile"
            onClick={() => setIsMobileOnly(true)}
            aria-pressed={isMobileOnly}
            className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-[15px] font-semibold transition-all ${
              isMobileOnly
                ? "bg-[var(--color-brand-primary)] text-white"
                : "text-[var(--color-brand-secondary)]"
            }`}
          >
            <Smartphone className="w-4 h-4" /> Phone
          </button>
          <button
            id="btn-toggle-responsive"
            onClick={() => setIsMobileOnly(false)}
            aria-pressed={!isMobileOnly}
            className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-[15px] font-semibold transition-all ${
              !isMobileOnly
                ? "bg-[var(--color-brand-primary)] text-white"
                : "text-[var(--color-brand-secondary)]"
            }`}
          >
            <Monitor className="w-4 h-4" /> Full responsive
          </button>
        </div>

        <button
          id="btn-toggle-offline"
          onClick={() => setIsOffline(!isOffline)}
          aria-pressed={isOffline}
          title="Simulate offline, to test the service worker fallback"
          className={`flex items-center gap-1.5 py-2 px-3.5 rounded-full text-[15px] font-semibold transition-all border ${
            isOffline
              ? "bg-[var(--color-brand-gold)]/20 text-[var(--color-brand-gold)] border-[var(--color-brand-gold)]/55"
              : "bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] border-[var(--color-brand-border)]"
          }`}
        >
          {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          {isOffline ? "Offline" : "Online"}
        </button>
      </div>

      {/* Main Container Render */}
      <div className="flex justify-center items-center w-full">
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
          /* Full responsive: the app filling the window, with no simulated
             browser chrome around it. It used to be capped at 460px behind a
             navy "SanctiWalk Web View" bar, which is a picture of a web view
             rather than the app actually being responsive. */
          <div className="w-full max-w-[900px] h-[calc(100vh-140px)] min-h-[560px] bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] shadow-xl flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto bg-[var(--color-brand-card)] flex flex-col">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
