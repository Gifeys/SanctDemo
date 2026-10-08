import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildScheduleForParishes, DEFAULT_REMINDER_SETTINGS,
  type ParishReminders, type ReminderSettings,
} from "./reminderSchedule";
import {
  applySchedule, notificationsSupported, permissionState, requestPermission,
  type PermissionState,
} from "./deviceNotifications";
const STORAGE_KEY = "sanctiwalk.reminders";

/**
 * Reminder settings, kept on the device.
 *
 * Deliberately NOT in Firestore. These are a property of this phone —
 * which alarms it has queued — not of the account. Two people sharing a
 * login should not switch each other's Mass reminders off, and somebody
 * signed out should still get reminded about Mass.
 */
export function loadSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REMINDER_SETTINGS;
    // Spread over the defaults rather than trusting the stored shape: a
    // build that adds a category would otherwise read `undefined` for it
    // on every phone that saved settings before.
    return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export function saveSettings(settings: ReminderSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage. The settings hold for this run.
  }
}

/**
 * Keeps the phone's queued reminders in step with the parish.
 *
 * ## Why it reschedules wholesale
 *
 * The inputs all change under it: the parish suspends a Mass, posts a
 * feast, archives a notice. Working out the difference between the old
 * queue and the new one would be a second implementation of the
 * scheduling rules, able to disagree with the first. Rebuilding the
 * whole list and replacing it is one rule, and the reminder ids are
 * content-derived so the alarms that did not change are simply
 * re-registered unchanged.
 *
 * ## Why it also runs when the app is reopened
 *
 * Reminders are scheduled a week out. Someone who opens the app once a
 * fortnight would run dry, so every return to the foreground tops the
 * queue back up.
 */
export function useReminders(parishes: ParishReminders[]) {
  const [settings, setSettingsState] = useState<ReminderSettings>(loadSettings);
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [scheduled, setScheduled] = useState(0);

  // So the effect below can re-run on a resume without being re-created.
  const inputs = useRef({ parishes, settings });
  inputs.current = { parishes, settings };

  useEffect(() => {
    void permissionState().then(setPermission);
  }, []);

  const reschedule = useCallback(async () => {
    const { parishes: list, settings: cfg } = inputs.current;
    if (!notificationsSupported()) return;
    if ((await permissionState()) !== "granted") return;

    const reminders = buildScheduleForParishes(list, new Date(), cfg);
    setScheduled(await applySchedule(reminders));
  }, []);

  /*
   * Whenever the followed parishes, their content, or the settings
   * change.
   *
   * Keyed on a SUMMARY of the parishes rather than the array. The
   * caller builds it inline, so the array is new on every render and
   * depending on it directly would rebuild every alarm continuously.
   * The summary changes only when something that affects a reminder
   * does.
   */
  const parishKey = parishes
    .map(p => `${p.parishId}:${p.massSchedule.map(e => `${e.day}@${e.time}@${(e.unavailableTimes ?? []).join(",")}`).join(";")}:${p.announcements.length}`)
    .join("|");

  useEffect(() => {
    void reschedule();
  }, [reschedule, parishKey, settings]);

  // And whenever the app comes back to the foreground, to top up the
  // week-long horizon for someone who opens it rarely.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reschedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reschedule]);

  const update = useCallback((patch: Partial<ReminderSettings>) => {
    setSettingsState(current => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const enable = useCallback(async () => {
    const state = await requestPermission();
    setPermission(state);
    if (state === "granted") await reschedule();
    return state;
  }, [reschedule]);

  return {
    settings,
    update,
    permission,
    enable,
    /** How many alarms are queued right now — shown so it is not a black box. */
    scheduled,
    supported: notificationsSupported(),
  };
}
