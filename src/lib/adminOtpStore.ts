/**
 * Server-side storage and delivery for the parish office sign-in code.
 *
 * Everything here needs the Admin SDK, which is why it is separate
 * from adminOtp.ts: the rules there are pure and testable, and this is
 * the part that touches Firestore and the mail server.
 *
 * The record lives in a collection no client may read or write. A code
 * a client could read is not a second factor, and a `verified` flag a
 * client could write is not a gate.
 */
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

import {
  CODE_TTL_MS, checkCode, generateCode, mayResend,
  type OtpCheck, type OtpRecord,
} from "./adminOtp";

const COLLECTION = "adminOtp";

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

async function read(uid: string): Promise<OtpRecord | null> {
  const snap = await getFirestore().collection(COLLECTION).doc(uid).get();
  return snap.exists ? (snap.data() as OtpRecord) : null;
}

export interface IssueResult {
  ok: boolean;
  code?: string;
  retryAfterMs?: number;
}

/**
 * Makes a code and stores its hash. Returns the code so the caller can
 * mail it, and nothing else ever sees it again.
 */
export async function issueCode(uid: string): Promise<IssueResult> {
  const existing = await read(uid);
  if (!mayResend(existing)) {
    return {
      ok: false,
      retryAfterMs: Math.max(0, 60_000 - (Date.now() - (existing?.createdAt ?? 0))),
    };
  }

  const code = generateCode();
  const now = Date.now();
  const record: OtpRecord = {
    codeHash: hashCode(code),
    createdAt: now,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
  };
  await getFirestore().collection(COLLECTION).doc(uid).set(record);
  return { ok: true, code };
}

/**
 * Checks a code and, when it is right, marks the account as having
 * passed its second factor.
 *
 * The attempt counter is incremented inside a transaction, so guessing
 * in parallel does not get more tries than guessing in series.
 */
export async function verifyCode(uid: string, supplied: string): Promise<OtpCheck> {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(uid);

  const outcome = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const record = snap.exists ? (snap.data() as OtpRecord) : null;
    const result = checkCode(record, supplied, hashCode(supplied));

    if (!result.ok) {
      // Only a wrong guess costs an attempt; an expired or spent code
      // is not a guess and should not burn the counter further.
      if (result.reason === "wrong" && record) {
        tx.update(ref, { attempts: (record.attempts ?? 0) + 1 });
      }
      return result;
    }

    tx.update(ref, { usedAt: Date.now() });
    return result;
  });

  if (outcome.ok) {
    // A custom claim, not a flag in a document. The client cannot
    // write this, and it travels inside the signed ID token, so the
    // portal can trust it after a refresh.
    await getAuth().setCustomUserClaims(uid, {
      admin2fa: Math.floor(Date.now() / 1000),
    });
  }

  return outcome;
}
