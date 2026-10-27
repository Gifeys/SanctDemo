import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Sending a notification to a phone that is not running SanctiWalk.
 *
 * Server side only. The Admin SDK is not subject to the security
 * rules, which is why pushTokens can be unreadable by every client
 * and still readable here - a token is a capability, and the fewer
 * things that can enumerate them the better.
 *
 * ## Why the channel id matters
 *
 * Android drops a notification whose channel does not exist, without
 * an error anybody sees. The app creates "sanctiwalk-parish" on first
 * run; every message sent from here has to name the same one, or the
 * push arrives at the handset and is silently discarded.
 */

export const PUSH_TOKENS = "pushTokens";

/** The channel the app creates. Must match deviceNotifications.ts. */
export const CHANNEL_ID = "sanctiwalk-parish";

/**
 * How many tokens one send may target.
 *
 * sendEachForMulticast takes 500 at a time, and a parish with more
 * devices than that is a parish whose notifications should be queued
 * rather than fired from one request.
 */
export const MAX_TOKENS_PER_SEND = 500;

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens the service says are dead, already deleted. */
  pruned: number;
}

/**
 * Every live token for a parish.
 *
 * Deduplicated by token because that is the document id, so the same
 * device cannot be targeted twice from one call.
 */
async function tokensForParish(churchId: string): Promise<string[]> {
  const snap = await getFirestore()
    .collection(PUSH_TOKENS)
    .where("churchId", "==", churchId)
    .limit(MAX_TOKENS_PER_SEND)
    .get();
  return snap.docs.map(d => d.id);
}

/**
 * Deletes tokens the service has told us are dead.
 *
 * Not housekeeping for its own sake: a reinstalled phone leaves its
 * old token behind, and without this every future send to that parish
 * carries a growing tail of addresses that can never be delivered,
 * slowing every notification the parish ever sends.
 */
async function prune(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const batch = getFirestore().batch();
  for (const token of tokens) {
    batch.delete(getFirestore().collection(PUSH_TOKENS).doc(token));
  }
  await batch.commit().catch(() => undefined);
}

/**
 * Every device of a parish that is listening for one particular thing.
 *
 * The bells. A pilgrim presses "tell me when this opens" on a
 * ministry, and that is only worth anything if it arrives when the
 * parish actually opens it - which is rarely a moment the pilgrim
 * happens to have the app in front of them.
 *
 * Narrow by design. Pushing an opened ministry to the whole parish
 * would reach mostly people who never asked, and the fastest way to
 * make a parish turn notifications off is to send them things they
 * did not want.
 */
async function tokensWatching(churchId: string, watchKey: string): Promise<string[]> {
  const snap = await getFirestore()
    .collection(PUSH_TOKENS)
    .where("churchId", "==", churchId)
    .where("watches", "array-contains", watchKey)
    .limit(MAX_TOKENS_PER_SEND)
    .get();
  return snap.docs.map(d => d.id);
}

/** Notifies only the devices carrying that bell. */
export async function pushToWatchers(
  churchId: string,
  watchKey: string,
  title: string,
  body: string,
): Promise<PushResult> {
  return deliver(await tokensWatching(churchId, watchKey), title, body);
}

/** Sends one notification to every registered device of a parish. */
export async function pushToParish(
  churchId: string,
  title: string,
  body: string,
): Promise<PushResult> {
  return deliver(await tokensForParish(churchId), title, body);
}

/** The send itself, shared by the parish-wide and the watched paths. */
async function deliver(
  tokens: string[],
  title: string,
  body: string,
): Promise<PushResult> {
  if (tokens.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: {
      // high: the pilgrim asked to be told about this, and a normal
      // priority message may be held until the phone next wakes - for
      // a Mass starting in an hour that is too late to be useful.
      priority: "high",
      notification: {
        channelId: CHANNEL_ID,
        icon: "ic_stat_sanctiwalk",
      },
    },
  });

  // Dead tokens, as the service reports them. Any other failure is
  // transient and the token is left alone.
  const dead: string[] = [];
  response.responses.forEach((r, i) => {
    const code = (r.error as { code?: string } | undefined)?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/invalid-argument"
    ) {
      dead.push(tokens[i]);
    }
  });
  await prune(dead);

  return {
    sent: response.successCount,
    failed: response.failureCount,
    pruned: dead.length,
  };
}
