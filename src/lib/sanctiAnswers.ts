import { availableTimes, type MassScheduleEntry } from "./schedule";
import type { ResolvedItem } from "./itemContent";

/**
 * Turning what Sancti understood into something it may actually say.
 *
 * ## The one rule
 *
 * Sancti repeats what the parish wrote and nothing else. Every answer
 * below is assembled from data passed in; where the data is absent the
 * reply says so, in the words the brief asked for, rather than filling
 * the gap. A guide that invents a Mass time sends somebody to a locked
 * church, and a guide that invents a baptismal requirement sends them
 * away from the office without the papers.
 *
 * That is why none of these functions reach for a default. The absence
 * of a schedule is itself the answer.
 */

/** The sentence the brief specifies for anything SanctiWalk does not hold. */
export const NO_INFORMATION =
  "I don't have that information in SanctiWalk yet. Please check with the parish office for the most accurate information.";

export interface Reply {
  text: string;
  /** Shown under the message as a tappable follow-up. */
  followUp?: string;
}

/**
 * The Mass times, read back as a sentence.
 *
 * Suspended Masses are named as suspended rather than dropped. Leaving
 * them out would have Sancti answer "there is no 8am" to somebody who
 * goes to the 8am every week, when the truth is that it is off this
 * month.
 */
export function massAnswer(
  parishName: string,
  schedule: MassScheduleEntry[],
): Reply {
  if (schedule.length === 0) {
    return {
      text: `I don't have the Mass schedule for ${parishName} in SanctiWalk yet. Please check with the parish office for the most accurate information.`,
    };
  }

  const lines: string[] = [];
  const suspended: string[] = [];

  for (const entry of schedule) {
    const on = availableTimes(entry);
    if (on.length > 0) lines.push(`${entry.day}: ${on.join(", ")}`);
    for (const time of entry.unavailableTimes ?? []) {
      suspended.push(`${entry.day} ${time}`);
    }
  }

  if (lines.length === 0) {
    return {
      text: `Every Mass at ${parishName} is suspended at the moment. Please check with the parish office.`,
    };
  }

  let text = `Mass at ${parishName}:\n${lines.join("\n")}`;
  if (suspended.length > 0) {
    text += `\n\nSuspended just now: ${suspended.join(", ")}.`;
  }
  return { text, followUp: "Remind me before Mass" };
}

/** The parish's own history, never a summary of one. */
export function historyAnswer(parishName: string, history?: string): Reply {
  if (!history?.trim()) {
    return {
      text: `${parishName} hasn't added its history to SanctiWalk yet. Please check with the parish office for the most accurate information.`,
    };
  }
  return { text: history.trim(), followUp: "Open the full history" };
}

/**
 * A sacrament or ministry, as the parish described it.
 *
 * Requirements are listed only when the parish listed them. An empty
 * list is reported as empty, because "no requirements" and "we have not
 * written them down" are different claims and only one of them is ours
 * to make.
 */
export function itemAnswer(item: ResolvedItem | null, open: boolean): Reply {
  if (!item) return { text: NO_INFORMATION };

  const parts: string[] = [item.about.trim()];

  if (item.requirements.length > 0) {
    parts.push(`What to bring:\n${item.requirements.map(r => `• ${r}`).join("\n")}`);
  } else {
    parts.push("The parish hasn't listed the requirements in SanctiWalk yet — the office can tell you.");
  }

  if (item.schedule) parts.push(`When: ${item.schedule}`);

  parts.push(
    open
      ? "Applications are open — I can take you to the form."
      : "Applications are closed at the moment, so the form isn't available. The information stays here for when it reopens.",
  );

  return {
    text: parts.join("\n\n"),
    followUp: open ? `Open ${item.name}` : undefined,
  };
}

/**
 * How far away a parish is.
 *
 * The walking figure is deliberately coarse. A minute-level estimate
 * from a straight-line distance would be a precise-looking number built
 * on a guess about roads nobody checked.
 */
