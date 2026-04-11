// Bible Reader — Clean verse reading with notes sidebar
// Apple/iOS-inspired UI for reading Bible text with associated study notes

interface VerseIndexEntry {
  slug: string
  title: string
  folder: string
}

interface BGNote {
  text: string
  observations: string[]
  date: string
}

interface VerseIndexData {
  index: Record<string, VerseIndexEntry[]>
  cooccurrence: Record<string, string[]>
  bgCooccurrence?: Record<string, string[]>
  connectionStrength?: Record<string, Record<string, number>>
  pdfConnections?: Record<string, string[]>
  bgNotes?: Record<string, BGNote>
}

const VERSE_CACHE_KEY = "br-verse-cache"
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000

const sectionColors: Record<string, string> = {
  capture: "#8b8b8b",
  "in-progress": "#f59e0b",
  idiom: "#a855f7",
  complete: "#22c55e",
  rebukes: "#ef4444",
  daily: "#3b82f6",
}

const sectionLabels: Record<string, string> = {
  capture: "Capture",
  "in-progress": "In Progress",
  idiom: "Idiom",
  complete: "Complete",
  rebukes: "Rebukes",
  daily: "Daily",
}

// ── Book Alias Table ──
const BOOK_ALIASES: Record<string, string> = {
  gen: "Genesis", ge: "Genesis", gn: "Genesis",
  ex: "Exodus", exod: "Exodus", exo: "Exodus",
  lev: "Leviticus", le: "Leviticus", lv: "Leviticus",
  num: "Numbers", nu: "Numbers", nm: "Numbers", nb: "Numbers",
  deut: "Deuteronomy", de: "Deuteronomy", dt: "Deuteronomy",
  josh: "Joshua", jos: "Joshua",
  judg: "Judges", jdg: "Judges", jg: "Judges",
  ru: "Ruth", rut: "Ruth",
  "1sa": "1 Samuel", "1sam": "1 Samuel", "1 sa": "1 Samuel", "1 sam": "1 Samuel", "i sam": "1 Samuel", "i sa": "1 Samuel",
  "2sa": "2 Samuel", "2sam": "2 Samuel", "2 sa": "2 Samuel", "2 sam": "2 Samuel", "ii sam": "2 Samuel", "ii sa": "2 Samuel",
  "1ki": "1 Kings", "1kgs": "1 Kings", "1 ki": "1 Kings", "1 kgs": "1 Kings", "i ki": "1 Kings", "i kgs": "1 Kings",
  "2ki": "2 Kings", "2kgs": "2 Kings", "2 ki": "2 Kings", "2 kgs": "2 Kings", "ii ki": "2 Kings", "ii kgs": "2 Kings",
  "1ch": "1 Chronicles", "1chr": "1 Chronicles", "1 ch": "1 Chronicles", "1 chr": "1 Chronicles", "i chr": "1 Chronicles",
  "2ch": "2 Chronicles", "2chr": "2 Chronicles", "2 ch": "2 Chronicles", "2 chr": "2 Chronicles", "ii chr": "2 Chronicles",
  ezr: "Ezra",
  neh: "Nehemiah", ne: "Nehemiah",
  est: "Esther", esth: "Esther",
  jb: "Job",
  ps: "Psalms", psa: "Psalms", psm: "Psalms", pss: "Psalms", psalm: "Psalms",
  pro: "Proverbs", prov: "Proverbs", pr: "Proverbs", prv: "Proverbs",
  ecc: "Ecclesiastes", eccl: "Ecclesiastes", eccles: "Ecclesiastes", ec: "Ecclesiastes",
  sos: "Song of Solomon", song: "Song of Solomon", ss: "Song of Solomon", sg: "Song of Solomon",
  isa: "Isaiah", is: "Isaiah",
  jer: "Jeremiah", je: "Jeremiah", jr: "Jeremiah",
  lam: "Lamentations", la: "Lamentations",
  ezk: "Ezekiel", eze: "Ezekiel", ezek: "Ezekiel",
  dan: "Daniel", da: "Daniel", dn: "Daniel",
  hos: "Hosea", ho: "Hosea",
  joe: "Joel", jl: "Joel",
  am: "Amos", amo: "Amos",
  ob: "Obadiah", oba: "Obadiah", obad: "Obadiah",
  jon: "Jonah", jnh: "Jonah",
  mic: "Micah", mi: "Micah",
  nah: "Nahum", na: "Nahum",
  hab: "Habakkuk",
  zep: "Zephaniah", zeph: "Zephaniah",
  hag: "Haggai", hg: "Haggai",
  zec: "Zechariah", zech: "Zechariah",
  mal: "Malachi", ml: "Malachi",
  mat: "Matthew", matt: "Matthew", mt: "Matthew",
  mk: "Mark", mar: "Mark", mrk: "Mark",
  lk: "Luke", luk: "Luke", lu: "Luke",
  jn: "John", jhn: "John", joh: "John",
  ac: "Acts", act: "Acts",
  rom: "Romans", ro: "Romans", rm: "Romans",
  "1co": "1 Corinthians", "1cor": "1 Corinthians", "1 co": "1 Corinthians", "1 cor": "1 Corinthians",
  "1corinthians": "1 Corinthians", "i cor": "1 Corinthians", "i co": "1 Corinthians",
  "2co": "2 Corinthians", "2cor": "2 Corinthians", "2 co": "2 Corinthians", "2 cor": "2 Corinthians",
  "2corinthians": "2 Corinthians", "ii cor": "2 Corinthians", "ii co": "2 Corinthians",
  gal: "Galatians", ga: "Galatians",
  eph: "Ephesians", ep: "Ephesians",
  phil: "Philippians", php: "Philippians", pp: "Philippians",
  col: "Colossians",
  "1th": "1 Thessalonians", "1thess": "1 Thessalonians", "1 th": "1 Thessalonians", "1 thess": "1 Thessalonians", "i thess": "1 Thessalonians",
  "2th": "2 Thessalonians", "2thess": "2 Thessalonians", "2 th": "2 Thessalonians", "2 thess": "2 Thessalonians", "ii thess": "2 Thessalonians",
  "1ti": "1 Timothy", "1tim": "1 Timothy", "1 ti": "1 Timothy", "1 tim": "1 Timothy", "i tim": "1 Timothy",
  "2ti": "2 Timothy", "2tim": "2 Timothy", "2 ti": "2 Timothy", "2 tim": "2 Timothy", "ii tim": "2 Timothy",
  tit: "Titus", ti: "Titus",
  phm: "Philemon", philem: "Philemon",
  heb: "Hebrews", he: "Hebrews",
  jas: "James", jm: "James",
  "1pe": "1 Peter", "1pet": "1 Peter", "1pt": "1 Peter", "1 pe": "1 Peter", "1 pet": "1 Peter", "i pet": "1 Peter",
  "2pe": "2 Peter", "2pet": "2 Peter", "2pt": "2 Peter", "2 pe": "2 Peter", "2 pet": "2 Peter", "ii pet": "2 Peter",
  "1jn": "1 John", "1jo": "1 John", "1 jn": "1 John", "1 jo": "1 John", "i jn": "1 John", "i john": "1 John",
  "2jn": "2 John", "2jo": "2 John", "2 jn": "2 John", "2 jo": "2 John", "ii jn": "2 John", "ii john": "2 John",
  "3jn": "3 John", "3jo": "3 John", "3 jn": "3 John", "3 jo": "3 John", "iii jn": "3 John", "iii john": "3 John",
  jud: "Jude", jde: "Jude",
  rev: "Revelation", re: "Revelation", rv: "Revelation",
  tob: "Tobit", tobit: "Tobit",
  jdt: "Judith", judith: "Judith",
  wis: "Wisdom of Solomon", wisdom: "Wisdom of Solomon",
  sir: "Sirach", sirach: "Sirach", ecclesiasticus: "Sirach",
  bar: "Baruch", baruch: "Baruch",
  "1mac": "1 Maccabees", "1macc": "1 Maccabees", "1 mac": "1 Maccabees", "1 macc": "1 Maccabees",
  "2mac": "2 Maccabees", "2macc": "2 Maccabees", "2 mac": "2 Maccabees", "2 macc": "2 Maccabees",
  "3mac": "3 Maccabees", "3macc": "3 Maccabees", "3 mac": "3 Maccabees", "3 macc": "3 Maccabees",
  "4mac": "4 Maccabees", "4macc": "4 Maccabees", "4 mac": "4 Maccabees", "4 macc": "4 Maccabees",
  "1esd": "1 Esdras", "1 esd": "1 Esdras",
  "2esd": "2 Esdras", "2 esd": "2 Esdras",
  "ep jer": "Epistle of Jeremiah", "epjer": "Epistle of Jeremiah",
  sus: "Susanna", susanna: "Susanna",
  bel: "Bel and the Dragon",
  "pr man": "Prayer of Manasseh", manasseh: "Prayer of Manasseh",
  "pr azar": "Prayer of Azariah",
}

