import { readFileSync } from "node:fs";
import net from "node:net";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

/**
 * The church-isolation rules, run against the real rules engine.
 *
 * These are the only tests in the project that can prove multi-church
 * separation, because separation is not implemented in the app at all — it
 * is implemented in firestore.rules, and the app's own filtering is a
 * convenience that an attacker simply does not use. Asserting it in React
 * would be asserting the thing that does not matter.
 *
 * Requires the Firestore emulator:
 *
 *   npx firebase emulators:exec --only firestore "npx vitest run src/lib/firestoreRules.test.ts"
 */

const PROJECT = "sanctiwalk-rules-test";

const CHURCH_A = "church_001";
const CHURCH_B = "church_002";

const ADMIN_A = "adminA";
const ADMIN_B = "adminB";
const USER_A = "userA";
const USER_B = "userB";

let env: RulesTestEnvironment;

/**
 * Refuses to run without the emulator, rather than passing without it.
 *
 * This suite passed 26/26 with nothing listening on 8080. Offline, the
 * Firestore SDK resolves writes against its local cache and reports
 * success, and every read fails with a connection error - which assertFails
 * cannot tell apart from a rule denying it. So every assertion came out the
 * way it wanted for the wrong reason, and the one test that is supposed to
 * prove church isolation proved nothing at all.
 *
 * A security test that cannot fail is worse than no security test, because
 * it is quoted as evidence. Hence this: no emulator, no run.
 */
async function requireEmulator(): Promise<void> {
  // A TCP connect, not an HTTP fetch: the emulator does not answer a plain
  // GET on its root, so fetch() threw even when it was running and the
  // guard failed the suite it was meant to protect. "Is anything listening"
  // is the actual question.
  const listening = await new Promise<boolean>(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port: 8080 });
    const done = (ok: boolean) => { socket.destroy(); resolve(ok); };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(3000, () => done(false));
  });

  if (!listening) {
    throw new Error(
      "The Firestore emulator is not running on 127.0.0.1:8080, so these rules " +
      "would pass without ever being evaluated. Run them with: " +
      "npx firebase emulators:exec --only firestore --project sanctiwalk-rules-test " +
      "\"npx vitest run src/lib/firestoreRules.test.ts\"",
    );
  }
}

beforeAll(async () => {
  await requireEmulator();
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();

  // Seeded with rules disabled: this is the state the system is in before
  // anybody makes a request, not something a client could write.
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "churches", CHURCH_A), { id: CHURCH_A, name: "Mary Help", adminUid: ADMIN_A });
    await setDoc(doc(db, "churches", CHURCH_B), { id: CHURCH_B, name: "San Roque", adminUid: ADMIN_B });

    await setDoc(doc(db, "users", ADMIN_A), { uid: ADMIN_A, role: "church_admin", churchId: CHURCH_A });
    await setDoc(doc(db, "users", ADMIN_B), { uid: ADMIN_B, role: "church_admin", churchId: CHURCH_B });
    await setDoc(doc(db, "users", USER_A), { uid: USER_A, role: "user", churchId: CHURCH_A });
    await setDoc(doc(db, "users", USER_B), { uid: USER_B, role: "user", churchId: CHURCH_B });

    await setDoc(doc(db, "applications", "appA"), {
      uid: USER_A, churchId: CHURCH_A, kind: "sacrament", status: "pending",
      referenceNumber: "SAC-2026-000001",
    });
    await setDoc(doc(db, "applications", "appB"), {
      uid: USER_B, churchId: CHURCH_B, kind: "ministry", status: "pending",
      referenceNumber: "MIN-2026-000001",
    });

    await setDoc(doc(db, "announcements", "annA"), {
      churchId: CHURCH_A, title: "Fiesta Mass", date: "2026-12-25", type: "Mass",
    });
    await setDoc(doc(db, "announcements", "annB"), {
      churchId: CHURCH_B, title: "Confessions moved", date: "2026-12-20", type: "Notice",
    });
    // Written before parishes were isolated: no churchId at all.
    await setDoc(doc(db, "announcements", "annLegacy"), {
      title: "Diocesan pilgrimage", date: "2026-12-28", type: "Event",
    });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("church isolation", () => {
  it("an admin reads their own church's application", async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN_A), "applications", "appA")));
  });

  it("an admin CANNOT read another church's application", async () => {
    await assertFails(getDoc(doc(as(ADMIN_A), "applications", "appB")));
    await assertFails(getDoc(doc(as(ADMIN_B), "applications", "appA")));
  });

  it("an applicant reads their own application", async () => {
    await assertSucceeds(getDoc(doc(as(USER_A), "applications", "appA")));
  });

  it("a user CANNOT read another user's application", async () => {
    await assertFails(getDoc(doc(as(USER_A), "applications", "appB")));
  });

  it("an admin CANNOT read a parishioner of another church", async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN_A), "users", USER_A)));
    await assertFails(getDoc(doc(as(ADMIN_A), "users", USER_B)));
  });
});

