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
            }
          }
        }
      } catch {
        // Silently skip if .bg-connections.json is missing or malformed
      }

      const data: VerseIndexData = { index, cooccurrence }

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
