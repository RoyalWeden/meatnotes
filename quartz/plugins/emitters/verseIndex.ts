import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import {
  parseVerseRefs,
  expandRange,
  classifySlug,
  type VerseRef,
  type NoteSection,
} from "../../util/bibleBooks"
import fs from "fs"
import path from "path"

export interface VerseIndexEntry {
  slug: string
  title: string
  folder: NoteSection
}

export interface VerseIndexData {
  index: Record<string, VerseIndexEntry[]>
  cooccurrence: Record<string, string[]>
  connectionStrength?: Record<string, Record<string, number>>
  pdfConnections?: Record<string, string[]>
}

export const BibleVerseIndex: QuartzEmitterPlugin = () => {
  return {
    name: "BibleVerseIndex",
    async *emit(ctx, content) {
      const index: Record<string, VerseIndexEntry[]> = {}
      const noteVerses: Map<string, Set<string>> = new Map()

      for (const [_tree, file] of content) {
        const slug = file.data.slug!
        const text = file.data.text ?? ""
        const title = file.data.frontmatter?.title ?? slug.split("/").pop() ?? slug
        const folder = classifySlug(slug)

        const refs = parseVerseRefs(text)
        if (refs.length === 0) continue

        const verseKeys = new Set<string>()

        for (const ref of refs) {
          const expanded = expandRange(ref)
          for (const key of expanded) {
            verseKeys.add(key)

            if (!index[key]) index[key] = []
            // Avoid duplicate slug entries for the same verse
            if (!index[key].some((e) => e.slug === slug)) {
              index[key].push({ slug, title, folder })
            }
          }
        }

        if (verseKeys.size > 0) {
          noteVerses.set(slug, verseKeys)
        }
      }

      // Build PDF connections: for each verse, find PDFs linked from the same notes
      const pdfConnections: Record<string, string[]> = {}
      const pdfLinkRegex = /\[\[([^\]]+\.pdf)\]\]/gi
      for (const [_tree2, file2] of content) {
        const slug2 = file2.data.slug!
        const text2 = file2.data.text ?? ""
        const noteVs2 = noteVerses.get(slug2)
        if (!noteVs2 || noteVs2.size === 0) continue

        const pdfMatches = text2.matchAll(pdfLinkRegex)
        const pdfs = new Set<string>()
        for (const m of pdfMatches) pdfs.add(m[1])
        if (pdfs.size === 0) continue

        for (const verse of noteVs2) {
          if (!pdfConnections[verse]) pdfConnections[verse] = []
          const existing = new Set(pdfConnections[verse])
          for (const pdf of pdfs) {
            if (!existing.has(pdf)) {
              pdfConnections[verse].push(pdf)
              existing.add(pdf)
            }
          }
        }
      }

      // Build co-occurrence: for each verse, find other verses that appear in the same notes
      const cooccurrence: Record<string, string[]> = {}
      for (const verseKey of Object.keys(index)) {
        const coSet = new Set<string>()
        const entries = index[verseKey]

        for (const entry of entries) {
          const noteVs = noteVerses.get(entry.slug)
          if (!noteVs) continue
          for (const otherVerse of noteVs) {
            if (otherVerse !== verseKey) {
              coSet.add(otherVerse)
            }
          }
        }

        if (coSet.size > 0) {
          // Sort and cap at 50 co-occurring verses
          cooccurrence[verseKey] = [...coSet].sort().slice(0, 50)
        }
      }

      // Build connection strength: for each verse pair, count shared notes
      const connectionStrength: Record<string, Record<string, number>> = {}
      for (const verseKey of Object.keys(cooccurrence)) {
        const entrySlugs = new Set((index[verseKey] ?? []).map((e) => e.slug))
        const strengths: Record<string, number> = {}
        for (const otherVerse of cooccurrence[verseKey]) {
          const otherSlugs = new Set((index[otherVerse] ?? []).map((e) => e.slug))
          let shared = 0
          for (const s of entrySlugs) { if (otherSlugs.has(s)) shared++ }
          if (shared > 0) strengths[otherVerse] = shared
        }
        if (Object.keys(strengths).length > 0) connectionStrength[verseKey] = strengths
      }

      // Merge .bg-connections.json if it exists
      try {
        const bgPath = path.join(ctx.argv.directory, ".bg-connections.json")
        if (fs.existsSync(bgPath)) {
          const bgData = JSON.parse(fs.readFileSync(bgPath, "utf-8"))
          if (bgData && typeof bgData === "object") {
            for (const [verse, connections] of Object.entries(bgData)) {
              if (!Array.isArray(connections)) continue
              if (!cooccurrence[verse]) cooccurrence[verse] = []
              const existing = new Set(cooccurrence[verse])
              for (const conn of connections as string[]) {
                if (!existing.has(conn) && conn !== verse) {
                  cooccurrence[verse].push(conn)
                  existing.add(conn)
                }
              }

              // Add BG-only verses to the index so they're searchable
              if (!index[verse]) {
                index[verse] = [{ slug: "_bg", title: "BibleGateway", folder: "biblegateway" as NoteSection }]
              }
              for (const conn of connections as string[]) {
                if (!index[conn]) {
                  index[conn] = [{ slug: "_bg", title: "BibleGateway", folder: "biblegateway" as NoteSection }]
                }
              }
            }
          }
        }
      } catch {
        // Silently skip if .bg-connections.json is missing or malformed
      }

      const data: VerseIndexData = {
        index,
        cooccurrence,
        ...(Object.keys(connectionStrength).length > 0 ? { connectionStrength } : {}),
        ...(Object.keys(pdfConnections).length > 0 ? { pdfConnections } : {}),
      }

      const fp = joinSegments("static", "verseIndex") as FullSlug
      yield write({
        ctx,
        content: JSON.stringify(data),
        slug: fp,
        ext: ".json",
      })
    },
    externalResources: () => ({}),
    getQuartzComponents: () => [],
  }
}
