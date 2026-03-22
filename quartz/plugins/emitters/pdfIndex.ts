import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { glob } from "../../util/glob"
import { write } from "./helpers"

export interface PdfIndexEntry {
  slug: string
  title: string
  filename: string
  pageCount: number
  fileSize: number
  thumbnail: string
  isExternal: false
}

export interface ExternalPdfEntry {
  title: string
  url: string
  description?: string
  isExternal: true
}

export interface PdfGroupEntry {
  name: string
  items: Array<{ slug?: string; url?: string; label?: string }>
}

export type PdfIndex = {
  local: PdfIndexEntry[]
  external: ExternalPdfEntry[]
  groups: PdfGroupEntry[]
}

export const PdfIndex: QuartzEmitterPlugin = () => ({
  name: "PdfIndex",
  async *emit(ctx, content) {
    const cfg = ctx.cfg.configuration
    const contentDir = ctx.argv.directory
    const outputDir = ctx.argv.output

    // Find all PDF files in content directory
    const pdfFiles = await glob("**/*.pdf", contentDir, cfg.ignorePatterns)

    // Find the Books-and-PDFs page for external PDF definitions and groups
    let externalPdfs: ExternalPdfEntry[] = []
    let pdfGroups: PdfGroupEntry[] = []
    for (const [_tree, file] of content) {
      if (file.data.slug === "Books-and-PDFs") {
        const rawExternal = file.data.frontmatter?.externalPdfs as
          | Array<{ title: string; url: string; description?: string }>
          | undefined
        if (rawExternal) {
          externalPdfs = rawExternal.map((e) => ({
            title: e.title,
            url: e.url,
            description: e.description,
            isExternal: true as const,
          }))
        }
        const rawGroups = file.data.frontmatter?.pdfGroups as
          | Array<{ name: string; items: Array<{ slug?: string; url?: string; label?: string }> }>
          | undefined
        if (rawGroups && Array.isArray(rawGroups)) {
          pdfGroups = rawGroups
        }
        break
      }
    }

    // Generate thumbnails and collect metadata
    const localEntries: PdfIndexEntry[] = []
    const thumbDir = joinSegments(outputDir, "static", "pdf-thumbs")
    await fs.promises.mkdir(thumbDir, { recursive: true })

    // Copy PDF.js files to static output
    const workerSrc = path.join("node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs")
    const workerDest = joinSegments(outputDir, "static", "pdf.worker.min.mjs")
    await fs.promises.mkdir(path.dirname(workerDest), { recursive: true })
    await fs.promises.copyFile(workerSrc, workerDest)

    const pdfSrc = path.join("node_modules", "pdfjs-dist", "build", "pdf.min.mjs")
    const pdfDest = joinSegments(outputDir, "static", "pdf.min.mjs")
    await fs.promises.copyFile(pdfSrc, pdfDest)

    // Thumbnail generation script path
    const thumbScript = path.join("quartz", "plugins", "emitters", "pdfThumbnail.mjs")

    for (const pdfRelPath of pdfFiles) {
      const fullPath = path.join(contentDir, pdfRelPath)
      const stats = await fs.promises.stat(fullPath)

      const slug = pdfRelPath.replace(/ /g, "-")
      const filename = path.basename(pdfRelPath)
      const thumbSlug = slug.replace(/\.pdf$/i, "").replace(/[/\\]/g, "-")
      const thumbPath = path.join(thumbDir, `${thumbSlug}.jpg`)

      let pageCount = 0
      let title = filename.replace(/\.pdf$/i, "")

      try {
        // Run thumbnail generation in a separate process
        // to avoid canvas/sharp library conflicts
        const result = execFileSync("node", [
          "--experimental-vm-modules",
          thumbScript,
          JSON.stringify({ pdfPath: fullPath, thumbPath, width: 300 }),
        ], {
          encoding: "utf-8",
          timeout: 30000,
          stdio: ["pipe", "pipe", "pipe"],
        })

        // Extract JSON after the marker (pdfjs warnings may precede it on stdout)
        const markerIdx = result.indexOf("__PDF_META__")
        const jsonStr = markerIdx >= 0 ? result.slice(markerIdx + "__PDF_META__".length).trim() : result.trim()
        const metadata = JSON.parse(jsonStr)
        pageCount = metadata.pageCount || 0
        if (metadata.title) {
          title = metadata.title
        }
      } catch (e: any) {
        console.warn(`[PdfIndex] Failed to process ${filename}:`, e.stderr || e.message)
      }

      localEntries.push({
        slug,
        title,
        filename,
        pageCount,
        fileSize: stats.size,
        thumbnail: `static/pdf-thumbs/${thumbSlug}.jpg`,
        isExternal: false as const,
      })
    }

    // Write pdfIndex.json
    const indexContent: PdfIndex = {
      local: localEntries,
      external: externalPdfs,
      groups: pdfGroups,
    }

    yield write({
      ctx,
      content: JSON.stringify(indexContent),
      slug: joinSegments("static", "pdfIndex") as FullSlug,
      ext: ".json",
    })

    yield workerDest as FilePath
    yield pdfDest as FilePath
  },
  async *partialEmit() {},
})
