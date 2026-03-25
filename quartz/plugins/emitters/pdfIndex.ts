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
  lastModified: number
  thumbnail: string
  isExternal: false
  hidden?: boolean
  tags?: string[]
}

export interface ExternalPdfEntry {
  title: string
  url: string
  description?: string
  isExternal: true
  hidden?: boolean
  tags?: string[]
}

export interface WebLinkEntry {
  title: string
  url: string
  description?: string
  isLink: true
  tags?: string[]
}

export interface PdfGroupEntry {
  name: string
  tags?: string[]
  items: Array<{ slug?: string; url?: string; label?: string; hidden?: boolean }>
}

export type PdfIndex = {
  local: PdfIndexEntry[]
  external: ExternalPdfEntry[]
  links: WebLinkEntry[]
  groups: PdfGroupEntry[]
}

// ─── Code block parsers ───────────────────────────────────────────────────────

function extractCodeBlocks(md: string, lang: string): string[] {
  const re = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g")
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) out.push(m[1])
  return out
}

function parseTags(val: string): string[] {
  return val.split(",").map((t) => t.trim()).filter(Boolean)
}

function parseKV(block: string): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const line of block.trim().split("\n")) {
    const i = line.indexOf(":")
    if (i < 1) continue
    obj[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return obj
}

function parseExternalPdfBlocks(md: string): ExternalPdfEntry[] {
  return extractCodeBlocks(md, "pdf-external")
    .map((b) => {
      const kv = parseKV(b)
      return {
        title: kv.title || "",
        url: kv.url || "",
        description: kv.description,
        tags: kv.tags ? parseTags(kv.tags) : undefined,
        isExternal: true as const,
      }
    })
    .filter((e) => e.url)
}

function parseWebLinkBlocks(md: string): WebLinkEntry[] {
  return extractCodeBlocks(md, "pdf-link")
    .map((b) => {
      const kv = parseKV(b)
      return {
        title: kv.title || "",
        url: kv.url || "",
        description: kv.description,
        tags: kv.tags ? parseTags(kv.tags) : undefined,
        isLink: true as const,
      }
    })
    .filter((e) => e.url)
}

function parsePdfLocalBlocks(md: string): Map<string, { tags?: string[] }> {
  const map = new Map<string, { tags?: string[] }>()
  for (const b of extractCodeBlocks(md, "pdf-local")) {
    const kv = parseKV(b)
    if (kv.slug) {
      map.set(kv.slug.replace(/ /g, "-"), {
        tags: kv.tags ? parseTags(kv.tags) : undefined,
      })
    }
  }
  return map
}

function parsePdfGroupBlocks(md: string): PdfGroupEntry[] {
  return extractCodeBlocks(md, "pdf-group")
    .map((b) => {
      let name = ""
      let tags: string[] | undefined
      const items: PdfGroupEntry["items"] = []
      for (const line of b.trim().split("\n")) {
        const t = line.trim()
        if (t.startsWith("name:")) {
          name = t.slice(5).trim()
        } else if (t.startsWith("tags:")) {
          tags = parseTags(t.slice(5).trim())
        } else if (t.startsWith("-")) {
          const parts = t.slice(1).split("|").map((p) => p.trim())
          const ref = parts[0] ?? ""
          const label = parts[1] || undefined
          const hidden = parts.slice(2).some((p) => p.toLowerCase() === "hidden")
          const item: PdfGroupEntry["items"][0] = {}
          if (label) item.label = label
          if (hidden) item.hidden = true
          if (ref.startsWith("http")) {
            item.url = ref
          } else {
            item.slug = ref.replace(/ /g, "-")
          }
          if (item.url || item.slug) items.push(item)
        }
      }
      return { name, items, ...(tags ? { tags } : {}) }
    })
    .filter((g) => g.name && g.items.length > 0)
}

// ─── Emitter ──────────────────────────────────────────────────────────────────

export const PdfIndex: QuartzEmitterPlugin = () => ({
  name: "PdfIndex",
  async *emit(ctx, _content) {
    const cfg = ctx.cfg.configuration
    const contentDir = ctx.argv.directory
    const outputDir = ctx.argv.output

    // Find all PDF files in content directory
    const pdfFiles = await glob("**/*.pdf", contentDir, cfg.ignorePatterns)

    // Read Books-and-PDFs.md body and parse code blocks
    const booksFilePath = path.join(contentDir, "Books-and-PDFs.md")
    let rawMd = ""
    try {
      rawMd = fs.readFileSync(booksFilePath, "utf-8")
    } catch {
      // file not found — use empty defaults
    }

    const externalPdfs = parseExternalPdfBlocks(rawMd)
    const webLinks = parseWebLinkBlocks(rawMd)
    const pdfGroups = parsePdfGroupBlocks(rawMd)
    const localMeta = parsePdfLocalBlocks(rawMd)

    // Build hidden sets from group items
    const hiddenSlugs = new Set<string>()
    const hiddenUrls = new Set<string>()
    for (const g of pdfGroups) {
      for (const item of g.items) {
        if (item.hidden) {
          if (item.slug) hiddenSlugs.add(item.slug)
          if (item.url) hiddenUrls.add(item.url)
        }
      }
    }

    // Mark hidden on external entries
    for (const e of externalPdfs) {
      if (hiddenUrls.has(e.url)) e.hidden = true
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

      // Apply metadata from pdf-local blocks
      const meta = localMeta.get(slug)

      localEntries.push({
        slug,
        title,
        filename,
        pageCount,
        fileSize: stats.size,
        lastModified: Math.floor(stats.mtimeMs),
        thumbnail: `static/pdf-thumbs/${thumbSlug}.jpg`,
        isExternal: false as const,
        ...(hiddenSlugs.has(slug) ? { hidden: true } : {}),
        ...(meta?.tags ? { tags: meta.tags } : {}),
      })
    }

    // Write pdfIndex.json
    const indexContent: PdfIndex = {
      local: localEntries,
      external: externalPdfs,
      links: webLinks,
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