const BOOK_ORDER: string[] = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
  "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
  "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
  "Ephesians", "Philippians", "Colossians",
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation",
]

const BOOK_CHAPTERS: Record<string, number> = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36,
  "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4,
  "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25,
  "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13,
  "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31,
  "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66, "Jeremiah": 52,
  "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, "Hosea": 14,
  "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7,
  "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2,
  "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13,
  "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4,
  "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6,
  "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13,
  "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5,
  "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22,
}

let verseIndex: VerseIndexData | null = null
let contentDates: Record<string, string> = {}
let currentBook = ""
let currentChapter = 0
let activeVerseRef = ""
let acIndex = -1
let isMobile = false

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ── Normalize book names ──
function normalizeBookName(input: string): string | null {
  const q = input.toLowerCase().trim()
  if (!q) return null
  if (BOOK_ALIASES[q]) return BOOK_ALIASES[q]
  const compressedMatch = q.match(/^(\d?\s*[a-z]+?)(\d+.*)$/)
  if (compressedMatch) {
    const bookPart = compressedMatch[1].replace(/\s+/g, " ").trim()
    if (BOOK_ALIASES[bookPart]) return BOOK_ALIASES[bookPart]
  }
  const allBooks = [...new Set(Object.values(BOOK_ALIASES))]
  const prefixMatch = allBooks.find(b => b.toLowerCase().startsWith(q))
  if (prefixMatch) return prefixMatch
  return null
}

function parseSearchQuery(query: string): { book: string; chapter?: string; verse?: string; endVerse?: string } | null {
  const q = query.trim()
  const compressed = q.match(/^(\d?\s*[a-z]+?)(\d+)(?::(\d+)(?:-(\d+))?)?$/i)
  if (compressed) {
    const bookPart = compressed[1].trim()
    const resolved = normalizeBookName(bookPart)
    if (resolved) return { book: resolved, chapter: compressed[2], verse: compressed[3], endVerse: compressed[4] }
  }
  const standard = q.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i)
  if (standard) {
    const resolved = normalizeBookName(standard[1])
    if (resolved) return { book: resolved, chapter: standard[2], verse: standard[3], endVerse: standard[4] }
  }
  const resolved = normalizeBookName(q)
  if (resolved) return { book: resolved }
  return null
}

// ── Data loading ──
async function loadData(): Promise<void> {
  if (verseIndex) return
  try {
    const [viRes, ciRes] = await Promise.all([
      fetch("/static/verseIndex.json"),
      fetch("/static/contentIndex.json"),
    ])
    verseIndex = await viRes.json()
    try {
      const ci = await ciRes.json()
      contentDates = {}
      for (const [slug, entry] of Object.entries(ci)) {
        const e = entry as any
        if (e?.date) contentDates[slug] = e.date
      }
    } catch {}
  } catch {
    verseIndex = { index: {}, cooccurrence: {} }
  }
}

