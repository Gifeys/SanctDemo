import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // maplibre-gl loads its tile-processing code as a separate module
      // Worker (`new Worker(new URL(...), { type: 'module' })`), which
      // esbuild's dependency pre-bundler can't see statically. Pre-bundling
      // the package anyway leaves the worker chunk out of the optimized
      // deps directory, which desyncs Vite's dev-time module graph (stale
      // "does not provide an export named 'default'" errors after HMR).
      // Excluding it serves the package straight from node_modules, where
      // the worker file resolves correctly.
      exclude: ['maplibre-gl'],
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
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
