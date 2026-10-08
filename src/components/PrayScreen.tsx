import DailyRosary from "./DailyRosary";
import type { Route } from "../types";

interface PrayScreenProps {
  /**
   * Kept so the tab's call site does not have to change, and because the
   * rosary will want to know whose parish it is the moment it carries a
   * parish's own intentions. Unused today.
   */
  parish?: Route;
  /**
   * Also unused now. The rosary app brings its own settings control - the
   * gear in its top corner - so a second one above it was two ways into
   * the same panel.
   */
  onOpenSettings?: () => void;
}

/**
 * Pray opens straight into the rosary.
 *
 * It used to land on a page ABOUT the rosary: a parish band, the verse of
 * the day, the day's mysteries written out, and a button that finally
 * started the thing. Four screens' worth of preamble in front of the one
 * thing the tab is named after.
 *
 * The verse moved to Home's bulletin rail, where someone is already
 * browsing and reading is the point. The rest is gone. Tapping Pray is a
 * decision to pray, not a request for a table of contents.
 *
 * DailyRosary is the client's own rosary app, mounted in an iframe. It has
 * its own heading, its own settings gear and its own "Begin today's
 * Rosary" - which is exactly why a second header above it made this feel
 * like a page rather than a prayer.
 */
export default function PrayScreen(_props: PrayScreenProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-brand-card)]">
      <DailyRosary />
    </div>
  );
}