// ── Verse cache ──
function getVerseFromCache(ref: string): string | null {
  try {
    const raw = localStorage.getItem(VERSE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[ref]
    if (!entry) return null
    if (Date.now() - entry.ts > CACHE_TTL) return null
    return entry.text
  } catch { return null }
}

function setVerseCache(ref: string, text: string) {
  try {
    const raw = localStorage.getItem(VERSE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[ref] = { text, ts: Date.now() }
    // Prune old entries
    const keys = Object.keys(cache)
    if (keys.length > 2000) {
      keys.sort((a, b) => cache[a].ts - cache[b].ts)
      for (let i = 0; i < keys.length - 1500; i++) delete cache[keys[i]]
    }
    localStorage.setItem(VERSE_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

// ── Fetch chapter from API ──
interface VerseData { verse: number; text: string }

async function fetchChapter(book: string, chapter: number): Promise<VerseData[]> {
  const cacheKey = `${book} ${chapter}`
  const cached = getVerseFromCache(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }

  const apiRef = `${book}+${chapter}`.replace(/\s+/g, "+").toLowerCase()
  try {
    const res = await fetch(`https://bible-api.com/${apiRef}?translation=kjv`)
    if (!res.ok) return []
    const data = await res.json()
    if (!data.verses || !Array.isArray(data.verses)) return []
    const verses: VerseData[] = data.verses.map((v: any) => ({
      verse: v.verse,
      text: (v.text || "").trim(),
    }))
    setVerseCache(cacheKey, JSON.stringify(verses))
    return verses
  } catch { return [] }
}

// ── Note title formatting ──
function formatNoteTitle(entry: VerseIndexEntry): string {
  const slug = entry.slug
  const raw = slug.split("/").pop() ?? slug
  // Remove number prefixes like "01 — Title"
  return raw.replace(/^\d+\s*[—–-]\s*/, "")
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return ""
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── BG note classification ──
// Returns true if the BG note text is purely verse references (no actual study content)
function isVerseOnlyBGNote(note: BGNote): boolean {
  const text = (note.text ?? "").trim()
  if (!text) return note.observations.length === 0
  // Strip out everything that looks like a verse reference: "book chapter:verse-verse"
  // Handles: "psalm 110:1", "isaiah 22:12-14", "genesis 2", "1 thessalonians 4", "revelation 2&3"
  const stripped = text
    .replace(/\d*\s*[a-z]+\s+\d+(?::\d+(?:-\d+)?)?/gi, "")  // verse refs
    .replace(/[,;\s&.?\d]+/g, "")  // separators, punctuation, and lone numbers
    .trim()
  return stripped.length === 0
}

// ── Cross-reference grouping ──
// Groups consecutive verses in the same chapter: ["2 Kings 18:1","2 Kings 18:2","2 Kings 18:3"] → [{label:"2 Kings 18:1-3", refs:[...]}]
interface CrossRefGroup {
  label: string
  refs: string[]
}

function consolidateCrossRefs(crossRefs: string[]): CrossRefGroup[] {
  // Parse each ref into {book+chapter, verse}
  const parsed: { raw: string; prefix: string; verse: number }[] = []
  for (const ref of crossRefs) {
    const m = ref.match(/^(.+?)\s+(\d+):(\d+)$/)
    if (m) {
      parsed.push({ raw: ref, prefix: `${m[1]} ${m[2]}`, verse: parseInt(m[3]) })
    } else {
      // Chapter-only or unparseable — standalone group
      parsed.push({ raw: ref, prefix: "", verse: -1 })
    }
  }

  const groups: CrossRefGroup[] = []
  let i = 0
  while (i < parsed.length) {
    const p = parsed[i]
    if (p.verse < 0 || !p.prefix) {
      groups.push({ label: p.raw, refs: [p.raw] })
      i++
      continue
    }

    // Collect consecutive verses with the same prefix
    const run = [p]
    let j = i + 1
    while (j < parsed.length && parsed[j].prefix === p.prefix && parsed[j].verse === run[run.length - 1].verse + 1) {
      run.push(parsed[j])
      j++
    }

    if (run.length === 1) {
      groups.push({ label: p.raw, refs: [p.raw] })
    } else {
      const firstV = run[0].verse
      const lastV = run[run.length - 1].verse
      groups.push({
        label: `${p.prefix}:${firstV}-${lastV}`,
        refs: run.map(r => r.raw),
      })
    }
    i = j
  }

  return groups
}

// ── Main init ──
function init() {
  const container = document.querySelector(".bible-reader") as HTMLElement | null
  if (!container) return

  const input = document.getElementById("br-input") as HTMLInputElement
  const acList = document.getElementById("br-autocomplete") as HTMLUListElement
  const clearBtn = document.getElementById("br-input-clear") as HTMLButtonElement
  const navEl = document.getElementById("br-nav") as HTMLElement
  const prevBtn = document.getElementById("br-prev") as HTMLButtonElement
  const nextBtn = document.getElementById("br-next") as HTMLButtonElement
  const pickerBtn = document.getElementById("br-book-picker-btn") as HTMLButtonElement
  const contentEl = document.getElementById("br-content") as HTMLElement
  const textBody = document.getElementById("br-text-body") as HTMLElement
  const notesBody = document.getElementById("br-notes-body") as HTMLElement
  const notesCount = document.getElementById("br-notes-count") as HTMLElement
  const onboarding = document.getElementById("br-onboarding") as HTMLElement
  const pickerEl = document.getElementById("br-picker") as HTMLElement
  const pickerBackdrop = document.getElementById("br-picker-backdrop") as HTMLElement
  const pickerBody = document.getElementById("br-picker-body") as HTMLElement
  const pickerClose = document.getElementById("br-picker-close") as HTMLButtonElement
  const mobileToggle = document.getElementById("br-mobile-notes-toggle") as HTMLButtonElement
  const mobileSheet = document.getElementById("br-mobile-sheet") as HTMLElement
  const mobileSheetBackdrop = document.getElementById("br-mobile-sheet-backdrop") as HTMLElement
  const mobileSheetBody = document.getElementById("br-mobile-sheet-body") as HTMLElement
  const mobileSheetCount = document.getElementById("br-mobile-sheet-count") as HTMLElement
  const mobileSheetClose = document.getElementById("br-mobile-sheet-close") as HTMLButtonElement
  const mobileBadge = document.getElementById("br-mobile-notes-badge") as HTMLElement
  const previewEl = document.getElementById("br-note-preview") as HTMLElement

  if (!input || !textBody) return

  isMobile = window.matchMedia("(max-width: 799px)").matches
  const mq = window.matchMedia("(max-width: 799px)")
  mq.addEventListener("change", (e) => { isMobile = e.matches; updateMobileToggle() })

  // ── Sticky search bar: sit flush below the page header ──
  const searchWrap = container.querySelector(".br-search-wrap") as HTMLElement | null
  const isDesktopMq = window.matchMedia("(min-width: 801px)")
  const updateStickyTop = () => {
    if (!searchWrap) return
    if (isDesktopMq.matches) {
      const headerEl =
        (document.querySelector(".page-header > header") as HTMLElement | null) ??
        (document.querySelector(".page-header") as HTMLElement | null)
      const bottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0
      searchWrap.style.top = `${Math.max(0, bottom)}px`
    } else {
      const mobileNav = document.querySelector(".sidebar.left") as HTMLElement | null
      const bottom = mobileNav ? mobileNav.getBoundingClientRect().bottom : 0
      searchWrap.style.top = `${Math.max(0, bottom)}px`
    }
    // Nav bar sits below search wrap
    if (navEl) {
      const searchBottom = searchWrap.getBoundingClientRect().height
      const navTop = parseFloat(searchWrap.style.top) + searchBottom
      navEl.style.top = `${navTop}px`

      // Notes panel + text panel stick to bottom of nav bar
      const navHeight = navEl.getBoundingClientRect().height
      const totalStickyHeight = navTop + navHeight
      const notesPanel = container.querySelector(".br-notes-panel") as HTMLElement | null
      if (notesPanel) {
        notesPanel.style.top = `${totalStickyHeight}px`
        notesPanel.style.maxHeight = `calc(100vh - ${totalStickyHeight + 20}px)`
      }
      // Set scroll-margin so verse lines land below sticky headers
      container.style.setProperty("--br-sticky-height", `${totalStickyHeight + 8}px`)
    }
  }

  if (searchWrap) {
    requestAnimationFrame(updateStickyTop)
    const headerTarget =
      (document.querySelector(".page-header > header") as HTMLElement | null) ??
      (document.querySelector(".page-header") as HTMLElement | null) ??
      (document.querySelector(".sidebar.left") as HTMLElement | null)
    if (headerTarget) {
      const ro = new ResizeObserver(updateStickyTop)
      ro.observe(headerTarget)
      if (navEl) ro.observe(navEl)
      window.addCleanup?.(() => ro.disconnect())
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout>
  let previewTimeout: ReturnType<typeof setTimeout>

  // ── Back navigation stack ──
  const navStack: { book: string; chapter: number; verse?: number; label: string }[] = []
  const backPill = document.createElement("button")
  backPill.className = "br-back-pill"
  backPill.style.display = "none"
  container.appendChild(backPill)

  function updateBackPill() {
    if (navStack.length === 0) {
      backPill.style.display = "none"
      return
    }
    const prev = navStack[navStack.length - 1]
    backPill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back to ${escHtml(prev.label)}`
    backPill.style.display = "flex"
  }

  backPill.addEventListener("click", () => {
    const prev = navStack.pop()
    if (!prev) return
    const ref = prev.verse ? `${prev.book} ${prev.chapter}:${prev.verse}` : `${prev.book} ${prev.chapter}`
    navigateToRef(ref, false)
    updateBackPill()
  })

  const updateClearBtn = () => {
    if (clearBtn) clearBtn.classList.toggle("visible", input.value.length > 0)
  }

  // ── Autocomplete ──
  function showAutocomplete(query: string) {
    const q = query.toLowerCase()
    const parsed = parseSearchQuery(query)

    // Build suggestions from book list + verseIndex
    const suggestions: { label: string; sub: string }[] = []

    if (parsed) {
      const book = parsed.book
      const maxCh = BOOK_CHAPTERS[book] ?? 0
      if (parsed.chapter) {
        const ch = parseInt(parsed.chapter)
        if (parsed.verse) {
          // Specific verse typed — show the verse as suggestion
          suggestions.push({ label: `${book} ${ch}:${parsed.verse}${parsed.endVerse ? `-${parsed.endVerse}` : ""}`, sub: "verse" })
        }
        // Show chapter
        suggestions.push({ label: `${book} ${ch}`, sub: `${maxCh} chapters` })
        // Show nearby chapters
        for (let c = ch + 1; c <= Math.min(ch + 3, maxCh); c++) {
          suggestions.push({ label: `${book} ${c}`, sub: "chapter" })
        }
      } else {
        // Book only — show first few chapters
        for (let c = 1; c <= Math.min(5, maxCh); c++) {
          suggestions.push({ label: `${book} ${c}`, sub: maxCh > 1 ? `of ${maxCh} chapters` : "1 chapter" })
        }
      }
    } else {
      // Fuzzy book match
      for (const book of BOOK_ORDER) {
        if (book.toLowerCase().startsWith(q)) {
          const maxCh = BOOK_CHAPTERS[book] ?? 0
          suggestions.push({ label: book, sub: `${maxCh} chapter${maxCh !== 1 ? "s" : ""}` })
        }
      }
    }

    if (suggestions.length === 0) { closeAc(); return }

    acIndex = -1
    acList.innerHTML = suggestions.slice(0, 8).map((s) =>
      `<li data-ref="${escHtml(s.label)}" role="option"><span class="br-ac-label">${escHtml(s.label)}</span><span class="br-ac-sub">${escHtml(s.sub)}</span></li>`
    ).join("")
    acList.classList.add("open")
  }

  function closeAc() {
    acList.classList.remove("open")
    acList.innerHTML = ""
    acIndex = -1
  }

  function updateAcHighlight() {
    const items = acList.querySelectorAll("li")
    items.forEach((item, i) => item.classList.toggle("active", i === acIndex))
    if (acIndex >= 0) items[acIndex]?.scrollIntoView({ block: "nearest" })
  }

  // ── Navigation ──
  function navigateToRef(query: string, pushToStack = true) {
    const parsed = parseSearchQuery(query)
    if (!parsed) return

    const book = parsed.book
    const chapter = parsed.chapter ? parseInt(parsed.chapter) : 1
    const maxCh = BOOK_CHAPTERS[book]
    if (!maxCh) return

    // Push current location to nav stack before navigating
    if (pushToStack && currentBook && currentChapter) {
      const verseNum = activeVerseRef ? parseInt(activeVerseRef.match(/:(\d+)$/)?.[1] || "0") : undefined
      navStack.push({
        book: currentBook,
        chapter: currentChapter,
        verse: verseNum || undefined,
        label: `${currentBook} ${currentChapter}${verseNum ? `:${verseNum}` : ""}`,
      })
      // Cap stack at 20 entries
      if (navStack.length > 20) navStack.shift()
    }

    const ch = Math.max(1, Math.min(chapter, maxCh))
    currentBook = book
    currentChapter = ch

    const canonical = `${book} ${ch}`
    input.value = canonical
    updateClearBtn()
    closeAc()

    // Update UI
    navEl.style.display = ""
    pickerBtn.textContent = canonical
    contentEl.style.display = ""
    onboarding.style.display = "none"

    // Recalculate sticky positions now that nav is visible
    requestAnimationFrame(updateStickyTop)

    // If a specific verse was searched, highlight it after loading
    const targetVerse = parsed.verse ? parseInt(parsed.verse) : 0

    // Load chapter
    loadChapter(book, ch, targetVerse)
    updateUrl(canonical)
    updateBackPill()
  }

  async function loadChapter(book: string, chapter: number, highlightVerse = 0) {
    // Crossfade out
    textBody.classList.add("br-fade-out")
    await new Promise(r => setTimeout(r, 150))

    // Show loading
    textBody.innerHTML = `<div class="br-loading"><div class="br-shimmer"></div><div class="br-shimmer"></div><div class="br-shimmer"></div><div class="br-shimmer"></div><div class="br-shimmer"></div></div>`
    textBody.classList.remove("br-fade-out")

    const verses = await fetchChapter(book, chapter)
    if (verses.length === 0) {
      textBody.innerHTML = `<div class="br-empty">Could not load ${escHtml(book)} ${chapter}. This may not be available in KJV.</div>`
      renderNotes(book, chapter, [])
      return
    }

    // Crossfade in new content
    textBody.classList.add("br-fade-out")
    renderVerses(verses, book, chapter, highlightVerse)
    renderNotes(book, chapter, verses)
    updateMobileToggle()

    // Trigger reflow then fade in
    void textBody.offsetHeight
    textBody.classList.remove("br-fade-out")

    // Scroll to highlighted verse
    if (highlightVerse > 0) {
      requestAnimationFrame(() => {
        const el = textBody.querySelector(`[data-verse="${highlightVerse}"]`) as HTMLElement
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          el.classList.add("br-verse-highlight")
        }
      })
    }
  }

  function renderVerses(verses: VerseData[], book: string, chapter: number, highlightVerse: number) {
    const hasNotes = (v: number) => {
      if (!verseIndex) return false
      const ref = `${book} ${chapter}:${v}`
      const entries = (verseIndex.index[ref] ?? []).filter(e => e.slug !== "_bg")
      const crossRefs = verseIndex.cooccurrence[ref] ?? []
      const bgCrossRefs = verseIndex.bgCooccurrence?.[ref] ?? []
      const bgNote = verseIndex.bgNotes?.[ref]
      return entries.length > 0 || crossRefs.length > 0 || bgCrossRefs.length > 0 || !!bgNote
    }

    textBody.innerHTML = verses.map((v) => {
      const ref = `${book} ${chapter}:${v.verse}`
      const noted = hasNotes(v.verse)
      const active = v.verse === highlightVerse
      return `<div class="br-verse-line${noted ? " br-has-notes" : ""}${active ? " br-verse-highlight" : ""}" data-ref="${escHtml(ref)}" data-verse="${v.verse}">
        <span class="br-verse-num">${v.verse}</span>
        <span class="br-verse-text">${escHtml(v.text)}</span>
        ${noted ? `<span class="br-verse-dot" data-tooltip="Has study notes"></span>` : ""}
      </div>`
    }).join("")

    // Add verse click handler
    textBody.querySelectorAll(".br-verse-line").forEach((el) => {
      el.addEventListener("click", () => {
        const ref = (el as HTMLElement).dataset.ref!
        // Toggle active
        textBody.querySelectorAll(".br-verse-line").forEach(v => v.classList.remove("br-verse-active"))
        el.classList.add("br-verse-active")
        activeVerseRef = ref

        // Scroll notes to this verse
        scrollNotesToVerse(ref)

        // Auto-open mobile sheet if verse has notes
        if (isMobile && el.classList.contains("br-has-notes") && !mobileSheet.classList.contains("open")) {
          openMobileSheet()
        }

        // Update URL with specific verse
        updateUrl(ref)
      })
    })
  }

  function renderNotes(book: string, chapter: number, verses: VerseData[]) {
    if (!verseIndex) {
      notesBody.innerHTML = `<div class="br-notes-empty">Loading notes...</div>`
      return
    }

    // Collect all notes for this chapter, grouped by verse
    const groups: { ref: string; verse: number; label: string; entries: VerseIndexEntry[]; crossRefs: string[]; bgCrossRefs: string[]; bgNote?: BGNote }[] = []
    let totalCount = 0

    // Chapter-level notes (e.g. "John 3" without a verse)
    const chapterRef = `${book} ${chapter}`
    const chapterEntries = (verseIndex.index[chapterRef] ?? []).filter(e => e.slug !== "_bg")
    const chapterCrossRefs = verseIndex.cooccurrence[chapterRef] ?? []
    const chapterBgCrossRefs = verseIndex.bgCooccurrence?.[chapterRef] ?? []
    const chapterBgNote = verseIndex.bgNotes?.[chapterRef]
    if (chapterEntries.length > 0 || chapterCrossRefs.length > 0 || chapterBgCrossRefs.length > 0 || chapterBgNote) {
      groups.push({ ref: chapterRef, verse: 0, label: "Chapter", entries: chapterEntries, crossRefs: chapterCrossRefs, bgCrossRefs: chapterBgCrossRefs, bgNote: chapterBgNote })
      totalCount += chapterEntries.length
    }

    // Verse-level notes
    for (const v of verses) {
      const ref = `${book} ${chapter}:${v.verse}`
      const entries = (verseIndex.index[ref] ?? []).filter(e => e.slug !== "_bg")
      const crossRefs = verseIndex.cooccurrence[ref] ?? []
      const bgCrossRefs = verseIndex.bgCooccurrence?.[ref] ?? []
      const bgNote = verseIndex.bgNotes?.[ref]
      if (entries.length > 0 || crossRefs.length > 0 || bgCrossRefs.length > 0 || bgNote) {
        groups.push({ ref, verse: v.verse, label: `v${v.verse}`, entries, crossRefs, bgCrossRefs, bgNote })
        totalCount += entries.length
      }
    }

    notesCount.textContent = totalCount > 0 ? `${totalCount}` : ""
    if (mobileBadge) mobileBadge.textContent = totalCount > 0 ? `${totalCount}` : ""
    if (mobileSheetCount) mobileSheetCount.textContent = totalCount > 0 ? `(${totalCount})` : ""

    // Prevent empty notes panel from trapping scroll events
    const notesPanel = document.getElementById("br-notes-panel")

    if (groups.length === 0) {
      const emptyMsg = `<div class="br-notes-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>No notes for ${escHtml(book)} ${chapter} yet</span>
      </div>`
      notesBody.innerHTML = emptyMsg
      if (mobileSheetBody) mobileSheetBody.innerHTML = emptyMsg
      if (notesPanel) notesPanel.style.overflowY = "hidden"
      return
    }

    if (notesPanel) notesPanel.style.overflowY = "auto"

    const html = groups.map((g) => {
      const noteCards = g.entries.map((e) => {
        const color = sectionColors[e.folder] ?? "#8b8b8b"
        const label = sectionLabels[e.folder] ?? e.folder
        const dateStr = contentDates[e.slug]
        const datePill = dateStr ? `<span class="br-note-date">${relativeDate(dateStr)}</span>` : ""
        const displayTitle = formatNoteTitle(e)
        return `<a class="br-note-card br-note-card--linked" href="/${e.slug}" data-slug="${e.slug}" data-section="${e.folder}">
          <span class="br-note-section-dot" style="background:${color}" data-tooltip="${label}"></span>
          <span class="br-note-info">
            <span class="br-note-title">${escHtml(displayTitle)}</span>
            ${datePill}
          </span>
        </a>`
      }).join("")

      // BG study note — show the full text, skip observations (they're fragments of the text).
      // If the text is purely verse references, don't show it (cross-ref chips already cover it).
      const showBgNote = g.bgNote && !isVerseOnlyBGNote(g.bgNote)
      const bgSection = showBgNote
        ? `<div class="br-bg-note">
            <div class="br-bg-note-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>BG Study Note</span>
            </div>
            <div class="br-bg-note-text">${escHtml(g.bgNote!.text)}</div>
          </div>`
        : ""

      // BG cross-references (prominent)
      const bgCrGroups = consolidateCrossRefs(g.bgCrossRefs)
      const bgCrossRefSection = bgCrGroups.length > 0
        ? `<div class="br-cross-refs">
            <div class="br-cross-ref-label">Cross-References</div>
            <div class="br-cross-ref-chips">${bgCrGroups.map(crg =>
              `<button class="br-cross-ref-chip" data-ref="${escHtml(crg.refs[0])}">${escHtml(crg.label)}</button>`
            ).join("")}</div>
          </div>`
        : ""

      // Workspace cross-references (collapsed accordion, muted chips)
      const wsCrGroups = consolidateCrossRefs(g.crossRefs)
      const wsCrossRefSection = wsCrGroups.length > 0
        ? `<details class="br-linked-notes">
            <summary class="br-linked-notes-summary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Linked Refs <span class="br-linked-notes-count">${wsCrGroups.length}</span>
            </summary>
            <div class="br-linked-notes-body">
              <div class="br-cross-ref-chips">${wsCrGroups.map(crg =>
                `<button class="br-cross-ref-chip br-cross-ref-chip--muted" data-ref="${escHtml(crg.refs[0])}">${escHtml(crg.label)}</button>`
              ).join("")}</div>
            </div>
          </details>`
        : ""

      // Workspace notes wrapped in collapsible accordion
      const linkedNotesSection = noteCards
        ? `<details class="br-linked-notes">
            <summary class="br-linked-notes-summary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Linked Notes <span class="br-linked-notes-count">${g.entries.length}</span>
            </summary>
            <div class="br-linked-notes-body">${noteCards}</div>
          </details>`
        : ""

      const countLabel = g.entries.length > 0 ? `${g.entries.length}` : ""

      return `<div class="br-note-group" data-verse-ref="${escHtml(g.ref)}" id="br-notes-${g.verse}">
        <div class="br-note-group-header">
          <span class="br-note-verse-ref">${g.label}</span>
          <span class="br-note-group-count">${countLabel}</span>
        </div>
        ${bgSection}
        ${bgCrossRefSection}
        ${linkedNotesSection}
        ${wsCrossRefSection}
      </div>`
    }).join("")

    notesBody.innerHTML = html
    if (mobileSheetBody) mobileSheetBody.innerHTML = html

    // Cross-ref chip clicks → navigate to that verse
    const setupCrossRefClicks = (container: HTMLElement) => {
      container.querySelectorAll(".br-cross-ref-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const ref = (chip as HTMLElement).dataset.ref
          if (ref) navigateToRef(ref)
        })
      })
    }
    setupCrossRefClicks(notesBody)
    if (mobileSheetBody) setupCrossRefClicks(mobileSheetBody)

    // Preview on hover, navigate on click
    const setupNoteInteractions = (container: HTMLElement) => {
      container.querySelectorAll(".br-note-card").forEach((card) => {
        card.addEventListener("mouseenter", (e) => {
          if (isMobile) return
          clearTimeout(previewTimeout)
          previewTimeout = setTimeout(() => showNotePreview(card as HTMLElement), 300)
        })
        card.addEventListener("mouseleave", () => {
          clearTimeout(previewTimeout)
          hideNotePreview()
        })
      })
    }
    setupNoteInteractions(notesBody)
    if (mobileSheetBody) setupNoteInteractions(mobileSheetBody)
  }

  function scrollNotesToVerse(ref: string) {
    const verseNum = ref.match(/:(\d+)$/)?.[1]
    if (!verseNum) return

    // Scroll the overflow containers (the panel wrappers, not the inner bodies)
    const notesPanel = document.getElementById("br-notes-panel")
    const scrollTargets = [notesPanel, mobileSheetBody?.parentElement].filter(Boolean) as HTMLElement[]
    for (const scrollContainer of scrollTargets) {
      const group = scrollContainer.querySelector(`#br-notes-${verseNum}`) as HTMLElement
      if (group) {
        // Use relative scrollTo to avoid scrolling ancestor containers
        const containerRect = scrollContainer.getBoundingClientRect()
        const groupRect = group.getBoundingClientRect()
        scrollContainer.scrollTo({
          top: scrollContainer.scrollTop + (groupRect.top - containerRect.top),
          behavior: "smooth",
        })
        group.classList.add("br-note-group-flash")
        setTimeout(() => group.classList.remove("br-note-group-flash"), 1500)
      }
    }
  }

  // ── Note preview ──
  function showNotePreview(card: HTMLElement) {
    if (!previewEl) return
    const slug = card.dataset.slug
    if (!slug) return

    const title = card.querySelector(".br-note-title")?.textContent ?? slug
    const section = card.dataset.section ?? ""
    const color = sectionColors[section] ?? "#8b8b8b"
    const label = sectionLabels[section] ?? section
    const dateStr = contentDates[slug]
    const date = dateStr ? relativeDate(dateStr) : ""

    previewEl.innerHTML = `
      <div class="br-preview-header">
        <span class="br-preview-dot" style="background:${color}"></span>
        <span class="br-preview-label">${label}</span>
        ${date ? `<span class="br-preview-date">${date}</span>` : ""}
      </div>
      <div class="br-preview-title">${escHtml(title)}</div>
      <div class="br-preview-hint">Click to open note</div>
    `

    const rect = card.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // Position to the left of card on desktop
    let left = rect.left - 220
    if (left < 10) left = rect.right + 8
    previewEl.style.left = left + "px"
    previewEl.style.top = Math.max(rect.top, containerRect.top + 60) + "px"
    previewEl.classList.add("visible")
  }

  function hideNotePreview() {
    if (previewEl) previewEl.classList.remove("visible")
  }

  // ── Mobile toggle ──
  function updateMobileToggle() {
    if (!mobileToggle) return
    if (isMobile && currentBook) {
      mobileToggle.style.display = ""
    } else {
      mobileToggle.style.display = "none"
    }
  }

  const themeFloat = document.querySelector(".theme-float") as HTMLElement | null
  const settingsFab = document.querySelector(".mobile-settings-fab") as HTMLElement | null
  const calMobileBtn = document.getElementById("cal-mobile-btn") as HTMLElement | null

  // Hide daily notes button on Bible Reader page (overlaps with notes FAB)
  if (calMobileBtn) calMobileBtn.style.display = "none"

  function openMobileSheet() {
    mobileSheet.classList.add("open")
    mobileSheetBackdrop.classList.add("open")
    themeFloat?.classList.add("hidden-by-picker")
    settingsFab?.classList.add("hidden-by-picker")
  }

  function closeMobileSheet() {
    mobileSheet.classList.remove("open")
    mobileSheetBackdrop.classList.remove("open")
    themeFloat?.classList.remove("hidden-by-picker")
    settingsFab?.classList.remove("hidden-by-picker")
    // Release scroll focus back to the page
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  // ── Book/Chapter Picker ──
  function openPicker() {
    renderPicker()
    pickerEl.classList.add("open")
    pickerBackdrop.classList.add("open")
    themeFloat?.classList.add("hidden-by-picker")
  }

  function closePicker() {
    pickerEl.classList.remove("open")
    pickerBackdrop.classList.remove("open")
    themeFloat?.classList.remove("hidden-by-picker")
  }

  function renderPicker(selectedBook?: string) {
    if (selectedBook) {
      // Show chapters for selected book
      const maxCh = BOOK_CHAPTERS[selectedBook] ?? 0
      const chapters = Array.from({ length: maxCh }, (_, i) => i + 1)

      // Count notes per chapter
      const chapterNoteCounts: Record<number, number> = {}
      if (verseIndex) {
        for (const key of Object.keys(verseIndex.index)) {
          const match = key.match(/^(.+?)\s+(\d+):/)
          if (match && match[1] === selectedBook) {
            const ch = parseInt(match[2])
            const noteCount = (verseIndex.index[key] ?? []).filter(e => e.slug !== "_bg").length
            chapterNoteCounts[ch] = (chapterNoteCounts[ch] ?? 0) + noteCount
          }
        }
      }

      pickerBody.innerHTML = `
        <button class="br-picker-back pressable" id="br-picker-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          ${escHtml(selectedBook)}
        </button>
        <div class="br-chapter-grid">
          ${chapters.map((ch) => {
            const count = chapterNoteCounts[ch] ?? 0
            const isCurrent = selectedBook === currentBook && ch === currentChapter
            return `<button class="br-chapter-btn pressable${isCurrent ? " active" : ""}${count > 0 ? " has-notes" : ""}" data-book="${escHtml(selectedBook)}" data-ch="${ch}" data-tooltip="${count > 0 ? `${count} notes` : ""}">
              ${ch}
              ${count > 0 ? `<span class="br-ch-dot"></span>` : ""}
            </button>`
          }).join("")}
        </div>
      `

      pickerBody.querySelector("#br-picker-back")?.addEventListener("click", () => renderPicker())
    } else {
      // Show books
      const otIdx = BOOK_ORDER.indexOf("Matthew")
      const ot = BOOK_ORDER.slice(0, otIdx)
      const nt = BOOK_ORDER.slice(otIdx)

      const renderBookList = (books: string[]) => books.map((book) => {
        const isCurrent = book === currentBook
        return `<button class="br-book-btn pressable${isCurrent ? " active" : ""}" data-book="${escHtml(book)}">${escHtml(book)}</button>`
      }).join("")

      pickerBody.innerHTML = `
        <div class="br-picker-section">
          <div class="br-picker-section-title">Old Testament</div>
          <div class="br-book-grid">${renderBookList(ot)}</div>
        </div>
        <div class="br-picker-section">
          <div class="br-picker-section-title">New Testament</div>
          <div class="br-book-grid">${renderBookList(nt)}</div>
        </div>
      `
    }

    // Event delegation for picker clicks
    pickerBody.onclick = (e: MouseEvent) => {
      const bookBtn = (e.target as HTMLElement).closest(".br-book-btn") as HTMLElement
      if (bookBtn) {
        const book = bookBtn.dataset.book!
        renderPicker(book)
        return
      }
      const chBtn = (e.target as HTMLElement).closest(".br-chapter-btn") as HTMLElement
      if (chBtn) {
        const book = chBtn.dataset.book!
        const ch = parseInt(chBtn.dataset.ch!)
        closePicker()
        navigateToRef(`${book} ${ch}`)
      }
    }
  }

  // ── Navigation ──
  function navigateChapter(dir: -1 | 1) {
    if (!currentBook) return
    let newCh = currentChapter + dir
    let newBook = currentBook

    if (newCh < 1) {
      const idx = BOOK_ORDER.indexOf(currentBook)
      if (idx <= 0) return
      newBook = BOOK_ORDER[idx - 1]
      newCh = BOOK_CHAPTERS[newBook] ?? 1
    } else if (newCh > (BOOK_CHAPTERS[currentBook] ?? 999)) {
      const idx = BOOK_ORDER.indexOf(currentBook)
      if (idx >= BOOK_ORDER.length - 1) return
      newBook = BOOK_ORDER[idx + 1]
      newCh = 1
    }

    navigateToRef(`${newBook} ${newCh}`)
    textBody.scrollTop = 0
  }

  // ── URL management ──
  function updateUrl(query: string) {
    const params = new URLSearchParams()
    if (query) params.set("ref", query)
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    history.pushState(null, "", newUrl)
  }

  // ── Event listeners ──
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer)
    updateClearBtn()
    const q = input.value.trim()
    if (q.length < 2) { closeAc(); return }
    debounceTimer = setTimeout(() => showAutocomplete(q), 150)
  })

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    const items = acList.querySelectorAll("li")
    if (acList.classList.contains("open") && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        acIndex = Math.min(acIndex + 1, items.length - 1)
        updateAcHighlight()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        acIndex = Math.max(acIndex - 1, 0)
        updateAcHighlight()
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (acIndex >= 0 && items[acIndex]) {
          const ref = (items[acIndex] as HTMLElement).dataset.ref!
          closeAc()
          navigateToRef(ref)
        } else {
          const q = input.value.trim()
          closeAc()
          if (q) navigateToRef(q)
        }
        return
      } else if (e.key === "Escape") {
        closeAc()
        return
      }
    } else if (e.key === "Enter") {
      const q = input.value.trim()
      closeAc()
      if (q) navigateToRef(q)
    } else if (e.key === "Escape") {
      input.value = ""
      closeAc()
      updateClearBtn()
    }
  })

  acList.addEventListener("click", (e: MouseEvent) => {
    const li = (e.target as HTMLElement).closest("li") as HTMLElement
    if (!li) return
    const ref = li.dataset.ref!
    closeAc()
    navigateToRef(ref)
  })

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = ""
      input.focus()
      updateClearBtn()
      closeAc()
    })
  }

  // Close autocomplete on outside click
  document.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest(".br-search-wrap")) closeAc()
    if (!(e.target as HTMLElement).closest(".br-note-card") && !(e.target as HTMLElement).closest("#br-note-preview")) {
      hideNotePreview()
    }
  })

  // Navigation
  prevBtn?.addEventListener("click", () => navigateChapter(-1))
  nextBtn?.addEventListener("click", () => navigateChapter(1))
  pickerBtn?.addEventListener("click", () => openPicker())
  pickerClose?.addEventListener("click", () => closePicker())
  pickerBackdrop?.addEventListener("click", () => closePicker())

  // Mobile sheet
  mobileToggle?.addEventListener("click", () => openMobileSheet())
  mobileSheetClose?.addEventListener("click", () => closeMobileSheet())
  mobileSheetBackdrop?.addEventListener("click", () => closeMobileSheet())

  // Swipe-to-dismiss on mobile notes sheet
  let sheetStartY = 0, sheetCurrentY = 0, sheetDragging = false
  mobileSheet?.addEventListener("touchstart", (e) => {
    sheetStartY = e.touches[0].clientY
    sheetCurrentY = sheetStartY
    sheetDragging = true
    mobileSheet.style.transition = "none"
  }, { passive: true })
  mobileSheet?.addEventListener("touchmove", (e) => {
    if (!sheetDragging) return
    sheetCurrentY = e.touches[0].clientY
    const dy = Math.max(0, sheetCurrentY - sheetStartY)
    mobileSheet.style.transform = `translateY(${dy}px)`
  }, { passive: true })
  mobileSheet?.addEventListener("touchend", () => {
    if (!sheetDragging) return
    sheetDragging = false
    mobileSheet.style.transition = ""
    mobileSheet.style.transform = ""
    if (sheetCurrentY - sheetStartY > 80) closeMobileSheet()
  })

  // Mobile swipe between chapters
  let swipeStartX = 0, swipeStartY = 0, swiping = false
  textBody.addEventListener("touchstart", (e) => {
    swipeStartX = e.touches[0].clientX
    swipeStartY = e.touches[0].clientY
    swiping = true
  }, { passive: true })
  textBody.addEventListener("touchend", (e) => {
    if (!swiping || !currentBook) return
    swiping = false
    const dx = e.changedTouches[0].clientX - swipeStartX
    const dy = e.changedTouches[0].clientY - swipeStartY
    // Horizontal swipe: min 50px, max 30px vertical drift
    if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
      if (dx < 0) navigateChapter(1)  // swipe left → next
      else navigateChapter(-1)         // swipe right → prev
    }
  }, { passive: true })

  // Keyboard navigation for chapters
  document.addEventListener("keydown", (e) => {
    if (document.activeElement === input) return
    if (!currentBook) return
    if (e.key === "ArrowLeft") navigateChapter(-1)
    if (e.key === "ArrowRight") navigateChapter(1)
  })

  // Onboarding example links
  onboarding?.querySelectorAll(".br-example-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ref = (btn as HTMLElement).dataset.ref!
      navigateToRef(ref)
    })
  })

  // Popstate
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) navigateToRef(ref)
  })

  // Keyboard shortcut: / to focus search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input && !(document.activeElement as HTMLElement)?.closest("input, textarea")) {
      e.preventDefault()
      input.focus()
      input.select()
    }
  })

  // ── Load data and check URL ──
  loadData().then(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) {
      navigateToRef(ref)
    }
  })

  // Cleanup for SPA
  window.addCleanup?.(() => {
    clearTimeout(debounceTimer)
    clearTimeout(previewTimeout)
    // Restore daily notes button when leaving Bible Reader
    if (calMobileBtn) calMobileBtn.style.display = ""
    // Clean up back pill
    backPill.remove()
    navStack.length = 0
  })
}

document.addEventListener("nav", init)
