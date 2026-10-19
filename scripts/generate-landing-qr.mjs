/**
 * Generates the QR code on the download page.
 *
 * Run:  node scripts/generate-landing-qr.mjs
 * Out:  public/get/qr.svg
 *
 * SVG for the same reason the station posters are SVG: this code gets
 * projected onto a wall and printed on handouts, and a raster QR
 * resamples into unreadable mush at either size. Vector stays sharp.
 *
 * Error correction is set to M rather than the default. The code is
 * short enough that M costs almost nothing in density, and it survives
 * a projector's focus and a phone camera held at an angle across a
 * room - which is exactly how it will be read.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import QRCode from 'qrcode'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'public', 'get')
const OUT = join(OUT_DIR, 'qr.svg')

/**
 * Where the code points.
 *
 * The landing page, not the app itself. Someone scanning this may be on
 * an iPhone, an Android, or holding a laptop up to the screen, and the
 * page is the thing that knows what to offer each of them. Sending the
 * code straight to the app would hand an Android user the web version
 * and never mention the APK.
 */
const TARGET = process.env.LANDING_URL || 'https://sanct-demo-vxzb.vercel.app/get/'

const svg = await QRCode.toString(TARGET, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 1,
  color: {
    // The app's navy on its paper white, so the code belongs to the page
    // rather than sitting on it. Contrast is still far beyond what any
    // scanner needs.
    dark: '#1C2C56',
    light: '#FAF8F4',
  },
})

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, svg, 'utf8')

console.log(`QR written to public/get/qr.svg`)
console.log(`  points at: ${TARGET}`)
console.log(`  change it: LANDING_URL=https://your-url node scripts/generate-landing-qr.mjs`)
