import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { allStationCodes, resolveScannedQr } from './qr'

/**
 * The whole QR chain, end to end, without a phone.
 *
 * generate-qr-posters.mjs encodes a URL → the poster is printed → the camera
 * decodes it with jsQR → qr.ts resolves it to a station. Every other test
 * here covers one link; this one proves they actually join up.
 *
 * It is the only part of the QR feature that can be verified on a machine
 * with no camera, so it is worth the two extra dev dependencies. What it
 * cannot prove is the camera loop itself — focus, motion blur, glare off a
 * laminated poster — and that still has to be tried on a real phone.
 */

const BASE_URL = 'https://sanctiwalk.app'

/**
 * These MUST match scripts/generate-qr-posters.mjs. Testing a different
 * encoding to the one that gets printed would prove nothing about the posters
 * actually taped to the wall.
 */
const POSTER_ENCODING = {
  errorCorrectionLevel: 'H',
  // The spec's quiet zone. Not decoration: a code printed hard against other
  // artwork or a dark wall often will not read at all.
  margin: 4,
  width: 320,
} as const

async function decodeQrFor(payload: string): Promise<string | null> {
  const buffer = await QRCode.toBuffer(payload, { ...POSTER_ENCODING, type: 'png' })

  const png = PNG.sync.read(buffer)
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null
}

describe('QR poster round trip', () => {
  const stations = allStationCodes()

  it('has posters to test', () => {
    expect(stations.length).toBeGreaterThan(0)
  })

  it.each(stations)('$code resolves back to $station', async ({ code, station }) => {
    // Exactly what the poster generator encodes.
    const decoded = await decodeQrFor(`${BASE_URL}/s/${code}`)
    expect(decoded).toBe(`${BASE_URL}/s/${code}`)

    const result = resolveScannedQr(decoded!)
    expect(result.kind).toBe('station')
    if (result.kind === 'station') {
      expect(result.match.station.name).toBe(station)
      expect(result.match.station.qrCode).toBe(code)
    }
  })

  it('survives the high error correction the posters are printed with', async () => {
    // Level H tolerates roughly 30% damage, which is what a poster taped to a
    // wall in a church actually endures — scuffing, candle smoke, a torn
    // corner. If this ever needs lowering, the posters get less forgiving.
    const decoded = await decodeQrFor(`${BASE_URL}/s/${stations[0].code}`)
    expect(decoded).not.toBeNull()
  })

  it('a poster for a code this build does not carry reports itself as such', async () => {
    const decoded = await decodeQrFor(`${BASE_URL}/s/BNL-ALTAR`)
    expect(resolveScannedQr(decoded!).kind).toBe('unknown-station')
  })
})

describe('the generated poster files', () => {
  const posterDir = path.resolve(__dirname, '..', '..', 'public', 'qr')
  const files = fs.existsSync(posterDir)
    ? fs.readdirSync(posterDir).filter(f => f.endsWith('.svg'))
    : []

  it('exist — run `npm run qr:posters` if this fails', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s frames the code exactly, with no scaling or offset', file => {
    const svg = fs.readFileSync(path.join(posterDir, file), 'utf8')

    // The nested QR svg, not the A5 page.
    const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)" shape-rendering/)
    expect(viewBox, 'no QR viewBox found').not.toBeNull()

    // How far the code's own path actually extends.
    const extent = svg.match(/d="M0 0h(\d+)v(\d+)/)
    expect(extent, 'no QR path found').not.toBeNull()

    // The bug this guards: the generator hardcoded a 41-module viewBox while
    // the code drew 33, so it rendered at 80% scale, off-centre, and with no
    // quiet zone on two sides. It still scanned on a screen — which is
    // exactly why it would have reached the church before anyone noticed.
    expect(viewBox![1]).toBe(extent![1])
    expect(viewBox![2]).toBe(extent![2])
  })

  it.each(files)('%s carries the printed station code as readable text', file => {
    const svg = fs.readFileSync(path.join(posterDir, file), 'utf8')
    const code = file.replace(/\.svg$/, '')
    // So a code can be typed in or read out when a camera will not cooperate.
    expect(svg).toContain(code)
  })
})
