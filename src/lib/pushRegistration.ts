import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth } from "./firebase";
import { db } from "./firebase";

/**
 * Registering this device so the parish can reach it when the app is shut.
 *
 * ## What this is for, and what it is not
 *
 * The Mass reminders already survive the app being closed: they are
 * scheduled as real Android alarms through LocalNotifications, and the
 * system fires them whether SanctiWalk is running or not.
 *
 * What could not work was anything the PARISH decides while the app is
 * shut - an application approved, an announcement posted. Those arrive
 * as Firestore documents, and the app only learns of them through an
 * onSnapshot subscription, which exists only while the app is open. A
 * phone in a pocket has no subscription and hears nothing until it is
 * next unlocked, which for an approved application might be days.
 *
 * A push is the only thing that reaches a closed app, because the
 * delivery is done by Google Play services rather than by us.
 *
 * ## Why the token is stored per token, not per user
 *
 * One person may have a phone and a tablet, and the same person may
 * reinstall and get a new token while the old one still exists. Keyed
 * by token, each device is its own row, a stale one can be deleted on
 * the delivery failure that reveals it, and nothing has to merge
 * arrays under concurrent writes.
 *
 * ## Why nobody can read these
 *
 * A token is a capability: anyone holding it and a server key can put
 * a notification on that person's phone. The rules let the owner write
 * their own and let nobody read any; the sender is the backend, which
 * goes through the Admin SDK and is not subject to rules.
 */

export const PUSH_TOKENS = "pushTokens";

/**
 * One tag for everything this file reports.
 *
 * console.warn alone was useless here: Capacitor routes it through a
 * logger that is silent in a release build, so a registration that
 * failed on a real handset said nothing anywhere. The native
 * WebChromeClient forwards any SW- line to logcat.
 *
 *     adb logcat -s SanctiWalk:I
 */
function pushLog(...parts: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log("SW-PUSH", ...parts);
}

/** Whether this build can receive pushes at all. */
export function pushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications");
}

let started = false;

/**
 * Asks for permission, registers with FCM, and files the token.
 *
 * Safe to call more than once; only the first call does anything.
 * Never throws: a phone that will not register is a phone without
 * push, not a broken app.
 */
export async function startPushRegistration(churchId: string | null): Promise<void> {
  pushLog("start requested, supported:", pushSupported(), "already started:", started);
  if (!pushSupported() || started) return;
  started = true;

  try {
    // The permission is shared with local notifications on Android 13+,
    // so this is usually already granted by the time it runs.
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
      status = await PushNotifications.requestPermissions();
    }
    pushLog("permission:", status.receive);
    if (status.receive !== "granted") return;

    await PushNotifications.addListener("registration", token => {
      pushLog("registered, token length:", token.value?.length ?? 0);
      void saveToken(token.value, churchId);
    });

    await PushNotifications.addListener("registrationError", err => {
      pushLog("registration FAILED:", JSON.stringify(err));
    });

    await PushNotifications.register();
  } catch (error) {
    pushLog("could not start:", (error as Error)?.message ?? String(error));
    started = false;
  }
}

/**
 * Files the token against the signed-in account.
 *
 * Signed out there is nobody to notify, so nothing is stored - a token
 * with no owner cannot be targeted and would only be a row nobody ever
 * cleans up.
 */
export async function saveToken(token: string, churchId: string | null): Promise<void> {
  const user = auth.currentUser;
  if (!user) { pushLog("not signed in, token not filed"); return; }
  if (!token) { pushLog("empty token"); return; }

  try {
    await setDoc(doc(db, PUSH_TOKENS, token), {
      uid: user.uid,
      churchId: churchId ?? "",
      platform: Capacitor.getPlatform(),
      updatedAt: serverTimestamp(),
    });
    pushLog("token stored for parish:", churchId ?? "(none)");
  } catch (error) {
    // Rules refusing it, or no connection. Either way the pilgrim
    // simply does not get pushes; nothing on screen should change.
    pushLog("token NOT stored:", (error as Error)?.message ?? String(error));
  }
}
