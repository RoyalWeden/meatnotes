/**
 * Shared Bible book name utilities.
 * Extracted from bibleLinks.ts and IdiomFlashcard.tsx to avoid duplication.
 */

// Alias → BibleGateway URL-encoded canonical name
export const books: Record<string, string> = {
  // Old Testament
  genesis: "Genesis",
  gen: "Genesis",
  exodus: "Exodus",
  exod: "Exodus",
  exo: "Exodus",
  leviticus: "Leviticus",
  lev: "Leviticus",
  numbers: "Numbers",
  num: "Numbers",
  deuteronomy: "Deuteronomy",
  deut: "Deuteronomy",
  deu: "Deuteronomy",
  joshua: "Joshua",
  josh: "Joshua",
  judges: "Judges",
  judg: "Judges",
  ruth: "Ruth",
  "1 samuel": "1+Samuel",
  "1 sam": "1+Samuel",
  "1sam": "1+Samuel",
  "2 samuel": "2+Samuel",
  "2 sam": "2+Samuel",
  "2sam": "2+Samuel",
  "1 kings": "1+Kings",
  "1kings": "1+Kings",
  "2 kings": "2+Kings",
  "2kings": "2+Kings",
  "1 chronicles": "1+Chronicles",
  "1 chron": "1+Chronicles",
  "1chron": "1+Chronicles",
  "2 chronicles": "2+Chronicles",
  "2 chron": "2+Chronicles",
  "2chron": "2+Chronicles",
  ezra: "Ezra",
  nehemiah: "Nehemiah",
  neh: "Nehemiah",
  job: "Job",
  psalm: "Psalms",
  psalms: "Psalms",
  ps: "Psalms",
  psa: "Psalms",
  proverbs: "Proverbs",
  prov: "Proverbs",
  pro: "Proverbs",
  ecclesiastes: "Ecclesiastes",
  eccl: "Ecclesiastes",
  ecc: "Ecclesiastes",
  "song of solomon": "Song+of+Solomon",
  song: "Song+of+Solomon",
  sos: "Song+of+Solomon",
  isaiah: "Isaiah",
  isa: "Isaiah",
  jeremiah: "Jeremiah",
  jer: "Jeremiah",
  lamentations: "Lamentations",
  lam: "Lamentations",
  ezekiel: "Ezekiel",
  ezek: "Ezekiel",
  eze: "Ezekiel",
  daniel: "Daniel",
  dan: "Daniel",
  hosea: "Hosea",
  hos: "Hosea",
  joel: "Joel",
  amos: "Amos",
  obadiah: "Obadiah",
  obad: "Obadiah",
  jonah: "Jonah",
  jon: "Jonah",
  micah: "Micah",
  mic: "Micah",
  nahum: "Nahum",
  nah: "Nahum",
  habakkuk: "Habakkuk",
  hab: "Habakkuk",
  zephaniah: "Zephaniah",
  zeph: "Zephaniah",
  haggai: "Haggai",
  hag: "Haggai",
  zechariah: "Zechariah",
  zech: "Zechariah",
  malachi: "Malachi",
  mal: "Malachi",
  // New Testament
  matthew: "Matthew",
  matt: "Matthew",
  mat: "Matthew",
  mark: "Mark",
  luke: "Luke",
  john: "John",
  acts: "Acts",
  romans: "Romans",
  rom: "Romans",
  "1 corinthians": "1+Corinthians",
  "1 cor": "1+Corinthians",
  "1cor": "1+Corinthians",
  "2 corinthians": "2+Corinthians",
  "2 cor": "2+Corinthians",
  "2cor": "2+Corinthians",
  galatians: "Galatians",
  gal: "Galatians",
  ephesians: "Ephesians",
  eph: "Ephesians",
  philippians: "Philippians",
  phil: "Philippians",
  colossians: "Colossians",
  col: "Colossians",
  "1 thessalonians": "1+Thessalonians",
  "1 thess": "1+Thessalonians",
  "1thess": "1+Thessalonians",
  "2 thessalonians": "2+Thessalonians",
  "2 thess": "2+Thessalonians",
  "2thess": "2+Thessalonians",
  "1 timothy": "1+Timothy",
  "1 tim": "1+Timothy",
  "1tim": "1+Timothy",
  "2 timothy": "2+Timothy",
  "2 tim": "2+Timothy",
  "2tim": "2+Timothy",
  titus: "Titus",
  tit: "Titus",
  philemon: "Philemon",
  phlm: "Philemon",
  hebrews: "Hebrews",
  heb: "Hebrews",
  james: "James",
  jas: "James",
  "1 peter": "1+Peter",
  "1 pet": "1+Peter",
  "1pet": "1+Peter",
  "2 peter": "2+Peter",
  "2 pet": "2+Peter",
  "2pet": "2+Peter",
  "1 john": "1+John",
  "1john": "1+John",
  "2 john": "2+John",
  "2john": "2+John",
  "3 john": "3+John",
  "3john": "3+John",
  jude: "Jude",
  revelation: "Revelation",
  rev: "Revelation",
  // Esther (missing from canonical list)
  esther: "Esther",
  esth: "Esther",
  // Deuterocanonical / Apocrypha
  tobit: "Tobit",
  tob: "Tobit",
  judith: "Judith",
  jdt: "Judith",
  "wisdom of solomon": "Wisdom+of+Solomon",
  wisdom: "Wisdom+of+Solomon",
  wis: "Wisdom+of+Solomon",
  sirach: "Sirach",
  ecclesiasticus: "Sirach",
  sir: "Sirach",
  baruch: "Baruch",
  bar: "Baruch",
  "letter of jeremiah": "Letter+of+Jeremiah",
  "epistle of jeremiah": "Letter+of+Jeremiah",
  "let jer": "Letter+of+Jeremiah",
  "additions to esther": "Additions+to+Esther",
  "rest of esther": "Additions+to+Esther",
  "add esth": "Additions+to+Esther",
  "prayer of azariah": "Prayer+of+Azariah",
  "song of three holy children": "Prayer+of+Azariah",
  "song of the three": "Prayer+of+Azariah",
  susanna: "Susanna",
  sus: "Susanna",
  "bel and the dragon": "Bel+and+the+Dragon",
  bel: "Bel+and+the+Dragon",
  "1 maccabees": "1+Maccabees",
  "1 macc": "1+Maccabees",
  "1macc": "1+Maccabees",
  "2 maccabees": "2+Maccabees",
  "2 macc": "2+Maccabees",
  "2macc": "2+Maccabees",
  "3 maccabees": "3+Maccabees",
  "3 macc": "3+Maccabees",
  "3macc": "3+Maccabees",
  "4 maccabees": "4+Maccabees",
  "4 macc": "4+Maccabees",
  "4macc": "4+Maccabees",
  "prayer of manasseh": "Prayer+of+Manasseh",
  manasseh: "Prayer+of+Manasseh",
  "1 esdras": "1+Esdras",
  "1esdras": "1+Esdras",
  "2 esdras": "2+Esdras",
  "2esdras": "2+Esdras",
  // Pseudepigrapha
  jubilees: "Jubilees",
  enoch: "Enoch",
  "1 enoch": "Enoch",
  "1enoch": "Enoch",
  // Early Church Fathers
  "1 clement": "1+Clement",
  "1clement": "1+Clement",
  "1 clem": "1+Clement",
  "1clem": "1+Clement",
}