describe("what a user must never be able to do", () => {
  it("cannot change their own application's status", async () => {
    await assertFails(updateDoc(doc(as(USER_A), "applications", "appA"), { status: "approved" }));
  });

  it("cannot make themselves an admin", async () => {
    await assertFails(updateDoc(doc(as(USER_A), "users", USER_A), { role: "church_admin" }));
  });

  it("cannot move themselves to another church", async () => {
    await assertFails(updateDoc(doc(as(USER_A), "users", USER_A), { churchId: CHURCH_B }));
  });

  it("cannot claim their phone is verified", async () => {
    await assertFails(updateDoc(doc(as(USER_A), "users", USER_A), { phoneVerified: true }));
  });

  it("CAN edit their own ordinary profile fields", async () => {
    await assertSucceeds(updateDoc(doc(as(USER_A), "users", USER_A), { fullName: "Juan Dela Cruz" }));
  });

  it("CAN set their own nickname and avatar", async () => {
    // Both are the pilgrim's to choose. They are also the two fields a
    // whitelist is easiest to forget, and forgetting one does not error -
    // it silently refuses the write and the edit appears not to save.
    await assertSucceeds(updateDoc(doc(as(USER_A), "users", USER_A), {
      nickname: "Adrich",
      photoUrl: "data:image/jpeg;base64,AAAA",
    }));
  });

  it("CAN save their pilgrimage progress - the whole UserProgress shape", async () => {
    // Exhaustive on purpose. The allowed-field list in the rules is a
    // whitelist, so a field missing from it does not error anywhere - the
    // write is simply denied and the pilgrim's check-in is never saved.
    // This is the test that catches that silently.
    await assertSucceeds(updateDoc(doc(as(USER_A), "users", USER_A), {
      points: 120,
      steps: 640,
      distanceKm: 0.42,
      completedStations: ["st-1"],
      completedRoutes: ["route-mhcp"],
      badges: ["first-steps"],
    }));
  });

  it("cannot submit an application into another church's queue", async () => {
    await assertFails(setDoc(doc(as(USER_A), "applications", "forged"), {
      uid: USER_A, churchId: CHURCH_B, kind: "sacrament", status: "pending",
    }));
  });

  it("cannot submit an application that is already approved", async () => {
    await assertFails(setDoc(doc(as(USER_A), "applications", "forged2"), {
      uid: USER_A, churchId: CHURCH_A, kind: "sacrament", status: "approved",
    }));
  });

  it("cannot submit an application in someone else's name", async () => {
    await assertFails(setDoc(doc(as(USER_A), "applications", "forged3"), {
      uid: USER_B, churchId: CHURCH_A, kind: "sacrament", status: "pending",
    }));
  });

  it("CAN submit a valid application to their own church", async () => {
    await assertSucceeds(setDoc(doc(as(USER_A), "applications", "good"), {
      uid: USER_A, churchId: CHURCH_A, kind: "sacrament", status: "pending",
      itemId: "sac-baptism", referenceNumber: "SAC-2026-000002",
    }));
  });
});