export function distanceAnswer(
  parishName: string,
  metres: number | null,
  hasLocation: boolean,
): Reply {
  if (!hasLocation) {
    return {
      text: `I need your location to measure that. Turn on location for SanctiWalk and ask me again.`,
    };
  }
  if (metres === null) {
    return { text: `I couldn't work out where you are just now. Try again in a moment.` };
  }

  const km = metres / 1000;
  const distance = km < 1 ? `${Math.round(metres)} m` : `${km.toFixed(1)} km`;
  // About 5 km/h, rounded to five minutes. Straight-line, and said so.
  const minutes = Math.max(1, Math.round((km / 5) * 60 / 5) * 5);
  const walk = km < 3 ? ` That is roughly ${minutes} minutes' walk, going directly.` : "";

  return {
    text: `${parishName} is about ${distance} away.${walk}`,
    followUp: "Show it on the map",
  };
}

/** Contact details, only when the parish gave them. */
export function contactAnswer(parishName: string, contact?: string): Reply {
  if (!contact?.trim()) {
    return {
      text: `I don't have contact details for ${parishName} in SanctiWalk yet. Please check with the parish office for the most accurate information.`,
    };
  }
  return { text: `${parishName}: ${contact.trim()}` };
}

/**
 * Whether a Mass at that time actually exists before promising a reminder.
 *
 * The brief is explicit that a reminder is only created if the Mass is
 * real. Asked for "the 7pm Mass" at a parish whose last Mass is 6pm,
 * Sancti says what the real times are instead of setting an alarm for
 * something that will not happen.
 */
export function findMassTime(
  schedule: MassScheduleEntry[],
  wanted: string,
): { day: string; time: string } | null {
  const target = wanted.trim().toUpperCase();
  for (const entry of schedule) {
    for (const time of availableTimes(entry)) {
      if (time.trim().toUpperCase() === target) return { day: entry.day, time };
    }
  }
  return null;
}

export function reminderAnswer(
  parishName: string,
  schedule: MassScheduleEntry[],
  wanted?: string,
): Reply {
  if (schedule.length === 0) {
    return {
      text: `I don't have the Mass schedule for ${parishName} yet, so I can't set that reminder. Please check with the parish office.`,
    };
  }

  if (!wanted) {
    return {
      text: `Which Mass would you like reminding about? ${parishName} has:\n${schedule
        .map(e => `${e.day}: ${availableTimes(e).join(", ")}`)
        .filter(line => !line.endsWith(": "))
        .join("\n")}`,
    };
  }

  const found = findMassTime(schedule, wanted);
  if (!found) {
    return {
      text: `There isn't a ${wanted} Mass at ${parishName}. The times are:\n${schedule
        .map(e => `${e.day}: ${availableTimes(e).join(", ")}`)
        .filter(line => !line.endsWith(": "))
        .join("\n")}`,
    };
  }

  return {
    text: `Done — I'll remind you before the ${found.day} ${found.time} Mass at ${parishName}. You can change how early under Me.`,
  };
}

/** What Sancti says when it did not follow the question. */
export function unknownAnswer(): Reply {
  return {
    text:
      "I didn't quite follow that. I can show you the map, a church's history, Mass times, sacraments and ministries, set a Mass reminder, or open the scanner. Try asking in a few words — “what time is Mass?”",
  };
}

export function helpAnswer(parishName: string): Reply {
  return {
    text:
      `I'm Sancti, your guide around ${parishName} and the rest of the diocese.\n\n` +
      "Ask me things like:\n" +
      "• What time is Mass?\n" +
      "• Take me to San Roque\n" +
      "• Is baptism available?\n" +
      "• Tell me the history\n" +
      "• Remind me about the 6 PM Mass\n\n" +
      "For anything pastoral, your parish priest is the one to ask.",
  };
}
