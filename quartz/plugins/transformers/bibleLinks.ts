import { QuartzTransformerPlugin } from "../types"
import { books, bookPattern, normalizeRef } from "../../util/bibleBooks"
import { Root } from "hast"
import { visit } from "unist-util-visit"

// LXX book code mapping for ebible.org/eng-Brenton
const lxxBooks: Record<string, string> = {
  // OT canonical
  genesis: "GEN",
  gen: "GEN",
  exodus: "EXO",
  exod: "EXO",
  exo: "EXO",
  leviticus: "LEV",
  lev: "LEV",
  numbers: "NUM",
  num: "NUM",
  deuteronomy: "DEU",
  deut: "DEU",
  deu: "DEU",
  joshua: "JOS",
  josh: "JOS",
  judges: "JDG",
  judg: "JDG",
  ruth: "RUT",
  "1 samuel": "1SA",
  "1 sam": "1SA",
  "1sam": "1SA",
  "2 samuel": "2SA",
  "2 sam": "2SA",
  "2sam": "2SA",
  "1 kings": "1KI",
  "1kings": "1KI",
  "2 kings": "2KI",
  "2kings": "2KI",
  "1 chronicles": "1CH",
  "1 chron": "1CH",
  "1chron": "1CH",
  "2 chronicles": "2CH",
  "2 chron": "2CH",
  "2chron": "2CH",
  ezra: "EZR",
  nehemiah: "NEH",
  neh: "NEH",
  esther: "EST",
  esth: "EST",
  job: "JOB",
  psalm: "PSA",
  psalms: "PSA",
  ps: "PSA",
  psa: "PSA",
  proverbs: "PRO",
  prov: "PRO",
  pro: "PRO",
  ecclesiastes: "ECC",
  eccl: "ECC",
  ecc: "ECC",
  "song of solomon": "SNG",
  song: "SNG",
  sos: "SNG",
  isaiah: "ISA",
  isa: "ISA",
  jeremiah: "JER",
  jer: "JER",
  lamentations: "LAM",
  lam: "LAM",
  ezekiel: "EZK",
  ezek: "EZK",
  eze: "EZK",
  daniel: "DAN",
  dan: "DAN",
  hosea: "HOS",
  hos: "HOS",
  joel: "JOL",
  amos: "AMO",
  obadiah: "OBA",
  obad: "OBA",
  jonah: "JON",
  jon: "JON",
  micah: "MIC",
  mic: "MIC",
  nahum: "NAH",
  nah: "NAH",
  habakkuk: "HAB",
  hab: "HAB",
  zephaniah: "ZEP",
  zeph: "ZEP",
  haggai: "HAG",
  hag: "HAG",
  zechariah: "ZEC",
  zech: "ZEC",
  malachi: "MAL",
  mal: "MAL",
  // Deuterocanonical
  tobit: "TOB",
  tob: "TOB",
  judith: "JDT",
  jdt: "JDT",
  "wisdom of solomon": "WIS",
  wisdom: "WIS",
  wis: "WIS",
  sirach: "SIR",
  ecclesiasticus: "SIR",
  sir: "SIR",
  baruch: "BAR",
  bar: "BAR",
  "letter of jeremiah": "LJE",
  "epistle of jeremiah": "LJE",
  "let jer": "LJE",
  "additions to esther": "ADE",
  "rest of esther": "ADE",
  "add esth": "ADE",
  "prayer of azariah": "S3Y",
  "song of three holy children": "S3Y",
  "song of the three": "S3Y",
  susanna: "SUS",
  sus: "SUS",
  "bel and the dragon": "BEL",
  bel: "BEL",
  "1 maccabees": "1MA",
  "1 macc": "1MA",
  "1macc": "1MA",
  "2 maccabees": "2MA",
  "2 macc": "2MA",
  "2macc": "2MA",
  "3 maccabees": "3MA",
  "3 macc": "3MA",
  "3macc": "3MA",
  "4 maccabees": "4MA",
  "4 macc": "4MA",
  "4macc": "4MA",
  "prayer of manasseh": "MAN",
  manasseh: "MAN",
  "1 esdras": "1ES",
  "1esdras": "1ES",
  "2 esdras": "2ES",
  "2esdras": "2ES",
}

