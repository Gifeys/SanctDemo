import { readFileSync } from "node:fs";
import net from "node:net";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

/**
 * The Storage rules, run against the real rules engine.
 *
 * ## Why these exist
 *
 * storage.rules asked whether a document existed at admins/{uid} and
 * called that "the same rule the Firestore rules use". It was not.
 * firestore.rules calls that flag the SUPER admin and says plainly it
 * is "deliberately NOT accepted as a substitute for isAdminOf()",
 * because a diocese-wide flag is the precise thing church isolation
 * has to stop. Meanwhile the parish portal admits people on
 * users/{uid}.role == 'church_admin'.
 *
 * So a parish secretary could sign in, edit a ministry's description,
 * and have every photograph refused - by a rule asking a question
 * nobody had answered for them. Nothing caught it because no test in
 * this project had ever exercised the Storage rules at all.
 *
 * ## What is proved here
 *
 * That a parish administrator may write their OWN parish's item
 * photographs and NOT another parish's, that an ordinary signed-in
 * user may write nothing, and that a signed-out visitor may write
 * nothing while still being able to read - the patron image on Home
 * has to load for somebody who has never signed in.
 */

const PROJECT = "sanctiwalk-rules-test";
const STORAGE_PORT = 9199;
const FIRESTORE_PORT = 8080;

const MHCP = "route-mhcp";
const SRC = "route-src";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

let env: RulesTestEnvironment;
let available = false;

function portOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

beforeAll(async () => {
  // Both emulators are needed: the Storage rules read users/{uid} out
  // of Firestore to find the role and the parish.
  available = (await portOpen(STORAGE_PORT)) && (await portOpen(FIRESTORE_PORT));
  if (!available) return;

  env = await initializeTestEnvironment({
    projectId: PROJECT,
    storage: { rules: readFileSync("storage.rules", "utf8"), port: STORAGE_PORT, host: "127.0.0.1" },
    firestore: { rules: readFileSync("firestore.rules", "utf8"), port: FIRESTORE_PORT, host: "127.0.0.1" },
  });
}, 60_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  if (!available) return;
  await env.clearStorage();
  await env.clearFirestore();

  // The accounts the rules will look up. Written with rules disabled,
  // because creating them is setup, not the thing under test.
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", "mhcp-admin"), { role: "church_admin", churchId: MHCP });
    await setDoc(doc(db, "users", "src-admin"), { role: "church_admin", churchId: SRC });
    await setDoc(doc(db, "users", "pilgrim"), { role: "user", churchId: MHCP });
    await setDoc(doc(db, "admins", "super"), { granted: true });
    await setDoc(doc(db, "users", "super"), { role: "user", churchId: "" });
  });
});

function itRules(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!available) {
      throw new Error(
        "Storage and Firestore emulators are not running. Run `npm run test:rules`, " +
        "which starts them. These assertions are NOT verified without it.",
      );
    }
    await fn();
  });
}

describe("ministry and sacrament photographs", () => {
  itRules("a parish admin may upload to their own parish", async () => {
    const s = env.authenticatedContext("mhcp-admin").storage();
    await assertSucceeds(
      uploadBytes(ref(s, `parish-photos/items/${MHCP}/min-choir.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("a parish admin may NOT upload to the other parish", async () => {
    // The isolation the whole project turns on.
    const s = env.authenticatedContext("mhcp-admin").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/items/${SRC}/min-choir.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("the other parish's admin may upload to theirs", async () => {
    const s = env.authenticatedContext("src-admin").storage();
    await assertSucceeds(
      uploadBytes(ref(s, `parish-photos/items/${SRC}/sac-baptism.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("an ordinary signed-in user may not upload", async () => {
    const s = env.authenticatedContext("pilgrim").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/items/${MHCP}/min-choir.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("a signed-out visitor may not upload", async () => {
    const s = env.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/items/${MHCP}/min-choir.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("the global super-admin flag alone does NOT grant a parish's photos", async () => {
    // firestore.rules refuses the global flag as a substitute for
    // parish scope; Storage now agrees with it.
    const s = env.authenticatedContext("super").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/items/${MHCP}/min-choir.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("a non-image is refused even from the right admin", async () => {
    const s = env.authenticatedContext("mhcp-admin").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/items/${MHCP}/notes.txt`), JPEG,
        { contentType: "text/plain" }),
    );
  });
});

describe("cross-parish writes on the flat path are refused", () => {
  itRules("a San Roque admin may NOT overwrite Mary Help's PATRON photo", async () => {
    // Was possible until the filename scoping went in: the patron
    // image is what a pilgrim sees on Home.
    const s = env.authenticatedContext("src-admin").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/${MHCP}.jpg`), JPEG, { contentType: "image/jpeg" }),
    );
  });

  itRules("a San Roque admin may NOT overwrite Mary Help's HISTORY photo", async () => {
    const s = env.authenticatedContext("src-admin").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/${MHCP}-history.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });
});

describe("deletes", () => {
  itRules("an admin cannot delete another parish's item photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(
        ref(ctx.storage(), `parish-photos/items/${SRC}/min-choir.jpg`), JPEG,
        { contentType: "image/jpeg" });
    });
    const s = env.authenticatedContext("mhcp-admin").storage();
    await assertFails(deleteObject(ref(s, `parish-photos/items/${SRC}/min-choir.jpg`)));
  });

  itRules("an ordinary user cannot delete a parish photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/${MHCP}.jpg`), JPEG,
        { contentType: "image/jpeg" });
    });
    const s = env.authenticatedContext("pilgrim").storage();
    await assertFails(deleteObject(ref(s, `parish-photos/${MHCP}.jpg`)));
  });
});