// Build the regex alternation pattern once (sorted longest-first for greedy match)
export const bookPattern: string = Object.keys(books)
  .sort((a, b) => b.length - a.length)
  .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")

// --- Verse reference parsing ---

export interface VerseRef {
  book: string // Canonical name, e.g. "Hosea"
  chapter: number
  verse?: number
  endVerse?: number // For ranges like 3:16-18
  raw: string // Original matched text
}

// Regex for "Book Ch:V" and "Book Ch:V-V" patterns
const verseRefRegex = new RegExp(
  `\\b(${bookPattern})[ \\t]+(\\d+):(\\d+)(?:-(\\d+))?`,
  "gi",
)

// Regex for "Book Ch" or "Book Ch-Ch" (chapter-only) patterns
const chapterRefRegex = new RegExp(
  `\\b(${bookPattern})[ \\t]+(\\d+)(?:-(\\d+))?(?![:\\d])`,
  "gi",
)

/** Convert a BG URL-encoded name back to display form: "1+Samuel" → "1 Samuel" */
function bgNameToDisplay(bgName: string): string {
  return bgName.replace(/\+/g, " ")
}

/** Canonical display name for a book alias, e.g. "hos" → "Hosea" */
export function canonicalBookName(alias: string): string | undefined {
  const bgName = books[alias.toLowerCase().trim()]
  return bgName ? bgNameToDisplay(bgName) : undefined
}

/**
 * Normalize a verse reference to a canonical key.
 * "hos 6:6" → "Hosea 6:6", "1 cor 13:4-7" → "1 Corinthians 13:4-7"
 * Chapter-only: "John 5" → "John 5"
 */
export function normalizeRef(raw: string): string | null {
  const trimmed = raw.trim()

  // Try verse ref first
  const vMatch = trimmed.match(
    new RegExp(`^(${bookPattern})[ \\t]+(\\d+):(\\d+(?:-\\d+)?)$`, "i"),
  )
  if (vMatch) {
    const name = canonicalBookName(vMatch[1])
    if (!name) return null
    return `${name} ${vMatch[2]}:${vMatch[3]}`
  }

  // Try chapter ref
  const cMatch = trimmed.match(
    new RegExp(`^(${bookPattern})[ \\t]+(\\d+(?:-\\d+)?)$`, "i"),
  )
  if (cMatch) {
    const name = canonicalBookName(cMatch[1])
    if (!name) return null
    return `${name} ${cMatch[2]}`
  }

  return null
}

/**
 * Parse all Bible verse references from a block of text.
 * Returns both verse-level (Book Ch:V) and chapter-level (Book Ch) refs.
 */
