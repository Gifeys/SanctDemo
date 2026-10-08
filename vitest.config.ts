import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // The Firestore rules suite needs the emulator and refuses to run
    // without it, so it is not part of `npm test` - a default run that
    // fails on every machine without a Java emulator teaches people to
    // ignore the result. Run it with `npm run test:rules`, which starts
    // the emulator around it.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/lib/firestoreRules.test.ts'],
  },
})
