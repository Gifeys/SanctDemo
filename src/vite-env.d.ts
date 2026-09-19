/// <reference types="vite/client" />

// Vite's ambient types, which this project had never needed until the
// backend address became a build-time setting. Without this, TypeScript does
// not know `import.meta.env` exists.

interface ImportMetaEnv {
  /**
   * Absolute URL of the Express backend, e.g. https://sanctiwalk.example.com
   *
   * Left unset for the web build, where SanctiWalk is served by that same
   * backend and relative /api paths are correct. Set when packaging the
   * Android app, which serves its own files and has no server at its origin.
   */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
