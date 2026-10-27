import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Every script the build runs must actually be in the repository.
 *
 * tools/ is gitignored - it holds cloudflared.exe and appkey.txt, and
 * that ignore is right. A build step was put in there anyway, so the
 * file existed on this machine and nowhere else: Vercel checked out a
 * tree without it, `node tools/stamp-service-worker.mjs` failed, the
 * build failed, and Vercel quietly went on serving the previous
 * deployment.
 *
 * Two commits shipped to GitHub and neither reached production. The
 * symptom was a stale asset, which reads as a caching problem rather
 * than as nothing having deployed at all - so it was chased in the
 * wrong place.
 *
 * This fails the moment a build script is not committed, here, where
 * it is cheap to notice.
 */
describe("build scripts are committed", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  /**
   * The scripts a DEPLOY runs, which is the set that matters.
   *
   * vercel.json's buildCommand is `npm run build:app`, and `build` is
   * the same thing plus the server bundle. `start` only names the
   * build's own output, and `apk` runs on this machine where every
   * file is present by definition - neither can be broken by a file
   * missing from the repository.
   */
  const DEPLOY_SCRIPTS = ["build", "build:app"];

  const referenced = [
    ...new Set(
      DEPLOY_SCRIPTS
        .flatMap(name => [...(pkg.scripts[name] ?? "").matchAll(/node\s+([\w./-]+\.(?:mjs|cjs|js))/g)])
        .map(m => m[1]),
    ),
  ];

  const tracked = new Set(
    execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").map(s => s.trim()),
  );

  it("finds the scripts the build refers to", () => {
    expect(referenced.length).toBeGreaterThan(0);
  });

  for (const path of referenced) {
    it(`${path} is in the repository`, () => {
      // A script only on this machine is a script Vercel does not have.
      expect(tracked.has(path)).toBe(true);
    });
  }
});