describe("the parish's own photographs", () => {
  itRules("a parish admin may now upload the patron photo", async () => {
    // This is what was broken: the portal grants the role, Storage
    // asked for a different thing entirely.
    const s = env.authenticatedContext("mhcp-admin").storage();
    await assertSucceeds(
      uploadBytes(ref(s, `parish-photos/${MHCP}.jpg`), JPEG, { contentType: "image/jpeg" }),
    );
  });

  itRules("the legacy console-granted admin still works", async () => {
    // Kept deliberately: removing it would lock out whoever holds one.
    const s = env.authenticatedContext("super").storage();
    await assertSucceeds(
      uploadBytes(ref(s, `parish-photos/${MHCP}-history.jpg`), JPEG,
        { contentType: "image/jpeg" }),
    );
  });

  itRules("an ordinary user may not", async () => {
    const s = env.authenticatedContext("pilgrim").storage();
    await assertFails(
      uploadBytes(ref(s, `parish-photos/${MHCP}.jpg`), JPEG, { contentType: "image/jpeg" }),
    );
  });
});

describe("reads", () => {
  itRules("a signed-out visitor can read a parish photo", async () => {
    // Must stay public: the patron image on Home loads for somebody
    // who has never signed in.
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/${MHCP}.jpg`), JPEG,
        { contentType: "image/jpeg" });
    });
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),
      `parish-photos/${MHCP}.jpg`)));
  });

  itRules("a signed-out visitor can read an item photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/items/${MHCP}/min-choir.jpg`),
        JPEG, { contentType: "image/jpeg" });
    });
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),
      `parish-photos/items/${MHCP}/min-choir.jpg`)));
  });

  itRules("nothing outside parish-photos is readable", async () => {
    await assertFails(getBytes(ref(env.authenticatedContext("mhcp-admin").storage(),
      "secrets/anything.txt")));
  });
});

describe("updates (overwriting an existing file)", () => {
  itRules("a parish admin may replace their own item photo", async () => {
    const s = env.authenticatedContext("mhcp-admin").storage();
    const path = `parish-photos/items/${MHCP}/min-choir.jpg`;
    await assertSucceeds(uploadBytes(ref(s, path), JPEG, { contentType: "image/jpeg" }));
    await assertSucceeds(uploadBytes(ref(s, path), JPEG, { contentType: "image/jpeg" }));
  });

  itRules("a parish admin may not replace the other parish's item photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/items/${SRC}/min-choir.jpg`),
        JPEG, { contentType: "image/jpeg" });
    });
    await assertFails(uploadBytes(
      ref(env.authenticatedContext("mhcp-admin").storage(),
          `parish-photos/items/${SRC}/min-choir.jpg`),
      JPEG, { contentType: "image/jpeg" }));
  });
});

describe("deletes, stated explicitly", () => {
  itRules("a parish admin may delete their OWN item photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/items/${MHCP}/min-choir.jpg`),
        JPEG, { contentType: "image/jpeg" });
    });
    await assertSucceeds(deleteObject(ref(
      env.authenticatedContext("mhcp-admin").storage(),
      `parish-photos/items/${MHCP}/min-choir.jpg`)));
  });

  itRules("a parish admin may delete their OWN patron photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/${MHCP}.jpg`), JPEG,
        { contentType: "image/jpeg" });
    });
    await assertSucceeds(deleteObject(ref(
      env.authenticatedContext("mhcp-admin").storage(), `parish-photos/${MHCP}.jpg`)));
  });

  itRules("a parish admin may NOT delete the other parish's patron photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/${SRC}.jpg`), JPEG,
        { contentType: "image/jpeg" });
    });
    await assertFails(deleteObject(ref(
      env.authenticatedContext("mhcp-admin").storage(),
      `parish-photos/${SRC}.jpg`)));
  });
});

describe("what the legacy console admin can still do", () => {
  itRules("may overwrite ANY parish's flat photo", async () => {
    // Documented, not accidental: the legacy flag is diocese-wide and
    // is kept so console-granted accounts are not locked out.
    const s = env.authenticatedContext("super").storage();
    await assertSucceeds(uploadBytes(ref(s, `parish-photos/${SRC}.jpg`), JPEG,
      { contentType: "image/jpeg" }));
  });

  itRules("may DELETE any parish's flat photo", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), `parish-photos/${SRC}-history.jpg`), JPEG,
        { contentType: "image/jpeg" });
    });
    await assertSucceeds(deleteObject(ref(
      env.authenticatedContext("super").storage(), `parish-photos/${SRC}-history.jpg`)));
  });

  itRules("but still may NOT touch a parish's item photos", async () => {
    await assertFails(uploadBytes(
      ref(env.authenticatedContext("super").storage(),
          `parish-photos/items/${MHCP}/min-choir.jpg`),
      JPEG, { contentType: "image/jpeg" }));
  });
});