// KJV Apocrypha book slug mapping for kingjamesbibleonline.org
// Only standard KJV Apocrypha books (3 & 4 Maccabees excluded — not standard KJV)
const kjbApocryphaBooks: Record<string, string> = {
  tobit: "Tobit",
  tob: "Tobit",
  judith: "Judith",
  jdt: "Judith",
  "wisdom of solomon": "Wisdom-of-Solomon",
  wisdom: "Wisdom-of-Solomon",
  wis: "Wisdom-of-Solomon",
  sirach: "Ecclesiasticus",
  ecclesiasticus: "Ecclesiasticus",
  sir: "Ecclesiasticus",
  baruch: "Baruch",
  bar: "Baruch",
  "letter of jeremiah": "Letter-of-Jeremiah",
  "epistle of jeremiah": "Letter-of-Jeremiah",
  "let jer": "Letter-of-Jeremiah",
  "additions to esther": "Additions-to-Esther",
  "rest of esther": "Additions-to-Esther",
  "add esth": "Additions-to-Esther",
  "prayer of azariah": "Prayer-of-Azariah",
  "song of three holy children": "Prayer-of-Azariah",
  "song of the three": "Prayer-of-Azariah",
  susanna: "Susanna",
  sus: "Susanna",
  "bel and the dragon": "Bel-and-the-Dragon",
  bel: "Bel-and-the-Dragon",
  "1 maccabees": "1-Maccabees",
  "1 macc": "1-Maccabees",
  "1macc": "1-Maccabees",
  "2 maccabees": "2-Maccabees",
  "2 macc": "2-Maccabees",
  "2macc": "2-Maccabees",
  "prayer of manasseh": "Prayer-of-Manasseh",
  manasseh: "Prayer-of-Manasseh",
  "1 esdras": "1-Esdras",
  "1esdras": "1-Esdras",
  "2 esdras": "2-Esdras",
  "2esdras": "2-Esdras",
}

const kjbApocryphaBookPattern = Object.keys(kjbApocryphaBooks)
  .sort((a, b) => b.length - a.length)
  .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")

const lxxBookPattern = Object.keys(lxxBooks)
  .sort((a, b) => b.length - a.length)
  .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")

// Canonical Bible regexes (BibleGateway)
// Note: [ \t]+ (horizontal whitespace only) prevents cross-line matching.
// Lookbehind includes \[ to avoid re-matching inside already-created links.

// Versioned refs: "Zephaniah 3:18 (CJB)" — captures (book, chapter, verse, version)
// (?!LXX\b) excludes LXX (handled separately by lxxVerseRegex / lxxChapterRegex)
const versionedVerseRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${bookPattern})[ \\t]+(\\d+):(\\d+(?:-\\d+)?)[ \\t]+\\((?!LXX\\b)([A-Z][A-Z0-9-]{0,9})\\)(?!\\])`,
  "gi",
)

// Versioned chapter: "Zephaniah 3 (CJB)" — captures (book, chapter, version)
const versionedChapterRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${bookPattern})[ \\t]+(\\d+(?:-\\d+)?)[ \\t]+\\((?!LXX\\b)([A-Z][A-Z0-9-]{0,9})\\)(?![:\\d\\]])`,
  "gi",
)

