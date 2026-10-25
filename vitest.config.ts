import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Vitest's default is 5s, and a handful of the component tests sit
    // close enough to it that they time out when the suite runs flat
    // out beside a Gradle or Unity build - a different file each run,
    // every one of them passing on its own. That is the machine being
    // busy, not the test being wrong, and a suite that cries wolf is a
    // suite people stop reading. A genuinely broken test still fails on
    // its assertion, in milliseconds, and is unaffected by this.
    testTimeout: 20000,
    hookTimeout: 20000,
    // The Firestore rules suite needs the emulator and refuses to run
    // without it, so it is not part of `npm test` - a default run that
    // fails on every machine without a Java emulator teaches people to
    // ignore the result. Run it with `npm run test:rules`, which starts
    // the emulator around it.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/lib/firestoreRules.test.ts', 'src/lib/storageRules.test.ts'],
  },
})
