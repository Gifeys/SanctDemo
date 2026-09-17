/**
 * Compiles a PNG into a MindAR `.mind` tracking target.
 *
 * Run:  node scripts/compile-ar-target.mjs public/ar/targets/main-altar-target.png
 * Out:  the same path with a .mind extension
 *
 * WHY THIS EXISTS RATHER THAN MindAR's OWN OfflineCompiler
 *
 * MindAR ships `OfflineCompiler`, but it imports the `canvas` npm package —
 * a native module that needs Visual Studio C++ build tools and fails to build
 * on this machine. (That failure is also why mind-ar had to be installed with
 * --ignore-scripts.)
 *
 * `canvas` is used for exactly one thing: turning an image into raw pixels.
 * CompilerBase asks for a canvas, calls drawImage, then getImageData. So this
 * subclasses CompilerBase directly and hands it a shim whose getImageData
 * returns pixels decoded by pngjs — pure JavaScript, no native build. The
 * compiled output is identical; only the way the pixels arrive differs.
 *
 * compileTrack is lifted from OfflineCompiler unchanged. It never touched
 * canvas in the first place.
 */

import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js'
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js'
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js'
// Registers the CPU kernels the detector runs on. Without this, tfjs has no
// backend in Node and feature extraction fails with an opaque error.
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js'

class NodeCompiler extends CompilerBase {
  /**
   * Stands in for an HTML canvas.
   *
   * CompilerBase only ever calls drawImage (which it expects to paint the
   * image at 0,0) and then getImageData. Since the pixels are already decoded
   * and attached to `img`, drawImage has nothing to do and getImageData hands
   * the same buffer straight back.
   */
  createProcessCanvas(img) {
    return {
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({ data: img.data, width: img.width, height: img.height }),
      }),
    }
  }

  compileTrack({ progressCallback, targetImages, basePercent }) {
    return new Promise(resolve => {
      const percentPerImage = (100 - basePercent) / targetImages.length
      let percent = 0
      const list = []
      for (const targetImage of targetImages) {
        const imageList = buildTrackingImageList(targetImage)
        const percentPerAction = percentPerImage / imageList.length
        const trackingData = extractTrackingFeatures(imageList, () => {
          percent += percentPerAction
          progressCallback(basePercent + percent)
        })
        list.push(trackingData)
      }
      resolve(list)
    })
  }
}

function loadPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file))
  // The shape CompilerBase expects of an "image": width, height, and RGBA
  // pixels reachable from the canvas shim above.
  return { width: png.width, height: png.height, data: png.data }
}

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: node scripts/compile-ar-target.mjs <image.png>')
    process.exitCode = 1
    return
  }
  if (!fs.existsSync(input)) {
    console.error(`No such file: ${input}`)
    process.exitCode = 1
    return
  }

  const image = loadPng(input)
  console.log(`Compiling ${input} (${image.width}x${image.height})`)

  const compiler = new NodeCompiler()
  let lastReported = -10
  const data = await compiler.compileImageTargets([image], percent => {
    // Compiling takes minutes on a large image; silence looks like a hang.
    if (percent - lastReported >= 10) {
      lastReported = percent
      console.log(`  ${percent.toFixed(0)}%`)
    }
  })

  // The numbers that decide whether this target will actually track. Matching
  // features are what let MindAR FIND the image; tracking features are what
  // let it hold on once found. A target with few of either looks fine to a
  // person and fails on a phone.
  const matchingCounts = data[0].matchingData.map(m => m.maximaPoints.length + m.minimaPoints.length)
  const trackingCounts = data[0].trackingData.map(t => t.points.length)
  console.log(`\nMatching features per scale: ${matchingCounts.join(', ')}`)
  console.log(`  total: ${matchingCounts.reduce((a, b) => a + b, 0)}`)
  console.log(`Tracking features per scale: ${trackingCounts.join(', ')}`)
  console.log(`  total: ${trackingCounts.reduce((a, b) => a + b, 0)}`)

  const buffer = compiler.exportData()
  const output = input.replace(/\.[^.]+$/, '') + '.mind'
  fs.writeFileSync(output, Buffer.from(buffer))

  const size = fs.statSync(output).size
  console.log(`\nWrote ${output} (${(size / 1024).toFixed(0)} KB)`)
}

await main()
