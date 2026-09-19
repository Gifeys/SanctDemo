import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

/**
 * Copies MapLibre's Web Worker into the build output.
 *
 * MapLibre 6 does not import its worker statically. It computes the URL at
 * runtime - `new URL('./maplibre-gl-worker.mjs', import.meta.url)` - which
 * Vite cannot see, so the file is never emitted. The bundle then requests
 * /assets/maplibre-gl-worker.mjs, gets a 404, and the map renders nothing at
 * all: no tiles, no pins, no error the user can act on.
 *
 * It worked in the dev server, which serves straight from node_modules, and
 * failed only in a production build - so it reached a packaged APK before
 * anyone saw it.
 */
function copyMapLibreWorker() {
  // BOTH files. The worker is not self-contained - it does
  // `import ... from "./maplibre-gl-shared.mjs"`, so emitting the worker
  // alone gets it fetched and then failing on a missing import, which looks
  // identical to the original bug.
  const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

  return {
    name: 'copy-maplibre-worker',
    apply: 'build' as const,
    generateBundle() {
      for (const file of files) {
        const source = `node_modules/maplibre-gl/dist/${file}`;
        if (!fs.existsSync(source)) {
          this.warn(`MapLibre ${file} not found; the map will not render.`);
          continue;
        }
        this.emitFile({
          type: 'asset',
          fileName: `assets/${file}`,
          source: fs.readFileSync(source, 'utf8'),
        });
      }
    },
  };
}

export default defineConfig(({command}) => {
  return {
    plugins: [react(), tailwindcss(), copyMapLibreWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // The exclusion below is DEV-ONLY.
    //
    // Excluding maplibre-gl fixes a dev-server HMR problem, but applied to a
    // production build it also stops Vite emitting the library's Web Worker:
    // the bundle then requests /assets/maplibre-gl-worker.mjs at runtime, gets
    // a 404, and the map renders nothing. That reached a packaged APK before
    // anyone noticed, because the dev server had the file and the build did
    // not.
    optimizeDeps: {
      // maplibre-gl loads its tile-processing code as a separate module
      // Worker (`new Worker(new URL(...), { type: 'module' })`), which
      // esbuild's dependency pre-bundler can't see statically. Pre-bundling
      // the package anyway leaves the worker chunk out of the optimized
      // deps directory, which desyncs Vite's dev-time module graph (stale
      // "does not provide an export named 'default'" errors after HMR).
      // Excluding it serves the package straight from node_modules, where
      // the worker file resolves correctly.
      // Dev only - see above. `command` is 'serve' for the dev server and
      // 'build' for a production build.
      exclude: command === 'serve' ? ['maplibre-gl'] : [],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      //
      // The HMR websocket needs its own port, and Vite's default (24678) is
      // fixed, so a second dev server on this machine collides with the
      // first and loses hot reload even after autoPort has moved its HTTP
      // port out of the way. Deriving it from PORT keeps concurrent
      // sessions independent.
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : process.env.PORT
            ? {port: Number(process.env.PORT) + 1}
            : true,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              // Never watch the Android build output.
              //
              // Adding Capacitor put ~160 MB of Gradle artifacts and APKs
              // under android/, and Vite watched all of it. Copying an APK
              // out of that folder locked the file on Windows, the watcher
              // threw EBUSY, and the dev server died - after 45 hours of
              // uptime, for no reason connected to the web app at all.
              ignored: ['**/android/**', '**/dist/**', '**/.gradle/**'],
            },
    },
  };
});
