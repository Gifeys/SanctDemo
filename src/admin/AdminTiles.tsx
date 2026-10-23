import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Megaphone, ToggleLeft, Archive, Church,
  PartyPopper, CalendarDays, BookOpen, BarChart3, Search,
} from "lucide-react";

/**
 * The office, as a board of doors.
 *
 * ## Why a grid of tiles and not just the nav
 *
 * AdminNav is a row of small chips. It is fine once you know the place,
 * and poor on the first morning: nine words in a line, all the same
 * size, with nothing to say which one you probably want. A parish
 * secretary opening this for the first time needs to see the whole
 * office at once and recognise a door by its shape.
 *
 * The nav stays. This is for arriving; the nav is for moving around
 * once you have.
 *
 * ## Why icons AND words, at this size
 *
 * The same rule AdminNav already states: an icon is a guess until you
 * have clicked it once, a word is not. So every tile carries both, and
 * the icon is large enough to be recognised from a lean-back distance
 * rather than decorating the label.
 *
 * ## Why the ribbon says what it says
 *
 * The reference design this follows puts a ribbon on every tile reading
 * "System", which tells a user nothing. Here it carries the one fact
 * that changes what you do next: whether a section is something the
 * parish fills in itself, or something the app keeps on its own.
 */

interface TileDef {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** What the parish actually does here - used by the search box. */
  keywords: string;
  ribbon: "Parish" | "Automatic";
}

const TILES: TileDef[] = [
  {
    to: "/parish-office-gav8thhe/applications",
    label: "Applications",
    icon: <ClipboardList />,
    keywords: "applications ministry sacrament baptism wedding approve reject pending binyag kasal aplikasyon ministeryo",
    ribbon: "Parish",
  },
  {
    to: "/parish-office-gav8thhe/mass-schedule",
    label: "Mass Schedule",
    icon: <Church />,
    keywords: "mass schedule times sunday weekday misa oras linggo iskedyul",
    ribbon: "Parish",
  },
  {
    to: "/parish-office-gav8thhe/announcements",
    label: "Announcements",
    icon: <Megaphone />,
    keywords: "announcements bulletin notice post feast days events calendar patalastas abiso kapistahan pista kaganapan",
    ribbon: "Parish",
  },
  // Ministries and Sacraments replace three tiles: "What People Read",
  // which edited the descriptions of both, and "Open & Closed", which
  // switched applications for both. Those were two screens describing
  // one thing, so the parish had to visit both to finish a job.
  //
  // Feast Days and Events are gone from here too. They are boards on
  // the Announcements page, reachable from it, and three tiles for one
  // page is three places to look for the same thing.
  {
    to: "/parish-office-gav8thhe/ministries",
    label: "Ministries",
    icon: <BookOpen />,
    keywords: "ministries ministry open closed accepting applications description requirements choir lector ministeryo",
    ribbon: "Parish",
  },
  {
    to: "/parish-office-gav8thhe/sacraments",
    label: "Sacraments",
    icon: <ToggleLeft />,
    keywords: "sacraments baptism wedding confirmation open closed accepting applications binyag kasal kumpil",
    ribbon: "Parish",
  },
  {
    to: "/parish-office-gav8thhe/analytics",
    label: "Visitor Activity",
    icon: <BarChart3 />,
    keywords: "analytics visitors activity statistics numbers",
    ribbon: "Automatic",
  },
  {
    to: "/parish-office-gav8thhe/applications/archive",
    label: "Archive",
    icon: <Archive />,
    keywords: "archive old finished completed past",
    ribbon: "Automatic",
  },
];

export default function AdminTiles({ parishName }: { parishName: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TILES;
    // Matched against the keywords as well as the label, so "binyag" or
    // "oras" finds the right door for somebody who does not think in the
    // app's English section names.
    return TILES.filter(
      t => t.label.toLowerCase().includes(q) || t.keywords.includes(q),
    );
  }, [query]);

  return (
    <section className="admin-board">
      <h2 className="admin-board__title">{parishName} Dashboard</h2>

      <form
        className="admin-board__search"
        role="search"
        onSubmit={e => {
          e.preventDefault();
          // Enter on a single result opens it. With several, or none,
          // the list on screen is already the answer.
          if (shown.length === 1) navigate(shown[0].to);
        }}
      >
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search the office, e.g. Mass"
          aria-label="Search admin sections"
          className="admin-board__input"
        />
        <button type="submit" className="admin-board__go" aria-label="Search">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {shown.length === 0 ? (
        <p className="admin-board__empty">
          Nothing here matches “{query}”. Try “mass”, “applications” or “history”.
        </p>
      ) : (
        <ul className="admin-board__grid">
          {shown.map(tile => (
            <li key={tile.to}>
              <button
                type="button"
                onClick={() => navigate(tile.to)}
                className="admin-tile"
              >
                <span
                  className={`admin-tile__ribbon admin-tile__ribbon--${tile.ribbon.toLowerCase()}`}
                  aria-hidden
                >
                  {tile.ribbon}
                </span>
                <span className="admin-tile__icon" aria-hidden>
                  {tile.icon}
                </span>
                <span className="admin-tile__label">{tile.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