describe("withdrawing an application", () => {
  it("an applicant CAN withdraw one the parish has not started on", async () => {
    await assertSucceeds(deleteDoc(doc(as(USER_A), "applications", "appA")));
  });

  it("cannot withdraw it once the parish has acted", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "applications", "appA"), {
        uid: USER_A, churchId: CHURCH_A, kind: "sacrament", status: "approved",
      });
    });
    // The approval is the parish's work, and the queue entry is what the
    // office is working from. Neither is the applicant's to erase.
    await assertFails(deleteDoc(doc(as(USER_A), "applications", "appA")));
  });

  it("cannot withdraw somebody else's", async () => {
    await assertFails(deleteDoc(doc(as(USER_B), "applications", "appA")));
  });

  it("the parish cannot delete one either", async () => {
    await assertFails(deleteDoc(doc(as(ADMIN_A), "applications", "appA")));
  });
});

describe("what an admin must never be able to do", () => {
  it("CAN set a status on their own church's application", async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN_A), "applications", "appA"), {
      status: "under_review", reviewedBy: ADMIN_A,
    }));
  });

  it("cannot set a status on another church's application", async () => {
    await assertFails(updateDoc(doc(as(ADMIN_B), "applications", "appA"), { status: "approved" }));
  });

  it("cannot rewrite the submitted answers while deciding", async () => {
    await assertFails(updateDoc(doc(as(ADMIN_A), "applications", "appA"), {
      status: "approved", formData: { tampered: true },
    }));
  });

  it("cannot invent a status outside the workflow", async () => {
    await assertFails(updateDoc(doc(as(ADMIN_A), "applications", "appA"), { status: "whatever" }));
  });

  it("cannot move their own church to themselves from another parish", async () => {
    await assertFails(updateDoc(doc(as(ADMIN_A), "users", ADMIN_A), { churchId: CHURCH_B }));
  });

  it("cannot take over another church by rewriting adminUid", async () => {
    await assertFails(updateDoc(doc(as(ADMIN_B), "churches", CHURCH_A), { adminUid: ADMIN_B }));
  });

  it("cannot hand their own church to someone else", async () => {
    await assertFails(updateDoc(doc(as(ADMIN_A), "churches", CHURCH_A), { adminUid: USER_A }));
  });

  it("cannot create a church, which is what a second admin would need", async () => {
    await assertFails(setDoc(doc(as(ADMIN_A), "churches", "church_003"), {
      id: "church_003", name: "New", adminUid: ADMIN_A,
    }));
  });

  it("cannot delete an application", async () => {
    await assertFails(deleteDoc(doc(as(ADMIN_A), "applications", "appA")));
  });
});

describe("the activity log", () => {
  it("a user can record their own activity", async () => {
    await assertSucceeds(setDoc(doc(as(USER_A), "activity", "e1"), {
      uid: USER_A, kind: "station_visit", summary: "Checked in", churchId: CHURCH_A,
      createdAt: new Date().toISOString(),
    }));
  });

  it("cannot record activity in someone else's name", async () => {
    await assertFails(setDoc(doc(as(USER_A), "activity", "e2"), {
      uid: USER_B, kind: "sign_in", summary: "forged", churchId: CHURCH_A,
      createdAt: new Date().toISOString(),
    }));
  });

  it("is append-only - even its own author cannot edit it", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "activity", "e3"), {
        uid: USER_A, kind: "sign_in", summary: "real", churchId: CHURCH_A,
        createdAt: new Date().toISOString(),
      });
    });
    await assertFails(updateDoc(doc(as(USER_A), "activity", "e3"), { summary: "rewritten" }));
    await assertFails(deleteDoc(doc(as(USER_A), "activity", "e3")));
  });

  it("an admin cannot read another church's activity", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "activity", "e4"), {
        uid: USER_B, kind: "sign_in", summary: "B", churchId: CHURCH_B,
        createdAt: new Date().toISOString(),
      });
    });
    await assertFails(getDoc(doc(as(ADMIN_A), "activity", "e4")));
    await assertSucceeds(getDoc(doc(as(ADMIN_B), "activity", "e4")));
  });
});

