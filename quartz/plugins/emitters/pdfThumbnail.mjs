// Separate process for PDF thumbnail generation
// Avoids libvips/canvas conflict with sharp
import { createCanvas } from "canvas"
import fs from "fs"

const args = JSON.parse(process.argv[2])
const { pdfPath, thumbPath, width } = args

async function generate() {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise

  const pageCount = doc.numPages

  // Get metadata
  let title = ""
  try {
    const meta = await doc.getMetadata()
    const pdfTitle = meta.info?.Title
    if (pdfTitle && typeof pdfTitle === "string" && pdfTitle.trim().length > 0 && pdfTitle.length < 200) {
      title = pdfTitle.trim()
    }
  } catch {}

  // Render page 1 thumbnail
  const page = await doc.getPage(1)
  const baseViewport = page.getViewport({ scale: 1.0 })
  const scale = (width || 300) / baseViewport.width
  const viewport = page.getViewport({ scale })

  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
  const context = canvas.getContext("2d")

  await page.render({ canvasContext: context, viewport }).promise

  // Lighten the thumbnail slightly for better visibility
  context.globalCompositeOperation = "lighter"
  context.fillStyle = "rgba(255, 255, 255, 0.08)"
  context.fillRect(0, 0, Math.round(viewport.width), Math.round(viewport.height))
  context.globalCompositeOperation = "source-over"

  const buffer = canvas.toBuffer("image/jpeg", { quality: 0.8 })
  fs.writeFileSync(thumbPath, buffer)

  doc.destroy()

  // Output metadata as JSON with a marker to find it in stdout
  process.stdout.write("__PDF_META__" + JSON.stringify({ pageCount, title }))
}

generate().catch((e) => {
  console.error(e)
  // Output minimal metadata even on failure
  process.stdout.write("__PDF_META__" + JSON.stringify({ pageCount: 0, title: "" }))
  process.exit(0) // Don't fail the build
})
