/**
 * The first-run walkthrough, as data.
 *
 * ## Why the steps are a list and not a component each
 *
 * Ten steps written as ten pieces of JSX is ten places to change the
 * wording, ten chances for one card to look unlike the others, and no
 * way to answer "how many steps are there" without counting them by
 * hand. As data, the progress dots, the Back button's bounds and the
 * skipping below all fall out of the array's length.
 *
 * ## Why a step can name a tab
 *
 * Half of what the tutorial points at is not on the screen it starts
 * on. A step that needs the Me tab says so, and the runner switches
 * before it looks for the target - rather than the tutorial quietly
 * failing on step eight because the thing it wants is one tap away.
 */

export type TutorialTab = "home" | "navigator" | "ar" | "rosary" | "me";

export interface TutorialStep {
  /** The `data-spotlight` name to put the hole around. */
  target: string;
  title: string;
  body: string;
  /** Switch here first. Omitted means stay where we are. */
  tab?: TutorialTab;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: "pick-church",
    tab: "home",
    title: "Pick a church",
    body: "Tap here to search any parish in the diocese. Everything else on this screen then belongs to the church you picked.",
  },
  {
    target: "tab-home",
    tab: "home",
    title: "Home",
    body: "Your parish's front page — the verse of the day, what the office has announced, and the next Mass.",
  },
  {
    target: "tab-map",
    tab: "home",
    title: "Map",
    body: "Every parish on a map, with walking directions. Plan a Visita Iglesia and it will measure the walk between stops.",
  },
  {
    target: "tab-scan",
    tab: "home",
    title: "Scan",
    body: "Point your camera at a statue, an image or a marker and the app will tell you what it is. The AR tour starts from here too.",
  },
  {
    target: "church-info",
    tab: "home",
    title: "Church information",
    body: "The parish's own history and story, written by the parish office rather than by us.",
  },
  {
    target: "mass-schedule",
    tab: "home",
    title: "Mass schedule",
    body: "The times the parish keeps, updated by the office. A Mass they have suspended stays listed and says so, so nobody turns up for one that is off.",
  },
  {
    target: "sacraments",
    tab: "home",
    title: "Sacraments",
    body: "Baptism, matrimony, confirmation — the requirements, the schedule, and how to apply.",
  },
  {
    target: "ministries",
    tab: "home",
    title: "Ministries",
    body: "The parish's lay ministries, what each one does, and how to join.",
  },
  {
    target: "sancti-button",
    tab: "home",
    title: "Ask Sancti",
    body: "Your guide. Ask for anything in plain words — “what time is Mass?”, “take me to Mary Help” — and Sancti will answer or take you there.",
  },
  {
    target: "tab-me",
    tab: "home",
    title: "Reminders",
    body: "Under Me you can be reminded before Mass, on feast days, and when the parish decides on your application. You can replay this tour from there too.",
  },
];

const SEEN_KEY = "sanctiwalk.tutorialSeen";

/**
 * Whether the walkthrough has already run on this phone.
 *
 * Device-local, not on the account: the tour is about finding your way
 * round THIS screen, and someone who has used the app for a year should
 * still get it when they pick up a new phone.
 *
 * Read defensively - a blocked localStorage throws rather than
 * returning null, and the honest fallback there is "treat it as seen".
 * Showing a full-screen tutorial on every single launch, to someone who
 * cannot dismiss it permanently, is far worse than never showing it.
 */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "yes";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "yes");
  } catch {
    // Nothing to do. It will offer itself again next launch.
  }
}

export function forgetTutorial(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // Replaying works from the Settings button regardless.
  }
}

/**
 * The next step whose target is actually on screen.
 *
 * Steps are skipped rather than stalled on. A target can be missing
 * for honest reasons — a parish with no ministries listed has no
 * ministries card — and a tutorial that freezes on step eight is worse
 * than one that is nine steps long that day. `direction` is +1 going
 * forward and -1 going back, so Back skips the same gaps Next did.
 */
export function nextUsableStep(
  from: number,
  direction: 1 | -1,
  isPresent: (target: string) => boolean,
  steps: TutorialStep[] = TUTORIAL_STEPS,
): number | null {
  for (let i = from; i >= 0 && i < steps.length; i += direction) {
    if (isPresent(steps[i]!.target)) return i;
  }
  return null;
}