describe("a real submission, as the app builds it", () => {
  const built = (overrides: Record<string, unknown> = {}) => ({
    uid: USER_A,
    applicantName: "Juan Dela Cruz",
    applicantEmail: "juan@example.com",
    churchId: CHURCH_A,
    kind: "sacrament",
    itemId: "sac-baptism",
    type: "Baptism",
    status: "pending",
    referenceNumber: "SAC-2026-ACDEFG",
    formData: { preferredDate: "2026-11-02", hasPSA: true },
    createdAt: new Date().toISOString(),
    history: [{ status: "pending", at: new Date().toISOString() }],
    ...overrides,
  });

  it("is accepted", async () => {
    await assertSucceeds(setDoc(doc(as(USER_A), "applications", "real1"), built()));
  });

  it("is rejected if the kind is not one of the two", async () => {
    await assertFails(setDoc(doc(as(USER_A), "applications", "real2"), built({ kind: "donation" })));
  });

  it("the applicant can read it back and the parish can decide it", async () => {
    await assertSucceeds(setDoc(doc(as(USER_A), "applications", "real3"), built()));
    await assertSucceeds(getDoc(doc(as(USER_A), "applications", "real3")));
    await assertSucceeds(updateDoc(doc(as(ADMIN_A), "applications", "real3"), {
      status: "approved", reviewedBy: ADMIN_A, reviewedAt: new Date().toISOString(),
    }));
  });
});

describe("signed-out access", () => {
  const anon = () => env.unauthenticatedContext().firestore();

  it("can read the church list, because signup needs it before login", async () => {
    await assertSucceeds(getDoc(doc(anon(), "churches", CHURCH_A)));
  });

  it("cannot read applications", async () => {
    await assertFails(getDoc(doc(anon(), "applications", "appA")));
  });

  it("cannot read user profiles", async () => {
    await assertFails(getDoc(doc(anon(), "users", USER_A)));
  });
});

/**
 * The parish bulletin.
 *
 * Announcements are the one collection here that is deliberately world-
 * readable - a pilgrim browsing the diocese is not signed in and the home
 * screen must still fill in - so every test below is about WRITING.
 *
 * The delete cases are the reason the rule had to stop being a single
 * `allow write`. A delete carries no request.resource at all, so a rule
 * phrased on the incoming document can never authorise one: the parish
 * could post an announcement and then be unable to take it down.
 */
describe("the parish bulletin", () => {
  const announcement = (churchId: string) => ({
    churchId, title: "Novena", date: "2026-12-01", type: "Mass",
  });

  it("anyone at all can read the bulletin, signed in or not", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "announcements", "annA")));
    await assertSucceeds(getDoc(doc(as(USER_B), "announcements", "annA")));
  });

  it("an admin posts to their own parish", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN_A), "announcements", "new1"), announcement(CHURCH_A)),
    );
  });

  it("an admin CANNOT post to another parish", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN_A), "announcements", "new2"), announcement(CHURCH_B)),
    );
  });

  it("an ordinary member of the parish cannot post at all", async () => {
    await assertFails(
      setDoc(doc(as(USER_A), "announcements", "new3"), announcement(CHURCH_A)),
    );
  });

  it("nobody signed out can post", async () => {
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), "announcements", "new4"), announcement(CHURCH_A)),
    );
  });

  it("an announcement with no parish on it cannot be created", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN_A), "announcements", "new5"), { title: "Orphan", date: "2026-12-01", type: "Notice" }),
    );
  });

  it("an admin takes down their own announcement", async () => {
    await assertSucceeds(deleteDoc(doc(as(ADMIN_A), "announcements", "annA")));
  });

  it("an admin CANNOT take down another parish's announcement", async () => {
    await assertFails(deleteDoc(doc(as(ADMIN_A), "announcements", "annB")));
  });

  it("an ordinary member cannot take one down", async () => {
    await assertFails(deleteDoc(doc(as(USER_A), "announcements", "annA")));
  });

  it("nobody can touch the ownerless legacy announcements", async () => {
    // They show on every parish's bulletin and nothing records who wrote
    // them, so no parish admin gets to speak for them.
    await assertFails(deleteDoc(doc(as(ADMIN_A), "announcements", "annLegacy")));
    await assertFails(
      updateDoc(doc(as(ADMIN_A), "announcements", "annLegacy"), { title: "Mine now" }),
    );
  });

  it("an admin edits their own announcement", async () => {
    await assertSucceeds(
      updateDoc(doc(as(ADMIN_A), "announcements", "annA"), { title: "Fiesta Mass — new time" }),
    );
  });

  it("an admin cannot seize another parish's announcement by rewriting churchId", async () => {
    // Checked on both sides, which is the whole reason update is its own
    // rule: authorising only on the INCOMING document would let this
    // through, because the incoming one names a parish they do administer.
    await assertFails(
      updateDoc(doc(as(ADMIN_A), "announcements", "annB"), { churchId: CHURCH_A }),
    );
  });

  it("an admin cannot hand their own announcement to another parish either", async () => {
    await assertFails(
      updateDoc(doc(as(ADMIN_A), "announcements", "annA"), { churchId: CHURCH_B }),
    );
  });
});

