/**
 * The portal's half of the email-code second factor.
 *
 * Both calls carry the signed-in user's ID token, because the server
 * decides whose account a code belongs to - never the browser. The
 * server replies with nothing but whether it worked and, for the
 * request, a masked address so the person knows which inbox to open.
 */
import { auth } from "./firebase";
import { apiBase } from "./apiBase";
import { withAppKey } from "./appKey";

export interface RequestResult {
  ok: boolean;
  sentTo?: string;
  message?: string;
  /**
   * The server's own code for what happened, passed through unchanged.
   *
   * The portal needs it to tell a refusal from a nudge. "A code was
   * just sent, wait a moment" arrives as a 429 and is not a failure -
   * a code IS in the inbox - so showing it in the red error box tells
   * the person something went wrong when nothing did.
   */
  reason?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  return withAppKey({
    "Content-Type": "application/json",
    Authorization: `Bearer ${await user.getIdToken()}`,
  });
}

export async function requestCode(): Promise<RequestResult> {
  try {
    const res = await fetch(`${apiBase()}/api/admin/2fa/request`, {
      method: "POST",
      headers: await authHeaders(),
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        reason: data.error,
        message: data.message ?? "That code could not be sent.",
      };
    }
    return { ok: true, sentTo: data.sentTo };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection." };
  }
}

export async function submitCode(code: string): Promise<RequestResult> {
  try {
    const res = await fetch(`${apiBase()}/api/admin/2fa/verify`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, reason: data.error, message: data.message ?? "That code is not right." };
    }
    // The server set a custom claim. It only reaches this browser on
    // the NEXT token, so the refresh is what actually finishes the
    // sign-in - without it the portal would still see an unverified
    // account and send the person round again.
    await auth.currentUser?.getIdToken(true);
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection." };
  }
}
