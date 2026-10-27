// Writes public/download/latest.json, the file an installed SanctiWalk
// checks to find out whether it is out of date.
//
// Generated rather than hand-maintained, and generated from package.json,
// because it has to agree with the versionCode the Android build derives
// from that same field. A hand-edited copy that disagrees would either
// nag every launch or never offer the update at all.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))

const [major, minor, patch] = String(pkg.version).split('.').map(Number)
if ([major, minor, patch].some(n => !Number.isInteger(n))) {
  throw new Error(`package.json version "${pkg.version}" is not major.minor.patch`)
}

const out = resolve(root, 'public/download/latest.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(
  out,
  JSON.stringify(
    {
      versionName: pkg.version,
      versionCode: major * 10000 + minor * 100 + patch,
      url: 'https://sanct-demo-vxzb.vercel.app/download/SanctiWalk.apk',
      notes: pkg.releaseNotes ?? '',
    },
    null,
    2,
  ) + '\n',
)
console.log(`latest.json -> ${pkg.version} (${major * 10000 + minor * 100 + patch})`)
