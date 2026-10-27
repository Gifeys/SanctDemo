import { copyFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Puts the APK that was just built where the landing page serves it.
 *
 * The download button points at public/download/SanctiWalk.apk, a
 * committed file. The Gradle build writes somewhere else entirely, so
 * for two days the parish's download link served a build from before
 * the Terms rework, the status bar fix and the notifications - while
 * every one of those was installed over a cable onto one phone and
 * reported as shipped.
 *
 * Copying by hand is how that happened. It is part of the build now.
 */
const built = resolve("android/app/build/outputs/apk/release/app-release.apk");
const published = resolve("public/download/SanctiWalk.apk");

if (!existsSync(built)) {
  console.error("publish-apk: no built APK at", built);
  process.exit(1);
}

const before = existsSync(published) ? statSync(published).mtime : null;
copyFileSync(built, published);
const size = (statSync(published).size / 1024 / 1024).toFixed(1);

console.log(
  `published APK -> public/download/SanctiWalk.apk (${size} MB)` +
  (before ? `, replacing one from ${before.toISOString().slice(0, 16).replace("T", " ")}` : ""),
);
