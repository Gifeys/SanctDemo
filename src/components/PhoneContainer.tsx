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
    <div id="phone-container" className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto px-4 py-6">
      {/* Sidebar Controls & Capstone Guide */}
      <div className="flex-1 flex flex-col justify-between space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2.5 py-1 bg-[#EBEBE0] text-[#5A5A40] text-xs font-bold rounded-full uppercase tracking-wider font-serif italic border border-[#D6D6C2]">
              STI Capstone 1-2 Scope
            </span>
            <span className="flex items-center gap-1 text-xs text-[#5A5A40] bg-[#EBEBE0] px-2 py-1 rounded-full font-medium border border-[#D6D6C2]">
              <ShieldCheck className="w-3.5 h-3.5" /> PWA Certified
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold font-serif italic text-[#4A4A35] tracking-tight leading-tight">
            SanctiWalk <span className="text-[#5A5A40] not-italic">PWA</span>
          </h1>
          <p className="text-sm text-[#8A8A70] mt-2 max-w-xl leading-relaxed font-sans">
            A beautiful, fully-responsive walking tour & pilgrimage companion. 
            Because iOS development requires macOS & Apple credentials, changing your Capstone 2 
            scope to a <strong className="text-[#5A5A40]">Progressive Web App (PWA)</strong> is the perfect, industry-standard 
            solution to deploy cross-platform seamlessly from a Windows setup!
          </p>
        </div>

        {/* Device Mode Switcher */}
        <div className="bg-[#EBEBE0] p-5 rounded-2xl border border-[#D6D6C2] shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-[#4A4A35] flex items-center gap-2 font-serif italic">
            <Cpu className="w-4 h-4 text-[#5A5A40]" /> Interactive Simulation Controls
          </h3>
          <p className="text-xs text-[#8A8A70] leading-normal">
            Toggle settings to test how SanctiWalk behaves on different viewports and offline environments.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              id="btn-toggle-mobile"
              onClick={() => setIsMobileOnly(true)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                isMobileOnly
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                  : "bg-[#F5F5F0] text-[#8A8A70] border-[#D6D6C2] hover:bg-[#EBEBE0]"
              }`}
            >
              <Smartphone className="w-4 h-4" /> Smartphone Frame
            </button>
            <button
              id="btn-toggle-responsive"
              onClick={() => setIsMobileOnly(false)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                !isMobileOnly
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                  : "bg-[#F5F5F0] text-[#8A8A70] border-[#D6D6C2] hover:bg-[#EBEBE0]"
              }`}
            >
              <Monitor className="w-4 h-4" /> Full Responsive
            </button>
          </div>

          <div className="border-t border-[#D6D6C2] pt-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#4A4A35]">Simulate Offline Mode</span>
              <span className="text-[10px] text-[#8A8A70]">Tests Service Worker client fallback</span>
            </div>
            <button
              id="btn-toggle-offline"
              onClick={() => setIsOffline(!isOffline)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                isOffline
                  ? "bg-[#C2A649]/20 text-[#C2A649] border-[#C2A649]/55 animate-pulse"
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
        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#D6D6C2] space-y-3 shadow-xs">
          <h4 className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest font-serif italic">
            Capstone Defense Bulletin
          </h4>
          <ul className="text-xs text-[#33332D] space-y-2 list-disc list-inside leading-relaxed font-sans">
            <li><strong className="text-[#4A4A35]">Zero App Store Tax:</strong> PWAs bypass Apple App Store ($99/year fee) & Google Play Console, distributing instantly via URL.</li>
            <li><strong className="text-[#4A4A35]">Storage footprint:</strong> Weighs under 3MB compared to 80MB+ native builds.</li>
            <li><strong className="text-[#4A4A35]">Hardware Access:</strong> Securely triggers Geolocation and Camera natively without compilation on a Mac.</li>
          </ul>
        </div>
      </div>

      {/* Main Container Render */}
      <div className="flex justify-center items-center">
        {isMobileOnly ? (
          /* High Fidelity Smartphone Mockup */
          <div className="relative mx-auto w-[385px] h-[780px] bg-[#1a1a1a] rounded-[54px] shadow-2xl border-[12px] border-[#2e2e2e] flex flex-col overflow-hidden ring-4 ring-[#1f1f1f]">
            {/* Speaker Notching & Camera Hole */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[30px] w-[140px] bg-black rounded-b-[18px] z-50 flex items-center justify-center">
              <div className="w-[40px] h-[4px] bg-[#222] rounded-full absolute top-[6px]"></div>
              <div className="w-[8px] h-[8px] bg-[#111] rounded-full absolute right-[24px] top-[4px] ring-2 ring-[#222]"></div>
            </div>

            {/* Simulated Phone Status Bar */}
            <div className="h-[44px] bg-[#EBEBE0] border-b border-[#D6D6C2]/40 text-[#33332D] px-6 flex items-end justify-between pb-1.5 text-xs font-semibold select-none z-40 shrink-0">
              <span>{currentTime || "10:00 AM"}</span>
              <div className="flex items-center gap-1.5">
                {isOffline ? (
                  <WifiOff className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-green-700" />
                )}
                <span className="text-[10px]">LTE</span>
                <Battery className="w-4 h-4 text-gray-800 rotate-90 scale-90 translate-y-[1px]" />
                <span className="text-[10px]">98%</span>
              </div>
            </div>

            {/* Virtual App Screen Canvas */}
            <div className="flex-1 bg-[#F5F5F0] flex flex-col overflow-y-auto relative z-30">
              {children}
            </div>

            {/* iOS Bottom Navigation Bar Handle Indicator */}
            <div className="h-[24px] bg-[#EBEBE0] border-t border-[#D6D6C2]/40 flex items-center justify-center pb-2 shrink-0 z-40">
              <div className="w-[120px] h-[5px] bg-gray-300 rounded-full"></div>
            </div>
          </div>
        ) : (
          /* Desktop Responsive Frame (Max width styled container) */
          <div className="w-full lg:w-[460px] min-h-[680px] h-[750px] bg-[#FFFFFF] rounded-2xl border border-[#D6D6C2] shadow-xl flex flex-col overflow-hidden relative">
            {/* Standard Mini Header for Responsive simulation */}
            <div className="bg-[#5A5A40] text-white px-4 py-2 flex items-center justify-between text-xs font-serif italic">
              <div className="flex items-center gap-1.5 font-medium">
                <span>SanctiWalk Web View</span>
                {isOffline && <span className="bg-[#C2A649] text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Offline</span>}
              </div>
              <span className="opacity-85 text-[10px] font-mono">100% Fluid Width</span>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-[#F5F5F0] flex flex-col">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
