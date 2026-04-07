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
      // Supports both new enriched format (with .connections object) and old flat format
      try {
        const bgPath = path.join(ctx.argv.directory, ".bg-connections.json")
        if (fs.existsSync(bgPath)) {
          const bgRaw = JSON.parse(fs.readFileSync(bgPath, "utf-8"))

          // Detect format: new enriched has a .connections object, old is flat {verse: string[]}
          const bgConnections: Record<string, string[]> =
            bgRaw?.connections && typeof bgRaw.connections === "object"
              ? bgRaw.connections  // new enriched format
              : bgRaw              // old flat format (backward compat)

          if (bgConnections && typeof bgConnections === "object") {
            // Helper: expand a BG connection ref (which may be a range or chapter) into
            // individual verse keys for cooccurrence lookup
            const expandBGRef = (ref: string): string[] => {
              // Range: "Isaiah 6:9-10"
              const rangeMatch = ref.match(/^(.+?)\s+(\d+):(\d+)-(\d+)$/)
              if (rangeMatch) {
                const vref: VerseRef = {
                  book: rangeMatch[1],
                  chapter: parseInt(rangeMatch[2]),
                  verse: parseInt(rangeMatch[3]),
                  endVerse: parseInt(rangeMatch[4]),
                  raw: ref,
                }
                return expandRange(vref)
              }
              // Single verse: "Hosea 8:11" — return as-is
              if (ref.match(/^.+?\s+\d+:\d+$/)) return [ref]
              // Chapter-only: "Ephesians 2" — return as-is (chapter-level entry)
              return [ref]
            }

            for (const [verse, connections] of Object.entries(bgConnections)) {
              if (!Array.isArray(connections)) continue

              // Expand the source verse itself (it may also be a range/chapter)
              const sourceKeys = expandBGRef(verse)

              for (const conn of connections as string[]) {
                if (conn === verse) continue
                const targetKeys = expandBGRef(conn)

                // Create cooccurrence links between all expanded source keys and target keys
                for (const sk of sourceKeys) {
                  if (!cooccurrence[sk]) cooccurrence[sk] = []
                  const existing = new Set(cooccurrence[sk])
                  for (const tk of targetKeys) {
                    if (!existing.has(tk) && tk !== sk) {
                      cooccurrence[sk].push(tk)
                      existing.add(tk)
                    }
                  }
                  // Ensure expanded keys are in the index
                  if (!index[sk]) {
                    index[sk] = [{ slug: "_bg", title: "BibleGateway", folder: "biblegateway" as NoteSection }]
                  }
                }

                for (const tk of targetKeys) {
                  if (!index[tk]) {
                    index[tk] = [{ slug: "_bg", title: "BibleGateway", folder: "biblegateway" as NoteSection }]
                  }
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
