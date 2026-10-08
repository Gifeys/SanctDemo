import { useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardList, LayoutDashboard, Megaphone, ToggleLeft, Archive,
  Church, PartyPopper, CalendarDays, BookOpen,
} from "lucide-react";

/**
 * The parish office's own navigation.
 *
 * ## Why every item is a word and an icon, never an icon alone
 *
 * The person using this is a parish secretary, not a developer. An icon
 * is a guess until you have clicked it once; a word is not. The previous
 * version had Announcements and Archive as two unlabelled-looking
 * buttons tucked beside Sign out in the header, and the client could not
 * tell what either did.
 *
 * ## Why only the sections that exist are here
 *
 * Mass Schedule, Feast Days and Notifications are coming, and a nav item
 * that opens nothing is worse than a missing one - it teaches people the
 * admin is broken. They go in when the pages behind them do.
 */

export interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Matched as a prefix, so a detail page keeps its section highlighted. */
  match?: string;
}

const ITEMS: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  {
    to: "/admin/applications",
    label: "Applications",
    icon: <ClipboardList className="w-4 h-4" />,
    match: "/admin/applications",
  },
  {
    to: "/admin/availability",
    label: "Open & closed",
    icon: <ToggleLeft className="w-4 h-4" />,
  },
  {
    to: "/admin/announcements",
    label: "Announcements",
    icon: <Megaphone className="w-4 h-4" />,
  },
  {
    to: "/admin/mass-schedule",
    label: "Mass Schedule",
    icon: <Church className="w-4 h-4" />,
  },
  {
    to: "/admin/announcements/feasts",
    label: "Feast Days",
    icon: <PartyPopper className="w-4 h-4" />,
  },
  {
    to: "/admin/announcements/events",
    label: "Events",
    icon: <CalendarDays className="w-4 h-4" />,
  },
  {
    to: "/admin/content",
    label: "What people read",
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    to: "/admin/applications/archive",
    label: "Archive",
    icon: <Archive className="w-4 h-4" />,
  },
];

export default function AdminNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Three of these are prefixes of another, so a plain startsWith would
  // light up two or three chips at once. Exact wins, and the two
  // sub-boards are checked before the section they live under.
  function isOn(item: NavItem): boolean {
    if (pathname === item.to) return true;
    if (item.to === "/admin/applications") {
      return pathname.startsWith("/admin/applications/")
        && !pathname.startsWith("/admin/applications/archive");
    }
    if (item.to === "/admin/announcements") {
      // The board routes have their own chips.
      return false;
    }
    return false;
  }

  return (
    <nav aria-label="Parish office" className="admin-nav print:hidden">
      {ITEMS.map(item => {
        const on = isOn(item);
        return (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            aria-current={on ? "page" : undefined}
            className={`admin-nav__item${on ? " is-on" : ""}`}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