/**
 * Applications closed by the parish.
 *
 * The app greys the button out, but the button is not the control. These
 * tests go straight at the database the way anything other than the app
 * would, because that is the only version of this rule that is worth
 * anything.
 */
describe("a ministry or sacrament the parish has closed", () => {
  const application = (itemId: string) => ({
    uid: USER_A,
    applicantName: "Juan Dela Cruz",
    churchId: CHURCH_A,
    kind: "ministry",
    itemId,
    type: "Choir",
    status: "pending",
    referenceNumber: "MIN-2026-ABCDEF",
    createdAt: new Date().toISOString(),
  });

  async function close(churchId: string, ids: string[]) {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "parishContent", churchId), {
        closedApplications: ids,
      });
    });
  }

  it("with no parishContent document at all, everything is open", async () => {
    // The state 29 of the 31 parishes are in. If this ever fails, the
    // diocese has gone dark.
    await assertSucceeds(
      setDoc(doc(as(USER_A), "applications", "a1"), application("min-choir")),
    );
  });

  it("cannot be applied to, however the request is made", async () => {
    await close(CHURCH_A, ["min-choir"]);
    await assertFails(
      setDoc(doc(as(USER_A), "applications", "a2"), application("min-choir")),
    );
  });

  it("does not close anything else", async () => {
    await close(CHURCH_A, ["min-choir"]);
    await assertSucceeds(
      setDoc(doc(as(USER_A), "applications", "a3"), application("min-altar-servers")),
    );
  });

  it("an application with no itemId is refused", async () => {
    // Otherwise the check above is theatre: omit the field and nothing
    // matches the closed list.
    await close(CHURCH_A, ["min-choir"]);
    const { itemId: _omitted, ...withoutId } = application("min-choir");
    await assertFails(setDoc(doc(as(USER_A), "applications", "a4"), withoutId));
  });

  it("an empty itemId is refused too", async () => {
    await assertFails(
      setDoc(doc(as(USER_A), "applications", "a5"), application("")),
    );
  });

  it("is closed per parish - one parish shutting the choir does not shut another's", async () => {
    await close(CHURCH_B, ["min-choir"]);
    await assertSucceeds(
      setDoc(doc(as(USER_A), "applications", "a6"), application("min-choir")),
    );
  });

  it("reopening lets applications through again", async () => {
    await close(CHURCH_A, ["min-choir"]);
    await assertFails(
      setDoc(doc(as(USER_A), "applications", "a7"), application("min-choir")),
    );
    await close(CHURCH_A, []);
    await assertSucceeds(
      setDoc(doc(as(USER_A), "applications", "a8"), application("min-choir")),
    );
  });

  it("an ordinary member cannot open what the parish closed", async () => {
    // The field lives on parishContent, which is parish-admin-only. This
    // asserts the thing that makes the rule above worth having.
    await close(CHURCH_A, ["min-choir"]);
    await assertFails(
      setDoc(doc(as(USER_A), "parishContent", CHURCH_A), { closedApplications: [] }),
    );
  });

  it("the parish admin can close and reopen their own parish", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN_A), "parishContent", CHURCH_A),
             { closedApplications: ["min-choir"] }),
    );
  });

  it("an admin cannot change another parish's availability", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN_B), "parishContent", CHURCH_A),
             { closedApplications: [] }),
    );
  });
});

