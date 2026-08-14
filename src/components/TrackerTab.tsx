import React from "react";
import { BADGES } from "../data";
import { UserProgress } from "../types";
import { Award, Footprints, Flame, CheckCircle, Milestone } from "lucide-react";

interface TrackerTabProps {
  progress: UserProgress;
}

export default function TrackerTab({ progress }: TrackerTabProps) {
  // Compute percentage of badges completed
  const earnedBadgesCount = progress.badges.length;
  const progressPercent = Math.min(100, Math.round((earnedBadgesCount / BADGES.length) * 100));

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] pb-20 select-none">
      {/* Tracker Hero */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm flex flex-col justify-between border-b border-[#D6D6C2]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#C2A649] font-serif italic uppercase tracking-wider">
              Pilgrim Stamp Passport
            </h3>
            <h2 className="text-xl font-bold font-serif italic tracking-tight mt-0.5">
              Your SanctiWalk Journey
            </h2>
          </div>
          <div className="h-10 w-10 bg-[#EBEBE0]/15 border border-[#C2A649] rounded-full flex items-center justify-center">
            <Award className="w-5 h-5 text-[#C2A649]" />
          </div>
        </div>

        {/* Core Stats Overview */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-[#EBEBE0]/15 backdrop-blur-xs p-3 rounded-xl border border-[#D6D6C2]/20 text-center space-y-1">
            <Footprints className="w-4 h-4 text-[#C2A649] mx-auto" />
            <span className="block text-[9px] text-[#EBEBE0] uppercase font-mono">Steps</span>
            <strong className="text-sm font-sans font-bold block">{progress.steps.toLocaleString()}</strong>
          </div>
          <div className="bg-[#EBEBE0]/15 backdrop-blur-xs p-3 rounded-xl border border-[#D6D6C2]/20 text-center space-y-1">
            <Milestone className="w-4 h-4 text-[#C2A649] mx-auto" />
            <span className="block text-[9px] text-[#EBEBE0] uppercase font-mono">Distance</span>
            <strong className="text-sm font-sans font-bold block">{progress.distanceKm.toFixed(2)} km</strong>
          </div>
          <div className="bg-[#EBEBE0]/15 backdrop-blur-xs p-3 rounded-xl border border-[#D6D6C2]/20 text-center space-y-1">
            <Flame className="w-4 h-4 text-[#C2A649] mx-auto" />
            <span className="block text-[9px] text-[#EBEBE0] uppercase font-mono">Points</span>
            <strong className="text-sm font-sans font-bold block">{progress.points} pts</strong>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Passport stamps list */}
        <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#8A8A70] uppercase tracking-wider font-serif italic">
            Active Digital Stamps ({progress.completedStations.length})
          </h3>
          
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((stampNum) => {
              const isStamped = progress.completedStations.length >= stampNum;
              return (
                <div
                  key={stampNum}
                  className={`aspect-square rounded-full border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all ${
                    isStamped
                      ? "border-[#C2A649]/65 bg-[#EBEBE0]/40 text-[#5A5A40] scale-100 shadow-xs"
                      : "border-dashed border-[#D6D6C2] bg-[#F5F5F0]/50 text-[#8A8A70]"
                  }`}
                >
                  {isStamped ? (
                    <div className="text-center p-1">
                      <div className="text-[13px] font-bold font-serif italic uppercase tracking-tighter leading-none text-[#5A5A40]">
                        STI
                      </div>
                      <div className="text-[8px] font-mono uppercase font-bold text-[#C2A649] scale-90 leading-none mt-0.5">
                        VSTD
                      </div>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 absolute bottom-1 right-1" />
                    </div>
                  ) : (
                    <span className="text-xs font-mono font-bold opacity-60 text-[#8A8A70]">0{stampNum}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[#8A8A70] text-center font-sans mt-1 leading-normal">
            *Scan QR codes or check-in at individual trail locations to collect pilgrim stamps!
          </p>
        </div>

        {/* Progress ring slider */}
        <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#8A8A70] uppercase tracking-wider font-serif italic">
              Milestone Badges ({earnedBadgesCount}/{BADGES.length})
            </h3>
            <span className="text-[10px] font-bold font-mono text-[#5A5A40] bg-[#EBEBE0] px-2.5 py-1 rounded-full border border-[#D6D6C2]/55">
              {progressPercent}% Complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#EBEBE0] h-2 rounded-full overflow-hidden border border-[#D6D6C2]/40">
            <div
              className="bg-gradient-to-r from-[#5A5A40] to-[#C2A649] h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* Badge Gallery */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {BADGES.map((badge) => {
              const isEarned = progress.badges.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`p-3 rounded-2xl border flex gap-2.5 items-start transition-all ${
                    isEarned
                      ? "border-[#C2A649]/40 bg-[#EBEBE0]/20 shadow-xs"
                      : "border-[#D6D6C2] bg-[#F5F5F0]/40 opacity-55 grayscale"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                    isEarned ? "bg-[#EBEBE0] text-[#5A5A40] border-[#D6D6C2]" : "bg-white text-[#8A8A70] border-gray-100"
                  }`}>
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[11px] font-bold text-[#4A4A35] font-serif italic leading-tight">
                      {badge.name}
                    </h4>
                    <p className="text-[9px] text-[#8A8A70] leading-tight font-sans">
                      {badge.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
