import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Registration must not depend on a rule that may not be deployed.
 *
 * Firestore refuses the WHOLE write when one field is not permitted.
 * A `watches` field was added to the registration write while the
 * rule allowing it was still undeployed, so every device stopped
 * registering - silently, because the error is swallowed so that
 * counting never interrupts a pilgrim. Notifications that had been
 * working simply stopped, and the cause was invisible.
 *
 * The base registration and the bells are two writes now. This fails
 * if they are ever merged back into one.
 */
describe("push registration is split from the bells", () => {
  const source = readFileSync("src/lib/pushRegistration.ts", "utf8");

  /** The first setDoc - the registration itself. */
  function firstWriteBody(): string {
    const at = source.indexOf("await setDoc(doc(db, PUSH_TOKENS, token), {");
    expect(at).toBeGreaterThan(-1);
    return source.slice(at, source.indexOf("});", at));
  }

  it("registers without the field the rules may not allow", () => {
    expect(firstWriteBody()).not.toContain("watches");
  });

  it("still registers the fields the rules have always allowed", () => {
    const body = firstWriteBody();
    for (const field of ["uid", "churchId", "platform", "updatedAt"]) {
      expect(body).toContain(field);
    }
  });

  it("writes the bells separately, where a refusal costs only the bells", () => {
    // A second write, inside a try, so its failure cannot take the
    // registration down with it.
    const writes = source.match(/setDoc\(/g) ?? [];
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("bells NOT stored");
  });
});
