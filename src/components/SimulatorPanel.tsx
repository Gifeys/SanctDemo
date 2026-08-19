import { X, Navigation, MapPin, Satellite, Ruler } from "lucide-react";
import { usePresence, SIMULATIONS } from "../context/PresenceContext";

interface SimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// This panel is deliberately reachable from the app's own navigation, not
// hidden behind a debug flag — it is how presence gets demonstrated in a
// defense room where real GPS is nowhere near either parish.
export default function SimulatorPanel({ isOpen, onClose }: SimulatorPanelProps) {
  const { presence, parish, position, gpsStatus, simulation, setSimulation } = usePresence();

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-5 bg-black/60 transition-opacity duration-300 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#5FC7DE]/30 bg-[#151B53] text-white shadow-2xl transition-all duration-300 ease-out font-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-[#5FC7DE]" />
            <h2 className="text-base font-bold tracking-tight font-primary">Location Simulator</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close location simulator"
            className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Simulation options */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <MapPin className="w-3.5 h-3.5" />
              <span>Simulated Position</span>
            </div>
            <div role="radiogroup" aria-label="Simulated position" className="space-y-2">
              {SIMULATIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 min-h-11 px-3 py-2 rounded-xl border cursor-pointer transition-colors duration-300 ${
                    simulation === opt.value
                      ? "bg-[#106a7d] border-[#5FC7DE]/80 text-white shadow-[0_0_20px_rgba(24,134,160,0.4)]"
                      : "bg-transparent border-white/25 text-white/90 hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="presence-simulation"
                    value={opt.value}
                    checked={simulation === opt.value}
                    onChange={() => setSimulation(opt.value)}
                    className="w-4 h-4 accent-[#5FC7DE] shrink-0"
                  />
                  <span className="text-base font-bold">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Live readout */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <Satellite className="w-3.5 h-3.5" />
              <span>Live Readout</span>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/5 p-3 space-y-1.5 text-[15px] font-mono">
              <div className="flex justify-between gap-2">
                <span className="text-white/70">Mode</span>
                <span className="font-bold text-white uppercase">{presence.mode}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/70">Parish</span>
                <span className="font-bold text-white text-right">{parish ? parish.name.replace(" Guide", "").replace(" Tour", "") : "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/70 flex items-center gap-1"><Ruler className="w-3 h-3" /> Distance</span>
                <span className="font-bold text-white">
                  {presence.distance != null ? `${Math.round(presence.distance)} m` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/70">GPS Status</span>
                <span className="font-bold text-white uppercase">{gpsStatus}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/70">Position</span>
                <span className="font-bold text-white text-right">
                  {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-white/70 leading-snug">
            Real GPS is used automatically whenever simulation is "Off". This panel exists for defense-room
            demonstrations where the diocese's parishes are out of reach.
          </p>
        </div>
      </div>
    </div>
  );
}
