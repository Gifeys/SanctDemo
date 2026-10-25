import { defineConfig } from 'vitest/config'

/**
 * The Firestore rules suite, which the default config deliberately excludes.
 *
 * Separate config rather than a CLI flag because the exclude in
 * vitest.config.ts would otherwise filter out the very file this run is
 * for, and a `--exclude` override on the command line is the kind of thing
 * that gets dropped when someone copies the script.
 *
 * Node, not jsdom: this talks to the emulator over TCP and renders nothing.
 *
 * Run it with `npm run test:rules`, which wraps this in the emulator.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/lib/firestoreRules.test.ts', 'src/lib/storageRules.test.ts'],
    // One file at a time. Both suites clear the SAME emulator in their
    // beforeEach, so running them together means each deletes the
    // other's fixtures mid-test and the failures look like rule bugs.
    fileParallelism: false,
    // The emulator is slow to accept the first connection on a cold start.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