export function parseVerseRefs(text: string): VerseRef[] {
  const refs: VerseRef[] = []
  const seen = new Set<string>()

  // Verse refs first (more specific)
  for (const m of text.matchAll(verseRefRegex)) {
    const bookName = canonicalBookName(m[1])
    if (!bookName) continue
    const chapter = parseInt(m[2], 10)
    const verse = parseInt(m[3], 10)
    const endVerse = m[4] ? parseInt(m[4], 10) : undefined
    const key = endVerse
      ? `${bookName} ${chapter}:${verse}-${endVerse}`
      : `${bookName} ${chapter}:${verse}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ book: bookName, chapter, verse, endVerse, raw: m[0] })
  }

  // Chapter-only refs (skip positions already covered by verse refs)
  for (const m of text.matchAll(chapterRefRegex)) {
    const bookName = canonicalBookName(m[1])
    if (!bookName) continue
    const chapter = parseInt(m[2], 10)
    const key = `${bookName} ${chapter}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ book: bookName, chapter, raw: m[0] })
  }

  return refs
}

/**
 * Expand a verse range into individual verse keys.
 * "John 5:3-9" → ["John 5:3", "John 5:4", ..., "John 5:9"]
 * Capped at 30 to avoid runaway expansion.
 */
export function expandRange(ref: VerseRef): string[] {
  if (!ref.verse) return [`${ref.book} ${ref.chapter}`]
  if (!ref.endVerse || ref.endVerse <= ref.verse) {
    return [`${ref.book} ${ref.chapter}:${ref.verse}`]
  }
  const cap = Math.min(ref.endVerse, ref.verse + 29)
  const result: string[] = []
  for (let v = ref.verse; v <= cap; v++) {
    result.push(`${ref.book} ${ref.chapter}:${v}`)
  }
  return result
}

// --- Book group classification (for graph coloring) ---

export type BookGroup =
  | "pentateuch"
  | "historical"
  | "wisdom"
  | "major-prophets"
  | "minor-prophets"
  | "gospels"
  | "acts-epistles"
  | "revelation"
  | "deuterocanonical"
  | "pseudepigrapha"
  | "early-church"

const groupDefs: [BookGroup, string[]][] = [
  [
    "pentateuch",
    ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
  ],
  [
    "historical",
    [
      "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
      "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
      "Ezra", "Nehemiah", "Esther",
    ],
  ],
  ["wisdom", ["Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon"]],
  ["major-prophets", ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"]],
  [
    "minor-prophets",
    [
      "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
      "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    ],
  ],
  ["gospels", ["Matthew", "Mark", "Luke", "John"]],
  [
    "acts-epistles",
    [
      "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
      "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
      "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon",
      "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John",
      "3 John", "Jude",
    ],
  ],
  ["revelation", ["Revelation"]],
  [
    "deuterocanonical",
    [
      "Tobit", "Judith", "Wisdom of Solomon", "Sirach", "Baruch",
      "Letter of Jeremiah", "Additions to Esther", "Prayer of Azariah",
      "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees",
      "3 Maccabees", "4 Maccabees", "Prayer of Manasseh", "1 Esdras", "2 Esdras",
    ],
  ],
  ["pseudepigrapha", ["Jubilees", "Enoch"]],
  ["early-church", ["1 Clement"]],
]

export const bookGroupMap: Record<string, BookGroup> = {}
for (const [group, names] of groupDefs) {
  for (const name of names) {
    bookGroupMap[name] = group
  }
}

export const bookGroupColors: Record<BookGroup, string> = {
  pentateuch: "#f59e0b", // amber
  historical: "#22c55e", // green
  wisdom: "#14b8a6", // teal
  "major-prophets": "#3b82f6", // blue
  "minor-prophets": "#6366f1", // indigo
  gospels: "#eab308", // gold
  "acts-epistles": "#ef4444", // red
  revelation: "#a855f7", // purple
  deuterocanonical: "#10b981", // emerald
  pseudepigrapha: "#f97316", // orange
  "early-church": "#ec4899", // pink
}

// --- Section classification (for note categorization) ---

export type NoteSection = "capture" | "in-progress" | "idiom" | "complete" | "rebukes" | "daily"

export function classifySlug(slug: string): NoteSection {
  if (slug.startsWith("Daily/")) return "daily"
  if (slug.startsWith("Copy-Paste-Rebukes/")) return "rebukes"
  if (slug.startsWith("00")) return "capture"
  if (slug.startsWith("10")) return "in-progress"
  if (/^20.*?\/01/.test(slug)) return "idiom"
  if (slug.startsWith("20")) return "complete"
  return "capture"
}

export const sectionColors: Record<NoteSection, string> = {
  capture: "#8b8b8b",
  "in-progress": "#f59e0b",
  idiom: "#a855f7",
  complete: "#22c55e",
  rebukes: "#ef4444",
  daily: "#3b82f6",
}

export const sectionLabels: Record<NoteSection, string> = {
  capture: "Capture",
  "in-progress": "In Progress",
  idiom: "Idiom",
  complete: "Complete",
  rebukes: "Rebukes",
  daily: "Daily",
}
