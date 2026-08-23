import React from "react";
import { Church, Settings as SettingsIcon, Footprints, Ruler, Star, Award, ClipboardList } from "lucide-react";
import LoginModal from "./LoginModal";
import { UserProgress } from "../types";

type Application = {
  id: string;
  type: string;
  applicant: string;
  details: string;
  date: string;
  status: string;
};

interface MeTabProps {
  isLoggedIn: boolean;
  userEmail: string;
  isAdmin: boolean;
  userProgress: UserProgress;
  applications: Application[];
  onLoginSuccess: (email: string, isAdmin: boolean) => void;
  onLogout: () => void;
  onOpenChangeParish: () => void;
  onOpenRosarySettings: () => void;
}

// The bottom nav's fifth tab — assembled entirely from state the app
// already tracks (sign-in, applications, prayer/visit progress). No new
// account system, just one place to find what used to be scattered across
// the hamburger menu.
export default function MeTab({
  isLoggedIn,
  userEmail,
  isAdmin,
  userProgress,
  applications,
  onLoginSuccess,
  onLogout,
  onOpenChangeParish,
  onOpenRosarySettings,
}: MeTabProps) {
  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      <LoginModal
        onLoginSuccess={onLoginSuccess}
        onLogout={onLogout}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        isAdmin={isAdmin}
      />

      <div className="px-4 pb-4 space-y-4 font-sans">
        {/* Prayer / visit progress — always shown, signed in or not, since
            steps/points accrue locally regardless of account state. */}
        <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4.5 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-[#8A8A70] uppercase tracking-wider font-sans flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#5A5A40]" /> Your Pilgrimage
          </h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#EBEBE0]/60 rounded-2xl p-3 space-y-1">
              <Footprints className="w-4 h-4 text-[#5A5A40] mx-auto" />
              <p className="text-lg font-black text-[#4A4A35]">{userProgress.steps.toLocaleString()}</p>
              <p className="text-sm text-[#8A8A70] font-bold uppercase">Steps</p>
            </div>
            <div className="bg-[#EBEBE0]/60 rounded-2xl p-3 space-y-1">
              <Ruler className="w-4 h-4 text-[#5A5A40] mx-auto" />
              <p className="text-lg font-black text-[#4A4A35]">{userProgress.distanceKm.toFixed(2)}</p>
              <p className="text-sm text-[#8A8A70] font-bold uppercase">KM Walked</p>
            </div>
            <div className="bg-[#EBEBE0]/60 rounded-2xl p-3 space-y-1">
              <Star className="w-4 h-4 text-[#5A5A40] mx-auto" />
              <p className="text-lg font-black text-[#4A4A35]">{userProgress.points}</p>
              <p className="text-sm text-[#8A8A70] font-bold uppercase">Points</p>
            </div>
          </div>
          {userProgress.badges.length > 0 && (
            <p className="text-[15px] text-[#33332D]">
              {userProgress.badges.length} badge{userProgress.badges.length === 1 ? "" : "s"} earned
            </p>
          )}
        </div>

        {/* Applications — the pilgrim's own submissions (sacrament bookings,
            ministry sign-ups, station stamps). Firestore rules already scope
            this list to the signed-in uid (or everything, for an admin), so
            it renders as-is. */}
        {isLoggedIn && (
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4.5 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-[#8A8A70] uppercase tracking-wider font-sans flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-[#5A5A40]" /> My Applications
            </h4>
            {applications.length === 0 ? (
              <p className="text-[15px] text-[#8A8A70]">No applications submitted yet.</p>
            ) : (
              <div className="space-y-2.5">
                {applications.map((app) => (
                  <div key={app.id} className="border-b border-[#EBEBE0]/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <h5 className="font-bold text-[#4A4A35] text-[15px]">{app.type}</h5>
                      <span className="text-sm font-bold text-[#5A5A40] bg-[#EBEBE0] px-2 py-0.5 rounded-full shrink-0">
                        {app.status}
                      </span>
                    </div>
                    <p className="text-[15px] text-[#33332D] mt-0.5">{app.details}</p>
                    <p className="text-sm text-[#8A8A70] mt-0.5">{app.date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick links */}
        <div className="space-y-2">
          <button
            onClick={onOpenChangeParish}
            className="w-full bg-white p-3.5 rounded-2xl border border-[#D6D6C2] flex items-center gap-2.5 shadow-xs hover:border-[#5A5A40] text-left transition-colors text-base font-bold text-[#4A4A35]"
          >
            <Church className="w-4 h-4 text-[#5A5A40] shrink-0" />
            <span>Change Parish</span>
          </button>
          <button
            onClick={onOpenRosarySettings}
            className="w-full bg-white p-3.5 rounded-2xl border border-[#D6D6C2] flex items-center gap-2.5 shadow-xs hover:border-[#5A5A40] text-left transition-colors text-base font-bold text-[#4A4A35]"
          >
            <SettingsIcon className="w-4 h-4 text-[#5A5A40] shrink-0" />
            <span>Rosary Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