// Default (no translation tag) — version supplied at runtime from frontmatter or KJV fallback
const verseRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${bookPattern})[ \\t]+(\\d+):(\\d+(?:-\\d+)?)(?!\\])`,
  "gi",
)

// Matches chapter-only (e.g. "John 5") and chapter ranges (e.g. "John 5-9"),
// but NOT verse refs already handled by verseRegex (no colon after chapter),
// and NOT inside already-created markdown links (negative lookbehind for "[").
const chapterRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${bookPattern})[ \\t]+(\\d+(?:-\\d+)?)(?![:\\d\\]])`,
  "gi",
)

// LXX regexes — require "(LXX)" suffix; verse ref matched first
const lxxVerseRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${lxxBookPattern})[ \\t]+(\\d+):(\\d+(?:-\\d+)?)[ \\t]+\\(LXX\\)(?!\\])`,
  "gi",
)

const lxxChapterRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${lxxBookPattern})[ \\t]+(\\d+(?:-\\d+)?)[ \\t]+\\(LXX\\)(?![:\\d\\]])`,
  "gi",
)

// KJB Online apocrypha regexes — match apocrypha books WITHOUT (LXX) suffix
// These run after LXX passes so (LXX)-tagged refs are already linked and protected
const kjbApocryphaVerseRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${kjbApocryphaBookPattern})[ \\t]+(\\d+):(\\d+(?:-\\d+)?)(?!\\])`,
  "gi",
)

const kjbApocryphaChapterRegex = new RegExp(
  `(?<![\\w/>"'\\[])\\b(${kjbApocryphaBookPattern})[ \\t]+(\\d+(?:-\\d+)?)(?![:\\d\\]])`,
  "gi",
)

function kjbApocryphaUrl(slug: string, chapter: string, verse?: string): string {
  const base = "https://www.kingjamesbibleonline.org"
  if (!verse) return `${base}/${slug}-${chapter}/`
  if (verse.includes("-")) {
    const [start, end] = verse.split("-")
    return `${base}/${slug}-${chapter}-${start}_${chapter}-${end}/`
  }
  return `${base}/${slug}-${chapter}-${verse}/`
}

// Jubilees regexes
const jubileesVerseRegex =
  /(?<![\w/>"'\[])\bJubilees[ \t]+(\d+):(\d+)(?:-(\d+))?(?!\])/gi

const jubileesChapterRegex =
  /(?<![\w/>"'\[])\bJubilees[ \t]+(\d+(?:-\d+)?)(?![:\d\]])/gi

// Enoch regexes — match "Enoch" or "1 Enoch"
const enochVerseRegex =
  /(?<![\w/>"'\[])\b(?:1[ \t]+)?Enoch[ \t]+(\d+):(\d+)(?:-(\d+))?(?!\])/gi

const enochChapterRegex =
  /(?<![\w/>"'\[])\b(?:1[ \t]+)?Enoch[ \t]+(\d+(?:-\d+)?)(?![:\d\]])/gi

// 1 Clement regexes — match "1 Clement", "1Clement", "1 Clem", "1Clem"
const clementVerseRegex =
  /(?<![\w/>"'\[])\b1[ \t]*Clem(?:ent)?[ \t]+(\d+):(\d+)(?:-(\d+))?(?!\])/gi

const clementChapterRegex =
  /(?<![\w/>"'\[])\b1[ \t]*Clem(?:ent)?[ \t]+(\d+(?:-\d+)?)(?![:\d\]])/gi

function clementUrl(chapter: string, verse?: string): string {
  const base = "https://www.earlychristianwritings.com/text/1clement-lightfoot.html"
  if (!verse) return base
  const fragment = `1Clem ${chapter}:${verse}`
  return `${base}#:~:text=${encodeURIComponent(fragment)}`
}

function enochPageNum(ch: number): string {
  if (ch === 91) return "095"
  if (ch === 92) return "094"
  if (ch >= 94) return (ch + 4).toString().padStart(3, "0")
  return (ch + 3).toString().padStart(3, "0")
}

// Jeremiah LXX chapter/verse remapping.
// The Septuagint reorganizes Jeremiah 25–51; chapters 1–24 are identical.
// Returns either { kind: "found", chapter, verse } with the correct LXX numbers,
// or { kind: "wanting" } for passages absent from the Septuagint.
type JerLxxResult =
  | { kind: "found"; chapter: number; verse: number | undefined }
  | { kind: "wanting" }

function jeremiahLxxRemap(hebrewCh: number, hebrewVerse?: number): JerLxxResult {
  const v = hebrewVerse ?? 0
  if (hebrewCh <= 24) return { kind: "found", chapter: hebrewCh, verse: hebrewVerse }
  switch (hebrewCh) {
    case 25:
      if (v === 0 || v <= 13) return { kind: "found", chapter: 25, verse: hebrewVerse }
      return { kind: "found", chapter: 32, verse: hebrewVerse ? hebrewVerse - 13 : undefined }
    case 26: return { kind: "found", chapter: 33, verse: hebrewVerse }
    case 27:
      if (v === 0 || v <= 18) return { kind: "found", chapter: 34, verse: hebrewVerse }
      return { kind: "wanting" }
    case 28: return { kind: "found", chapter: 35, verse: hebrewVerse }
    case 29: return { kind: "found", chapter: 36, verse: hebrewVerse }
    case 30: return { kind: "found", chapter: 37, verse: hebrewVerse }
    case 31: return { kind: "found", chapter: 38, verse: hebrewVerse }
    case 32: return { kind: "found", chapter: 39, verse: hebrewVerse }
    case 33:
      if (v === 0 || v <= 13) return { kind: "found", chapter: 40, verse: hebrewVerse }
      return { kind: "wanting" }
    case 34: return { kind: "found", chapter: 41, verse: hebrewVerse }
    case 35: return { kind: "found", chapter: 42, verse: hebrewVerse }
    case 36: return { kind: "found", chapter: 43, verse: hebrewVerse }
    case 37: return { kind: "found", chapter: 44, verse: hebrewVerse }
    case 38: return { kind: "found", chapter: 45, verse: hebrewVerse }
    case 39:
      if (v === 0 || v <= 3) return { kind: "found", chapter: 46, verse: hebrewVerse }
      if (v <= 13) return { kind: "wanting" }
      return { kind: "found", chapter: 46, verse: hebrewVerse ? hebrewVerse - 10 : undefined }
    case 40: return { kind: "found", chapter: 47, verse: hebrewVerse }
    case 41: return { kind: "found", chapter: 48, verse: hebrewVerse }
    case 42: return { kind: "found", chapter: 49, verse: hebrewVerse }
    case 43: return { kind: "found", chapter: 50, verse: hebrewVerse }
    case 44: return { kind: "found", chapter: 51, verse: hebrewVerse }
    case 45: return { kind: "found", chapter: 51, verse: hebrewVerse ? hebrewVerse + 30 : undefined }
    case 46: return { kind: "found", chapter: 26, verse: hebrewVerse }
    case 47: return { kind: "found", chapter: 29, verse: hebrewVerse }
    case 48:
      if (v === 0 || v <= 45) return { kind: "found", chapter: 31, verse: hebrewVerse }
      return { kind: "wanting" }
    case 49:
      if (v === 0) return { kind: "found", chapter: 30, verse: undefined }
      if (v <= 5) return { kind: "found", chapter: 30, verse: hebrewVerse }
      if (v === 6) return { kind: "wanting" }
      if (v <= 23) return { kind: "found", chapter: 29, verse: hebrewVerse }
      if (v <= 33) return { kind: "found", chapter: 30, verse: undefined }
      return { kind: "found", chapter: 25, verse: hebrewVerse ? hebrewVerse - 21 : undefined }
    case 50: return { kind: "found", chapter: 27, verse: hebrewVerse }
    case 51: return { kind: "found", chapter: 28, verse: hebrewVerse }
    case 52: return { kind: "found", chapter: 52, verse: hebrewVerse }
    default: return { kind: "found", chapter: hebrewCh, verse: hebrewVerse }
  }
}

export const BibleLinks: QuartzTransformerPlugin = () => {
  return {
    name: "BibleLinks",
    textTransform(_ctx, src) {
      // Extract page-level default translation from frontmatter (e.g. "translation: CJB")
      // Falls back to KJV if the property is absent or unreadable.
      let pageVersion = "KJV"
      const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(src)
      if (fmMatch) {
        const tLine = /^translation:\s*(.+)$/im.exec(fmMatch[1])
        if (tLine) pageVersion = tLine[1].trim().toUpperCase()
      }

      const linkify = (text: string) => {
        // Protect "Ascension of Isaiah" from being linkified as canonical Isaiah
        const ascIsaiahPlaceholders: string[] = []
        let result = text.replace(
          /Ascension of Isaiah(?:\s+\d+(?:-\d+)?(?::\d+(?:-\d+)?)?)?/gi,
          (match) => {
            ascIsaiahPlaceholders.push(match)
            return `\x00ASCISAIAH${ascIsaiahPlaceholders.length - 1}\x00`
          },
        )

        // Pass 1: LXX verse refs (Book Chapter:Verse (LXX))
        result = result.replace(lxxVerseRegex, (match, book, chapter, verse) => {
          const code = lxxBooks[book.toLowerCase().trim()]
          if (!code) return match
          const firstVerse = verse.includes("-") ? verse.split("-")[0] : verse
          let lxxCh = parseInt(chapter)
          let lxxVerse: number | undefined = parseInt(firstVerse)
          if (code === "JER") {
            const remap = jeremiahLxxRemap(lxxCh, lxxVerse)
            if (remap.kind === "wanting") {
              const bgUrl = `https://www.biblegateway.com/passage/?search=Jer+${chapter}%3A${firstVerse}&version=${pageVersion}`
              return `<span class="lxx-wanting" data-bg-url="${bgUrl}" tabindex="0">${match}</span>`
            }
            lxxCh = remap.chapter
            lxxVerse = remap.verse
          }
          const verseAnchor = lxxVerse !== undefined ? `#:~:text=${lxxVerse}` : ""
          const chapterPadded = lxxCh.toString().padStart(2, "0")
          const url = `https://ebible.org/eng-Brenton/${code}${chapterPadded}.htm${verseAnchor}`
          return `[${match}](${url})`
        })

        // Pass 2: LXX chapter-only refs (Book Chapter (LXX))
        result = result.replace(lxxChapterRegex, (match, book, chapter) => {
          const code = lxxBooks[book.toLowerCase().trim()]
          if (!code) return match
          const firstChapter = chapter.includes("-") ? chapter.split("-")[0] : chapter
          let lxxCh = parseInt(firstChapter)
          if (code === "JER") {
            const remap = jeremiahLxxRemap(lxxCh)
            if (remap.kind === "wanting") {
              const bgUrl = `https://www.biblegateway.com/passage/?search=Jer+${firstChapter}&version=${pageVersion}`
              return `<span class="lxx-wanting" data-bg-url="${bgUrl}" tabindex="0">${match}</span>`
            }
            lxxCh = remap.chapter
          }
          const chapterPadded = lxxCh.toString().padStart(2, "0")
          const url = `https://ebible.org/eng-Brenton/${code}${chapterPadded}.htm`
          return `[${match}](${url})`
        })

        // Pass 2.5a: Apocrypha verse refs without (LXX) — link to kingjamesbibleonline.org
        result = result.replace(kjbApocryphaVerseRegex, (match, book, chapter, verse) => {
          const slug = kjbApocryphaBooks[book.toLowerCase().trim()]
          if (!slug) return match
          return `[${match}](${kjbApocryphaUrl(slug, chapter, verse)})`
        })

        // Pass 2.5b: Apocrypha chapter-only refs without (LXX) — link to kingjamesbibleonline.org
        result = result.replace(kjbApocryphaChapterRegex, (match, book, chapter) => {
          const slug = kjbApocryphaBooks[book.toLowerCase().trim()]
          if (!slug) return match
          const firstChapter = chapter.includes("-") ? chapter.split("-")[0] : chapter
          return `[${match}](${kjbApocryphaUrl(slug, firstChapter)})`
        })

        // Pass 3: Jubilees verse refs
        result = result.replace(
          jubileesVerseRegex,
          (match, chapter, firstVerse) => {
            const url = `https://www.pseudepigrapha.com/jubilees/${chapter}.htm#:~:text=${firstVerse}.`
            return `[${match}](${url})`
          },
        )

        // Pass 4: Jubilees chapter-only refs
        result = result.replace(jubileesChapterRegex, (match, chapter) => {
          const firstChapter = chapter.includes("-") ? chapter.split("-")[0] : chapter
          const url = `https://www.pseudepigrapha.com/jubilees/${firstChapter}.htm`
          return `[${match}](${url})`
        })

        // Pass 5: Enoch verse refs
        result = result.replace(enochVerseRegex, (match, chapter, firstVerse) => {
          const pageNum = enochPageNum(parseInt(chapter))
          const url = `https://sacred-texts.com/bib/boe/boe${pageNum}.htm#:~:text=${firstVerse}.`
          return `[${match}](${url})`
        })

        // Pass 6: Enoch chapter-only refs
        result = result.replace(enochChapterRegex, (match, chapter) => {
          const firstChapter = chapter.includes("-") ? chapter.split("-")[0] : chapter
          const pageNum = enochPageNum(parseInt(firstChapter))
          const url = `https://sacred-texts.com/bib/boe/boe${pageNum}.htm`
          return `[${match}](${url})`
        })

        // Pass 6.5a: 1 Clement verse refs
        result = result.replace(clementVerseRegex, (match, chapter, firstVerse) => {
          return `[${match}](${clementUrl(chapter, firstVerse)})`
        })

        // Pass 6.5b: 1 Clement chapter-only refs
        result = result.replace(clementChapterRegex, (match, chapter) => {
          const firstChapter = chapter.includes("-") ? chapter.split("-")[0] : chapter
          return `[${match}](${clementUrl(firstChapter)})`
        })

        // Pass 7: versioned verse refs — explicit translation tag e.g. "John 3:16 (NIV)"
        result = result.replace(versionedVerseRegex, (match, book, chapter, verse, version) => {
          const bgBook = books[book.toLowerCase().trim()]
          if (!bgBook) return match
          const url = `https://www.biblegateway.com/passage/?search=${bgBook}+${chapter}%3A${verse}&version=${version.toUpperCase()}`
          return `[${match}](${url})`
        })

        // Pass 8: versioned chapter refs — explicit translation tag e.g. "John 3 (NIV)"
        result = result.replace(versionedChapterRegex, (match, book, chapter, version) => {
          const bgBook = books[book.toLowerCase().trim()]
          if (!bgBook) return match
          const url = `https://www.biblegateway.com/passage/?search=${bgBook}+${chapter}&version=${version.toUpperCase()}`
          return `[${match}](${url})`
        })

        // Pass 9: canonical verse references — uses page default translation (or KJV)
        result = result.replace(verseRegex, (match, book, chapter, verse) => {
          const bgBook = books[book.toLowerCase().trim()]
          if (!bgBook) return match
          const url = `https://www.biblegateway.com/passage/?search=${bgBook}+${chapter}%3A${verse}&version=${pageVersion}`
          return `[${match}](${url})`
        })

        // Pass 10: canonical chapter-only refs — uses page default translation (or KJV)
        // After prior passes, already-linked refs are inside "[...](...)" so the
        // lookbehind "(?<![...\[)" prevents re-matching inside those links.
        result = result.replace(chapterRegex, (match, book, chapter) => {
          const bgBook = books[book.toLowerCase().trim()]
          if (!bgBook) return match
          const url = `https://www.biblegateway.com/passage/?search=${bgBook}+${chapter}&version=${pageVersion}`
          return `[${match}](${url})`
        })

        // Restore "Ascension of Isaiah" placeholders
        result = result.replace(
          /\x00ASCISAIAH(\d+)\x00/g,
          (_, i) => ascIsaiahPlaceholders[parseInt(i)],
        )

        return result
      }

      // Protect: YAML frontmatter block, fenced code blocks, inline code
      const protectedRe = /^---[\s\S]*?^---[ \t]*\n|`{3}[\s\S]*?`{3}|`[^`\n]*`/gm
      const parts: string[] = []
      let lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = protectedRe.exec(src)) !== null) {
        parts.push(linkify(src.slice(lastIndex, m.index)))
        parts.push(m[0])
        lastIndex = m.index + m[0].length
      }
      parts.push(linkify(src.slice(lastIndex)))
      return parts.join("")
    },
    htmlPlugins() {
      return [
        () => {
          return (tree: Root) => {
            visit(tree, "element", (node) => {
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                const href = node.properties.href as string
                // Match any Bible link domain (BibleGateway, ebible, kingjamesbibleonline,
                // pseudepigrapha, sacred-texts, earlychristianwritings)
                const isBibleLink =
                  href.includes("biblegateway.com/passage") ||
                  href.includes("ebible.org/eng-Brenton") ||
                  href.includes("kingjamesbibleonline.org") ||
                  href.includes("pseudepigrapha.com/jubilees") ||
                  href.includes("sacred-texts.com/bib/boe") ||
                  href.includes("earlychristianwritings.com/text/1clement")
                if (isBibleLink) {
                  const textParts: string[] = []
                  for (const child of node.children) {
                    if (child.type === "text") textParts.push(child.value)
                  }
                  const linkText = textParts.join("")
                  const ref = normalizeRef(linkText)
                  if (ref) {
                    node.properties["data-verse-ref"] = ref
                  }
                }
              }
            })
          }
        },
      ]
    },
    externalResources() {
      return {
        js: [
          {
            loadTime: "afterDOMReady" as const,
            contentType: "inline" as const,
            script: `(function(){
  var tip = document.createElement('div');
  tip.id = 'lxx-wanting-tip';
  document.body.appendChild(tip);
  var hideTimer;
  function showTip(el, e) {
    clearTimeout(hideTimer);
    var bgUrl = el.getAttribute('data-bg-url');
    tip.innerHTML = '<p>This verse does not exist in the Septuagint.</p><a href="' + bgUrl + '" target="_blank" rel="noopener">View in BibleGateway \u2197</a>';
    tip.style.display = 'block';
    var r = el.getBoundingClientRect();
    var tw = Math.min(280, window.innerWidth - 20);
    var left = r.left + window.scrollX;
    if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10 + window.scrollX;
    tip.style.left = left + 'px';
    tip.style.top = (r.bottom + window.scrollY + 6) + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }
  document.querySelectorAll('.lxx-wanting').forEach(function(el) {
    el.addEventListener('mouseenter', function(e) { showTip(el, e); });
    el.addEventListener('mouseleave', function() { hideTimer = setTimeout(hideTip, 200); });
    el.addEventListener('click', function(e) {
      e.preventDefault();
      if (tip.style.display === 'none' || tip.style.display === '') showTip(el, e);
      else hideTip();
    });
  });
  tip.addEventListener('mouseenter', function() { clearTimeout(hideTimer); });
  tip.addEventListener('mouseleave', function() { hideTimer = setTimeout(hideTip, 200); });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.lxx-wanting') && !e.target.closest('#lxx-wanting-tip')) hideTip();
  });
})();`,
          },
        ],
      }
    },
  }
}
