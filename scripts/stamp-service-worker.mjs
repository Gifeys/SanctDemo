import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Give the service worker a version that changes when the app does.
 *
 * sw.js shipped with `const VERSION = 'v1'`, hardcoded, and nobody
 * ever changed it. The cache names are built from it, and activate
 * only deletes caches whose names it does not recognise - so the
 * names never changed, nothing was ever evicted, and the worker kept
 * serving whatever it cached the first time it ran.
 *
 * The effect on a phone is that updating the APK changes nothing a
 * pilgrim can see. A fix shipped, installed, verified present in the
 * package, and the WebView went on serving the old file out of the
 * cache. That is exactly how the Rosary's microphone survived being
 * deleted and the status bar fix appeared not to work.
 *
 * Stamped here rather than by hand because a version somebody has to
 * remember to bump is a version that stays at v1 - which is the whole
 * story above.
 *
 * Hashed from the built assets, not from the clock: an identical
 * build keeps its version, so a rebuild that changed nothing does not
 * throw away a cache that is still correct.
 */
const dist = "dist";
const swPath = join(dist, "sw.js");

if (!existsSync(swPath)) {
  console.error("stamp-service-worker: no dist/sw.js - run vite build first");
  process.exit(1);
}

/** Every built asset, in a stable order. */
function assetFingerprint() {
  const assetDir = join(dist, "assets");
  const names = existsSync(assetDir) ? readdirSync(assetDir).sort() : [];
  const hash = createHash("sha256");
  for (const name of names) hash.update(name);

  // The Rosary is a hand-written page in public/, so its filename
  // never changes when its contents do - hashing the name alone would
  // miss every edit to it.
  const rosary = join(dist, "rosary", "index.html");
  if (existsSync(rosary)) hash.update(readFileSync(rosary));

  const shell = join(dist, "index.html");
  if (existsSync(shell)) hash.update(readFileSync(shell));

  return hash.digest("hex").slice(0, 12);
}

const version = assetFingerprint();
const source = readFileSync(swPath, "utf8");
const stamped = source.replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`);

if (stamped === source) {
  console.error("stamp-service-worker: could not find the VERSION line in sw.js");
  process.exit(1);
}

writeFileSync(swPath, stamped);
console.log(`sw.js version -> ${version}`);
