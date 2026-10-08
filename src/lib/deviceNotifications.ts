import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import type { Reminder } from "./reminderSchedule";

/**
 * Handing reminders to Android, so they appear when the app is closed.
 *
 * ## Why nothing reached the phone before
 *
 * The existing notification system writes a document to Firestore and
 * shows it on the Notifications screen. That is a message inside the
 * app, and the phone was never told about any of it — which is exactly
 * why none ever arrived. This module is the missing half.
 *
 * ## What works with the app closed, and what does not
 *
 * A local notification is an alarm set ON the device. Once scheduled it
 * fires with the app closed, the screen off and no signal. Mass times,
 * feast days and dated announcements are all known in advance, so they
 * are scheduled ahead and behave exactly as a reminder should.
 *
 * What CANNOT work that way is anything the parish decides while the app
 * is closed — an application approved an hour ago. Delivering that needs
 * push (FCM), which needs a server holding a service-account key, which
 * needs the Blaze plan. On Spark the honest behaviour is to raise it the
 * moment the app is next opened, which `notifyNow` does.
 *
 * ## Why every call is guarded
 *
 * On the web there is no plugin. Every function here returns quietly
 * rather than throwing, so the same code runs in a browser during
 * development and simply does nothing.
 */

const CHANNEL_ID = "sanctiwalk-parish";

export function notificationsSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications");
}

export type PermissionState = "granted" | "denied" | "unsupported" | "prompt";

export async function permissionState(): Promise<PermissionState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return "granted";
    if (display === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Makes sure the notification channel exists.
 *
 * ## Why this is not part of asking for permission
 *
 * It was, and that was a bug that silently threw every notification
 * away. Android 8 and later drop — with no error, no log, nothing — any
 * notification posted to a channel that does not exist. Creating the
 * channel only inside requestPermission() meant it was created only on
 * the run where the user first said yes. On every run after that,
 * permission was already granted, the request was never made, the
 * channel was never created, and both the test notification and twelve
 * scheduled Mass reminders went nowhere. Reinstalling made it worse,
 * because the OS remembers the grant while the app forgets the channel.
 *
 * So: the channel is a precondition for posting, not a consequence of
 * being granted permission, and every path that posts calls this first.
 *
 * Memoised because creating it is idempotent but not free, and the
 * scheduler calls it on every resume.
 */
let channelReady: Promise<void> | null = null;

export function ensureChannel(): Promise<void> {
  if (!notificationsSupported()) return Promise.resolve();
  if (channelReady) return channelReady;

  channelReady = LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: "Parish reminders",
    description: "Mass times, feast days and news from your parish.",
    // Default-high: a Mass reminder should appear and make a sound, not
    // take over the screen the way an alarm or a call does.
    importance: 4,
    visibility: 1,
  })
    .then(() => undefined)
    .catch(error => {
      // Let the next call try again rather than caching the failure.
      channelReady = null;
      console.warn("[notifications] channel not created:", error);
    });

  return channelReady;
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== "granted") return display === "denied" ? "denied" : "prompt";
    await ensureChannel();
    return "granted";
  } catch {
    return "unsupported";
  }
}

/**
 * Replaces everything pending with this list.
 *
 * Cancel-then-schedule rather than diffing. The reminder ids are derived
 * from what each reminder IS, so rescheduling the same Mass reuses its
 * id and Android replaces the alarm — but a Mass the parish has since
 * suspended simply would not appear in the new list, and without the
 * cancel its old alarm would still be sitting there waiting to fire.
 * Sending someone to a cancelled Mass is the failure that matters most.
 */
export async function applySchedule(reminders: Reminder[]): Promise<number> {
  if (!notificationsSupported()) return 0;

  try {
    // Before anything is queued: a reminder scheduled against a missing
    // channel fires into nothing, hours later, with no sign of why.
    await ensureChannel();

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    if (reminders.length === 0) return 0;

    await LocalNotifications.schedule({
      notifications: reminders.map(r => ({
        id: r.id,
        title: r.title,
        body: r.body,
        channelId: CHANNEL_ID,
        schedule: { at: r.at, allowWhileIdle: true },
        smallIcon: "ic_stat_sanctiwalk",
        extra: { kind: r.kind },
      })),
    });
    return reminders.length;
  } catch (error) {
    // Never fatal. A phone that refuses to schedule reminders is a phone
    // without reminders, not a broken app.
    console.warn("[notifications] could not schedule:", error);
    return 0;
  }
}

/**
 * Shows something immediately.
 *
 * For the things that cannot be known in advance — an application the
 * parish has just decided on. Fires while the app is open, and on next
 * open for anything decided while it was closed.
 */
export async function notifyNow(title: string, body: string): Promise<void> {
  if (!notificationsSupported()) return;
  try {
    await ensureChannel();
    await LocalNotifications.schedule({
      notifications: [{
        // Time-based so two notifications in the same second cannot
        // collide, and so it never clashes with a scheduled reminder's
        // content-derived id.
        id: Math.floor(Date.now() % 2_000_000_000),
        title,
        body,
        channelId: CHANNEL_ID,
        smallIcon: "ic_stat_sanctiwalk",
      }],
    });
  } catch (error) {
    console.warn("[notifications] could not show:", error);
  }
}

/** For the settings screen: how many reminders are actually queued. */
export async function pendingCount(): Promise<number> {
  if (!notificationsSupported()) return 0;
  try {
    return (await LocalNotifications.getPending()).notifications.length;
  } catch {
    return 0;
  }
}
