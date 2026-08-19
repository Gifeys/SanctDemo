import { MapPin } from "lucide-react";
import { usePresence } from "../context/PresenceContext";

// Sits just below the app's own h-14 (56px) header bar so it never covers the
// screen heading beneath it — that exact overlap bug was found in the source
// app. Positioned `absolute` against the nearest positioned ancestor (the
// relative "Main App Frame inside simulator" div in App.tsx), which is bounded
// by PhoneContainer's screen canvas — never `fixed`, or it would escape the
// phone frame and float over the whole browser window on desktop.
export default function PresenceBanner() {
  const { presence, parish } = usePresence();

  if (presence.mode !== "approaching" || !parish) return null;

  return (
    <div
      className="absolute top-14 inset-x-0 z-40 px-4 py-2.5 flex items-center gap-2 shadow-sm transition-all duration-300 ease-out bg-[var(--color-brand-primary)] border-b border-[var(--color-brand-border)]"
      role="status"
    >
      <MapPin className="w-4 h-4 text-[var(--color-brand-card)] shrink-0" />
      <p className="text-[15px] leading-snug text-[var(--color-brand-card)] font-sans">
        You are approaching <strong className="font-bold text-white">{parish.name.replace(" Guide", "").replace(" Tour", "")}</strong>
      </p>
    </div>
  );
}