/**
 * Everything the parish office can change about what pilgrims see.
 *
 * All of it lives on parishContent, which is world-readable and
 * parish-admin-writable. These tests exist because that single rule is
 * now carrying Mass times, availability and the text of every sacrament
 * page - and "a normal user cannot edit it" is the only thing standing
 * between a parishioner and the published Mass schedule.
 */
describe("what only the parish office may change", () => {
  const settings = {
    massSchedule: [{ day: "Sunday", time: "8:00 AM" }],
    closedApplications: ["min-choir"],
    itemContent: { "sac-baptism": { about: "Saturdays only." } },
  };

  it("anyone may read it, signed in or not - the home screen needs it", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "parishContent", CHURCH_A), settings);
    });
    await assertSucceeds(
      getDoc(doc(env.unauthenticatedContext().firestore(), "parishContent", CHURCH_A)),
    );
  });

  it("the parish admin may change their own", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN_A), "parishContent", CHURCH_A), settings),
    );
  });

  it("an ordinary parishioner cannot touch the Mass schedule", async () => {
    // The one that matters most: a changed Mass time sends a
    // congregation to a locked church.
    await assertFails(
      setDoc(doc(as(USER_A), "parishContent", CHURCH_A),
             { massSchedule: [{ day: "Sunday", time: "3:00 AM" }] }),
    );
  });

  it("an ordinary parishioner cannot reopen what the parish closed", async () => {
    await assertFails(
      setDoc(doc(as(USER_A), "parishContent", CHURCH_A), { closedApplications: [] }),
    );
  });

  it("an ordinary parishioner cannot rewrite a sacrament's requirements", async () => {
    await assertFails(
      setDoc(doc(as(USER_A), "parishContent", CHURCH_A),
             { itemContent: { "sac-baptism": { requirements: ["Nothing at all"] } } }),
    );
  });

  it("nobody signed out can change anything", async () => {
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), "parishContent", CHURCH_A), settings),
    );
  });

  it("one parish's admin cannot change another parish", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN_B), "parishContent", CHURCH_A), settings),
    );
    await assertSucceeds(
      setDoc(doc(as(ADMIN_B), "parishContent", CHURCH_B), settings),
    );
  });
});

describe("notifying the parish", () => {
  it("an admin may read their own parishioners, to notify them", async () => {
    // The fan-out in lib/notifications.ts depends on this. Without it,
    // "tell the parish" silently reaches nobody.
    await assertSucceeds(getDoc(doc(as(ADMIN_A), "users", USER_A)));
  });

  it("an admin cannot read another parish's members", async () => {
    await assertFails(getDoc(doc(as(ADMIN_A), "users", USER_B)));
  });

  it("an admin may write a notification to their own parishioner", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN_A), "notifications", "n1"), {
        userId: USER_A, churchId: CHURCH_A,
        title: "Mass schedule updated", body: "The 8:00 AM is suspended.",
        createdAt: new Date().toISOString(), readAt: null,
      }),
    );
  });

  it("an admin cannot write into another parish's member's list", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN_A), "notifications", "n2"), {
        userId: USER_B, churchId: CHURCH_B,
        title: "Not yours", body: "...",
        createdAt: new Date().toISOString(), readAt: null,
      }),
    );
  });

  it("an ordinary user cannot notify anyone but themselves", async () => {
    await assertFails(
      setDoc(doc(as(USER_A), "notifications", "n3"), {
        userId: USER_B, churchId: CHURCH_A,
        title: "Spam", body: "...",
        createdAt: new Date().toISOString(), readAt: null,
      }),
    );
  });
});
