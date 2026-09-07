/**
 * Generates the printable QR posters the parish puts beside each station.
 *
 * Without these the QR feature cannot be used at all: the codes exist in
 * data.ts and the app reads them, but nobody can print one.
 *
 * Run:  node scripts/generate-qr-posters.mjs
 * Out:  public/qr/<CODE>.svg  (one A5 poster per station)
 *       public/qr/index.html  (all of them, for printing in one go)
 *
 * SVG, not PNG, and that is the point: these get printed at A5 or larger and
 * a raster QR resamples into unreadable mush at the printer's resolution.
 * Vector stays sharp at any size.
 *
 * The code encodes a URL rather than the bare station code. A bare code does
 * nothing at all in a phone's built-in camera app — which is how most people
 * will scan it — whereas a URL opens the app for someone who has it and the
 * web app for someone who does not. See extractStationCode in src/lib/qr.ts,
 * which accepts both.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const outDir = path.join(root, 'public', 'qr')

/**
 * Where a scanned code sends someone who does not have the app.
 *
 * Override when the app is deployed somewhere else:
 *   SANCTIWALK_BASE_URL=https://sanctiwalk.example node scripts/generate-qr-posters.mjs
 */
const BASE_URL = process.env.SANCTIWALK_BASE_URL || 'https://sanctiwalk.app'

// A5 at 96 px/inch, matching the print sizing used elsewhere in this project.
const PAGE_W = 559
const PAGE_H = 794

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, ch =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch],
  )
}

/**
 * Pulls the stations straight out of data.ts rather than keeping a second
 * list here. A poster sheet that has drifted from the app's own codes is
 * worse than none: every code on it would scan to "not added yet".
 */
function readStations() {
  const source = fs.readFileSync(path.join(root, 'src', 'data.ts'), 'utf8')
  const stations = []

  // data.ts is TypeScript with imports, so it cannot simply be required from
  // a plain node script. The fields needed here are literal strings, so they
  // are read directly — and every one is verified against the app's own
  // lookup by src/lib/qr.test.ts, which runs over the real data.
  const stationBlocks = source.split(/\n\s*\{\s*\n\s*id:\s*"/).slice(1)
  for (const block of stationBlocks) {
    const name = block.match(/\n\s*name:\s*"([^"]+)"/)?.[1]
    const qrCode = block.match(/\n\s*qrCode:\s*"([^"]+)"/)?.[1]
    if (name && qrCode) stations.push({ name, qrCode })
  }

  return stations
}

/** Which parish a code belongs to, from its prefix. */
const PARISH_BY_PREFIX = {
  MHCP: 'Mary Help of Christians Parish',
  SRC: 'San Roque Cathedral Parish',
}

function parishFor(code) {
  return PARISH_BY_PREFIX[code.split('-')[0]] ?? 'Diocese of Kalookan'
}

async function poster({ name, qrCode }) {
  const url = `${BASE_URL}/s/${qrCode}`

  // High error correction: these get taped to walls, catch candle smoke and
  // get scuffed. H tolerates about 30% of the code being unreadable.
  //
  // margin 4 is the spec's quiet zone, and it is not decoration — a QR
  // printed hard against other artwork, or against a dark wall, often will
  // not read at all. An earlier version of this script used margin 0.
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 4,
    width: 320,
  })

  // The module count depends on how much data the URL holds, so the viewBox
  // is READ from the generated code rather than assumed. Hardcoding it (this
  // script briefly assumed 41) silently scales and offsets the code inside
  // its frame the moment a station name changes the URL's length.
  const viewBox = qrSvg.match(/viewBox="([^"]+)"/)?.[1]
  if (!viewBox) throw new Error(`Could not read the QR viewBox for ${qrCode}`)

  // Strip the wrapper so the code can be positioned inside the poster.
  const inner = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">
  <rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>
  <text x="${PAGE_W / 2}" y="86" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="21" fill="#5b5b52">${escapeXml(parishFor(qrCode))}</text>
  <text x="${PAGE_W / 2}" y="128" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="bold" fill="#1c2c56">${escapeXml(name)}</text>

  <g transform="translate(${(PAGE_W - 320) / 2}, 178)">
    <svg width="320" height="320" viewBox="${viewBox}" shape-rendering="crispEdges">${inner}</svg>
  </g>

  <text x="${PAGE_W / 2}" y="556" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#1c2c56">Scan for the story of this place</text>
  <text x="${PAGE_W / 2}" y="590" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#5b5b52">Open your camera and point it here. No app needed.</text>

  <line x1="90" y1="640" x2="${PAGE_W - 90}" y2="640" stroke="#d8d5c8" stroke-width="1"/>
  <text x="${PAGE_W / 2}" y="676" text-anchor="middle" font-family="'Courier New', monospace" font-size="15" letter-spacing="2" fill="#8a8578">${escapeXml(qrCode)}</text>
  <text x="${PAGE_W / 2}" y="704" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#8a8578">SanctiWalk &#183; Diocese of Kalookan</text>
</svg>
`
}

async function main() {
  const stations = readStations()
  if (stations.length === 0) {
    console.error('No stations with a qrCode found in src/data.ts — nothing to generate.')
    process.exitCode = 1
    return
  }

  const codes = stations.map(s => s.qrCode)
  const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i)
  if (duplicates.length > 0) {
    // Two posters resolving to one station is a printing trap that would only
    // be discovered in the church, so it fails here instead.
    console.error(`Duplicate QR codes in data.ts: ${[...new Set(duplicates)].join(', ')}`)
    process.exitCode = 1
    return
  }

  fs.mkdirSync(outDir, { recursive: true })

  const links = []
  for (const station of stations) {
    const svg = await poster(station)
    fs.writeFileSync(path.join(outDir, `${station.qrCode}.svg`), svg, 'utf8')
    links.push(station)
    console.log(`  ${station.qrCode.padEnd(14)} ${station.name}`)
  }

  // One page that prints every poster, so the parish office does not have to
  // open and print five files by hand.
  const sheet = `<!doctype html>
<meta charset="utf-8">
<title>SanctiWalk station posters</title>
<style>
  @page { size: A5; margin: 0; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; }
  img { display: block; width: 100%; page-break-after: always; }
  .note { padding: 24px; color: #5b5b52; font-size: 14px; line-height: 1.5; }
  @media print { .note { display: none; } }
</style>
<div class="note">
  <strong>${links.length} station posters.</strong> Print at A5 or larger — bigger is easier to
  scan from a distance. Codes point at <code>${escapeXml(BASE_URL)}</code>; regenerate with
  <code>SANCTIWALK_BASE_URL=... node scripts/generate-qr-posters.mjs</code> if that changes.
</div>
${links.map(s => `<img src="${escapeXml(s.qrCode)}.svg" alt="${escapeXml(s.name)}">`).join('\n')}
`
  fs.writeFileSync(path.join(outDir, 'index.html'), sheet, 'utf8')

  console.log(`\n${links.length} posters written to public/qr/ (open public/qr/index.html to print)`)
}

await main()
