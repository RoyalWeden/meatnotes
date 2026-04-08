// Verse Chain Explorer — Horizontal Flow Layout
// Desktop: scrollable columns showing degree of connection
// Mobile: vertical stack with depth indentation

interface VerseIndexEntry {
  slug: string
  title: string
  folder: string
}

interface VerseIndexData {
  index: Record<string, VerseIndexEntry[]>
  cooccurrence: Record<string, string[]>
  connectionStrength?: Record<string, Record<string, number>>
  pdfConnections?: Record<string, string[]>
}

const HISTORY_KEY = "verse-chain-history"
const VERSE_CACHE_KEY = "verse-text-cache"
const MAX_HISTORY = 20
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
  // Genesis
  gen: "Genesis", ge: "Genesis", gn: "Genesis",
  // Exodus
  ex: "Exodus", exod: "Exodus", exo: "Exodus",
  // Leviticus
  lev: "Leviticus", le: "Leviticus", lv: "Leviticus",
  // Numbers
  num: "Numbers", nu: "Numbers", nm: "Numbers", nb: "Numbers",
  // Deuteronomy
  deut: "Deuteronomy", de: "Deuteronomy", dt: "Deuteronomy",
  // Joshua
  josh: "Joshua", jos: "Joshua",
  // Judges
  judg: "Judges", jdg: "Judges", jg: "Judges",
  // Ruth
  ru: "Ruth", rut: "Ruth",
  // 1 Samuel
  "1sa": "1 Samuel", "1sam": "1 Samuel", "1 sa": "1 Samuel", "1 sam": "1 Samuel", "i sam": "1 Samuel", "i sa": "1 Samuel",
  // 2 Samuel
  "2sa": "2 Samuel", "2sam": "2 Samuel", "2 sa": "2 Samuel", "2 sam": "2 Samuel", "ii sam": "2 Samuel", "ii sa": "2 Samuel",
  // 1 Kings
  "1ki": "1 Kings", "1kgs": "1 Kings", "1 ki": "1 Kings", "1 kgs": "1 Kings", "i ki": "1 Kings", "i kgs": "1 Kings",
  // 2 Kings
  "2ki": "2 Kings", "2kgs": "2 Kings", "2 ki": "2 Kings", "2 kgs": "2 Kings", "ii ki": "2 Kings", "ii kgs": "2 Kings",
  // 1 Chronicles
  "1ch": "1 Chronicles", "1chr": "1 Chronicles", "1 ch": "1 Chronicles", "1 chr": "1 Chronicles", "i chr": "1 Chronicles",
  // 2 Chronicles
  "2ch": "2 Chronicles", "2chr": "2 Chronicles", "2 ch": "2 Chronicles", "2 chr": "2 Chronicles", "ii chr": "2 Chronicles",
  // Ezra
  ezr: "Ezra",
  // Nehemiah
  neh: "Nehemiah", ne: "Nehemiah",
  // Esther
  est: "Esther", esth: "Esther",
  // Job
  jb: "Job",
  // Psalms
  ps: "Psalms", psa: "Psalms", psm: "Psalms", pss: "Psalms", psalm: "Psalms",
  // Proverbs
  pro: "Proverbs", prov: "Proverbs", pr: "Proverbs", prv: "Proverbs",
  // Ecclesiastes
  ecc: "Ecclesiastes", eccl: "Ecclesiastes", eccles: "Ecclesiastes", ec: "Ecclesiastes",
  // Song of Solomon
  sos: "Song of Solomon", song: "Song of Solomon", ss: "Song of Solomon", sg: "Song of Solomon",
  // Isaiah
  isa: "Isaiah", is: "Isaiah",
  // Jeremiah
  jer: "Jeremiah", je: "Jeremiah", jr: "Jeremiah",
  // Lamentations
  lam: "Lamentations", la: "Lamentations",
  // Ezekiel
  ezk: "Ezekiel", eze: "Ezekiel", ezek: "Ezekiel",
  // Daniel
  dan: "Daniel", da: "Daniel", dn: "Daniel",
  // Hosea
  hos: "Hosea", ho: "Hosea",
  // Joel
  joe: "Joel", jl: "Joel",
  // Amos
  am: "Amos", amo: "Amos",
  // Obadiah
  ob: "Obadiah", oba: "Obadiah", obad: "Obadiah",
  // Jonah
  jon: "Jonah", jnh: "Jonah",
  // Micah
  mic: "Micah", mi: "Micah",
  // Nahum
  nah: "Nahum", na: "Nahum",
  // Habakkuk
  hab: "Habakkuk",
  // Zephaniah
  zep: "Zephaniah", zeph: "Zephaniah",
  // Haggai
  hag: "Haggai", hg: "Haggai",
  // Zechariah
  zec: "Zechariah", zech: "Zechariah",
  // Malachi
  mal: "Malachi", ml: "Malachi",
  // Matthew
  mat: "Matthew", matt: "Matthew", mt: "Matthew",
  // Mark
  mk: "Mark", mar: "Mark", mrk: "Mark",
  // Luke
  lk: "Luke", luk: "Luke", lu: "Luke",
  // John
  jn: "John", jhn: "John", joh: "John",
  // Acts
  ac: "Acts", act: "Acts",
  // Romans
  rom: "Romans", ro: "Romans", rm: "Romans",
  // 1 Corinthians
  "1co": "1 Corinthians", "1cor": "1 Corinthians", "1 co": "1 Corinthians", "1 cor": "1 Corinthians",
  "1corinthians": "1 Corinthians", "i cor": "1 Corinthians", "i co": "1 Corinthians",
  // 2 Corinthians
  "2co": "2 Corinthians", "2cor": "2 Corinthians", "2 co": "2 Corinthians", "2 cor": "2 Corinthians",
  "2corinthians": "2 Corinthians", "ii cor": "2 Corinthians", "ii co": "2 Corinthians",
  // Galatians
  gal: "Galatians", ga: "Galatians",
  // Ephesians
  eph: "Ephesians", ep: "Ephesians",
  // Philippians
  phil: "Philippians", php: "Philippians", pp: "Philippians",
  // Colossians
  col: "Colossians",
  // 1 Thessalonians
  "1th": "1 Thessalonians", "1thess": "1 Thessalonians", "1 th": "1 Thessalonians", "1 thess": "1 Thessalonians", "i thess": "1 Thessalonians",
  // 2 Thessalonians
  "2th": "2 Thessalonians", "2thess": "2 Thessalonians", "2 th": "2 Thessalonians", "2 thess": "2 Thessalonians", "ii thess": "2 Thessalonians",
  // 1 Timothy
  "1ti": "1 Timothy", "1tim": "1 Timothy", "1 ti": "1 Timothy", "1 tim": "1 Timothy", "i tim": "1 Timothy",
  // 2 Timothy
  "2ti": "2 Timothy", "2tim": "2 Timothy", "2 ti": "2 Timothy", "2 tim": "2 Timothy", "ii tim": "2 Timothy",
  // Titus
  tit: "Titus", ti: "Titus",
  // Philemon
  phm: "Philemon", philem: "Philemon",
  // Hebrews
  heb: "Hebrews", he: "Hebrews",
  // James
  jas: "James", jm: "James",
  // 1 Peter
  "1pe": "1 Peter", "1pet": "1 Peter", "1pt": "1 Peter", "1 pe": "1 Peter", "1 pet": "1 Peter", "i pet": "1 Peter",
  // 2 Peter
  "2pe": "2 Peter", "2pet": "2 Peter", "2pt": "2 Peter", "2 pe": "2 Peter", "2 pet": "2 Peter", "ii pet": "2 Peter",
  // 1 John
  "1jn": "1 John", "1jo": "1 John", "1 jn": "1 John", "1 jo": "1 John", "i jn": "1 John", "i john": "1 John",
  // 2 John
  "2jn": "2 John", "2jo": "2 John", "2 jn": "2 John", "2 jo": "2 John", "ii jn": "2 John", "ii john": "2 John",
  // 3 John
  "3jn": "3 John", "3jo": "3 John", "3 jn": "3 John", "3 jo": "3 John", "iii jn": "3 John", "iii john": "3 John",
  // Jude
  jud: "Jude", jde: "Jude",
  // Revelation
  rev: "Revelation", re: "Revelation", rv: "Revelation",
  // ── Apocrypha / Deuterocanonical ──
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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1])
      prev = tmp
    }
  }
  return dp[m]
}

function normalizeBookName(input: string): string | null {
  const q = input.toLowerCase().trim()
  if (!q) return null

  // 1. Direct alias lookup
  if (BOOK_ALIASES[q]) return BOOK_ALIASES[q]

  // 2. Handle compressed format: "1co10" → extract book part
  const compressedMatch = q.match(/^(\d?\s*[a-z]+?)(\d+.*)$/)
  if (compressedMatch) {
    const bookPart = compressedMatch[1].replace(/\s+/g, " ").trim()
    if (BOOK_ALIASES[bookPart]) return BOOK_ALIASES[bookPart]
  }

  // 3. Prefix match against known book names from the index
  if (verseIndex) {
    const allBooksInIndex = new Set<string>()
    for (const key of Object.keys(verseIndex.index)) {
      allBooksInIndex.add(key.replace(/\s+\d.*/, ""))
    }
    for (const book of allBooksInIndex) {
      if (book.toLowerCase().startsWith(q)) return book
    }
  }

  // 4. Prefix match against alias values
  const allBooks = [...new Set(Object.values(BOOK_ALIASES))]
  const prefixMatch = allBooks.find(b => b.toLowerCase().startsWith(q))
  if (prefixMatch) return prefixMatch

  // 5. Fuzzy fallback — Levenshtein distance ≤ 2
  let bestMatch = ""
  let bestDist = Infinity
  for (const book of allBooks) {
    const compareLen = Math.min(q.length, book.length)
    const dist = levenshtein(q, book.toLowerCase().slice(0, compareLen))
    if (dist < bestDist && dist <= 2) { bestDist = dist; bestMatch = book }
  }
  return bestMatch || null
}

// Parse a user query into normalized { book, chapter?, verse? } parts
function parseSearchQuery(query: string): { book: string; chapter?: string; verse?: string; endVerse?: string } | null {
  const q = query.trim()

  // Try compressed format: "1co10" or "1co10:5" or "1co10:5-8"
  const compressed = q.match(/^(\d?\s*[a-z]+?)(\d+)(?::(\d+)(?:-(\d+))?)?$/i)
  if (compressed) {
    const bookPart = compressed[1].trim()
    const resolved = normalizeBookName(bookPart)
    if (resolved) return { book: resolved, chapter: compressed[2], verse: compressed[3], endVerse: compressed[4] }
  }

  // Standard format: "1 Corinthians 10:5-8" or "Gen 1" or "John 3:16"
  const standard = q.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i)
  if (standard) {
    const resolved = normalizeBookName(standard[1])
    if (resolved) return { book: resolved, chapter: standard[2], verse: standard[3], endVerse: standard[4] }
  }

  // Book name only: "genesis" or "1co"
  const resolved = normalizeBookName(q)
  if (resolved) return { book: resolved }

  return null
}

let verseIndex: VerseIndexData | null = null
let contentDates: Record<string, string> = {} // slug → ISO date string
let currentFilter = "all"
let globalContext = 0 // 0, 1, 2, 3, 5, or -1 (full chapter)
let acIndex = -1

// Track expanded columns for the flow
interface FlowColumn {
  degree: number
  parentRef: string | null
  verses: string[]
  el: HTMLElement
  selectedRef: string | null
  searchLabel?: string
  connectionVia?: string
}

let flowColumns: FlowColumn[] = []
let isMobile = false
let mobileActiveCol = 0

// ── Range Consolidation ──
// Groups consecutive verse refs from the same book+chapter into ranges
// e.g. ["John 3:16", "John 3:17", "John 3:18", "John 3:20"] → [{ label: "John 3:16-18, 20", refs: [...] }]
interface ParsedRef { book: string; chapter: number; verse: number; raw: string }
interface RangeGroup { label: string; refs: string[] }

function parseVerseRef(ref: string): ParsedRef | null {
  // Match "Book Chapter:Verse" — handles numbered books like "1 Corinthians 11:3"
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)$/)
  if (!m) return null
  return { book: m[1], chapter: parseInt(m[2]), verse: parseInt(m[3]), raw: ref }
}

function consolidateRanges(refs: string[]): RangeGroup[] {
  // Parse all refs; keep unparseable ones as solo groups
  const parsed: (ParsedRef | null)[] = refs.map(parseVerseRef)

  // Group by book+chapter
  const groups = new Map<string, ParsedRef[]>()
  const soloGroups: RangeGroup[] = []

  for (let i = 0; i < refs.length; i++) {
    const p = parsed[i]
    if (!p) {
      soloGroups.push({ label: refs[i], refs: [refs[i]] })
      continue
    }
    const key = `${p.book} ${p.chapter}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const result: RangeGroup[] = []

  for (const [bookChap, verses] of groups) {
    // Sort by verse number
    verses.sort((a, b) => a.verse - b.verse)

    // Find consecutive runs
    const runs: ParsedRef[][] = []
    let currentRun: ParsedRef[] = [verses[0]]

    for (let i = 1; i < verses.length; i++) {
      if (verses[i].verse === currentRun[currentRun.length - 1].verse + 1) {
        currentRun.push(verses[i])
      } else {
        runs.push(currentRun)
        currentRun = [verses[i]]
      }
    }
    runs.push(currentRun)

    // Build label parts: "16-18, 20, 25-27"
    const parts = runs.map(run => {
      if (run.length === 1) return String(run[0].verse)
      return `${run[0].verse}-${run[run.length - 1].verse}`
    })

    const allRefs = verses.map(v => v.raw)
    const label = `${bookChap}:${parts.join(", ")}`
    result.push({ label, refs: allRefs })
  }

  // Maintain original order: book+chapter groups appear at the position of their first ref
  const ordered: RangeGroup[] = []
  const seen = new Set<string>()
  let soloIdx = 0

  for (let i = 0; i < refs.length; i++) {
    const p = parsed[i]
    if (!p) {
      if (soloIdx < soloGroups.length) ordered.push(soloGroups[soloIdx++])
      continue
    }
    const key = `${p.book} ${p.chapter}`
    if (!seen.has(key)) {
      seen.add(key)
      const group = result.find(g => g.label.startsWith(key + ":"))
      if (group) ordered.push(group)
    }
  }

  return ordered
}

function init() {
  const container = document.querySelector(".verse-chain") as HTMLElement | null
  if (!container) return

  const baseUrl = container.dataset.baseUrl ?? ""
  const input = document.getElementById("vc-input") as HTMLInputElement
  const acList = document.getElementById("vc-autocomplete") as HTMLUListElement
  const historyEl = document.getElementById("vc-history") as HTMLElement
  const filterSelect = document.getElementById("vc-filter-select") as HTMLSelectElement
  const countEl = document.getElementById("vc-count") as HTMLElement
  const flowEl = document.getElementById("vc-flow") as HTMLElement
  const contextSelect = document.getElementById("vc-context-select") as HTMLSelectElement
  const clearBtn = document.getElementById("vc-input-clear") as HTMLButtonElement

  if (!input || !flowEl) return

  // Clear stale state from previous SPA navigation
  flowEl.innerHTML = '<svg id="vc-lines" class="vc-lines"></svg>'
  if (countEl) countEl.textContent = ""
  if (historyEl) historyEl.innerHTML = ""
  input.value = ""
  mobileActiveCol = 0
  removeMobileNav()

  // Search clear button
  const updateClearBtn = () => {
    if (clearBtn) clearBtn.classList.toggle("visible", input.value.length > 0)
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = ""
      input.focus()
      updateClearBtn()
      acList.innerHTML = ""
      acList.classList.remove("visible")
    })
  }

  // Reset state
  currentFilter = "all"
  globalContext = 0
  acIndex = -1
  flowColumns = []
  isMobile = window.matchMedia("(max-width: 799px)").matches

  // Respond to resize
  const mqHandler = (e: MediaQueryListEvent) => {
    isMobile = e.matches
    mobileActiveCol = Math.min(mobileActiveCol, Math.max(0, flowColumns.length - 1))
    updateMobileView()
  }
  const mq = window.matchMedia("(max-width: 799px)")
  mq.addEventListener("change", mqHandler)

  // Swipe-right to go back on mobile
  let touchStartX = 0, touchDeltaX = 0
  flowEl.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX
    touchDeltaX = 0
  }, { passive: true })
  flowEl.addEventListener("touchmove", (e) => {
    touchDeltaX = e.touches[0].clientX - touchStartX
  }, { passive: true })
  flowEl.addEventListener("touchend", () => {
    if (touchDeltaX > 80 && mobileActiveCol > 0 && isMobile) {
      mobileActiveCol--
      updateMobileView("back")
    }
  })

  // Load index
  loadVerseIndex(baseUrl).then(() => {
    renderHistory(historyEl, input)

    const params = new URLSearchParams(window.location.search)
    const v = params.get("v")
    const f = params.get("f")
    if (f) {
      currentFilter = f
      if (filterSelect) filterSelect.value = f
    }
    if (v) {
      input.value = v
      runSearch(v, flowEl, countEl, baseUrl)
      // Replay chain from URL if present
      const chain = params.get("chain")
      if (chain) {
        const chainRefs = chain.split(",")
        let delay = 200
        for (const ref of chainRefs) {
          setTimeout(() => {
            const lastColIdx = flowColumns.length - 1
            if (lastColIdx < 0) return
            expandConnection(ref, lastColIdx, flowEl, baseUrl)
            requestAnimationFrame(() => requestAnimationFrame(() => drawConnectingLines(flowEl)))
          }, delay)
          delay += 300
        }
      }
    } else {
      // Show onboarding when no search query
      flowEl.insertAdjacentHTML("afterbegin", renderOnboarding())
    }
  })

  // --- Event listeners ---
  let debounceTimer: ReturnType<typeof setTimeout>

  const onInput = () => {
    clearTimeout(debounceTimer)
    updateClearBtn()
    const q = input.value.trim()
    if (q.length < 2) { closeAc(acList); return }
    debounceTimer = setTimeout(() => showAutocomplete(q, acList, input), 150)
  }

  const onKeydown = (e: KeyboardEvent) => {
    const items = acList.querySelectorAll("li")
    if (acList.classList.contains("open") && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        acIndex = Math.min(acIndex + 1, items.length - 1)
        updateAcHighlight(items)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        acIndex = Math.max(acIndex - 1, 0)
        updateAcHighlight(items)
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (acIndex >= 0 && items[acIndex]) {
          const ref = items[acIndex].dataset.ref!
          input.value = ref
          closeAc(acList)
          executeSearch(ref, flowEl, countEl, historyEl, input, baseUrl)
        } else {
          // No item highlighted — search with raw input
          const q = input.value.trim()
          closeAc(acList)
          if (q) executeSearch(q, flowEl, countEl, historyEl, input, baseUrl)
        }
        return
      } else if (e.key === "Escape") {
        closeAc(acList)
        return
      }
    } else if (e.key === "Enter") {
      const q = input.value.trim()
      closeAc(acList)
      if (q) {
        executeSearch(q, flowEl, countEl, historyEl, input, baseUrl)
      }
    } else if (e.key === "Escape") {
      input.value = ""
      closeAc(acList)
      clearFlow(flowEl)
      countEl.textContent = ""
      updateUrl("")
    }
  }

  const onFilterChange = () => {
    currentFilter = filterSelect?.value || "all"
    const q = input.value.trim()
    if (q) runSearch(q, flowEl, countEl, baseUrl)
    updateUrl(q)
  }

  const onContextChange = () => {
    globalContext = parseInt(contextSelect?.value || "0")
    // Re-fetch all expanded cards with new context
    flowEl.querySelectorAll(".vc-card.expanded").forEach((card) => {
      const el = card as HTMLElement
      el.dataset.fetched = ""
      el.dataset.context = String(globalContext)
      const refsJson = el.dataset.refs
      const refs: string[] = refsJson ? JSON.parse(refsJson) : [el.dataset.ref!]
      const fetchPromise = refs.length > 1
        ? fetchGroupedVerseContext(refs, globalContext)
        : fetchVerseWithContext(refs[0], globalContext)
      fetchPromise.then((result) => {
        const textEl = el.querySelector(".vc-verse-text") as HTMLElement
        if (!textEl) return
        if (result) {
          textEl.innerHTML = result.html
          textEl.classList.remove("vc-shimmer")
        }
      })
    })
  }

  const onPopstate = () => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get("v") || ""
    input.value = v
    if (v) runSearch(v, flowEl, countEl, baseUrl)
    else {
      clearFlow(flowEl)
      countEl.textContent = ""
    }
  }

  const onAcClick = (e: Event) => {
    const li = (e.target as HTMLElement).closest("li") as HTMLElement | null
    if (!li) return
    const ref = li.dataset.ref!
    input.value = ref
    closeAc(acList)
    executeSearch(ref, flowEl, countEl, historyEl, input, baseUrl)
  }

  const onDocClick = (e: Event) => {
    if (!(e.target as HTMLElement).closest(".vc-search-wrap")) closeAc(acList)
  }

  // Flow container delegation
  flowEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement

    // Section toggle (collapsible sections within cards)
    const sectionToggle = target.closest(".vc-section-toggle") as HTMLElement | null
    if (sectionToggle) {
      const section = sectionToggle.closest(".vc-section") as HTMLElement
      if (section) {
        if (section.hasAttribute("data-collapsed")) {
          section.removeAttribute("data-collapsed")
        } else {
          section.setAttribute("data-collapsed", "")
        }
      }
      return
    }

    // Collapse All / Expand All buttons
    const collapseAll = target.closest(".vc-collapse-all") as HTMLElement | null
    if (collapseAll) {
      const colEl = collapseAll.closest(".vc-column") as HTMLElement
      colEl?.querySelectorAll(".vc-section").forEach((s) => s.setAttribute("data-collapsed", ""))
      return
    }
    const expandAll = target.closest(".vc-expand-all") as HTMLElement | null
    if (expandAll) {
      const colEl = expandAll.closest(".vc-column") as HTMLElement
      colEl?.querySelectorAll(".vc-section").forEach((s) => s.removeAttribute("data-collapsed"))
      return
    }

    // Verse picker badge → select that specific verse and expand its connections
    const versePick = target.closest(".vc-verse-pick") as HTMLElement | null
    if (versePick) {
      const ref = versePick.dataset.ref!
      const colEl = versePick.closest(".vc-column") as HTMLElement
      const colIdx = colEl ? parseInt(colEl.dataset.colIdx || "0") : 0
      expandConnection(ref, colIdx, flowEl, baseUrl)
      updateUrl(input.value)
      requestAnimationFrame(() => drawConnectingLines(flowEl))
      return
    }

    // Connection chip → select card in next column + expand + new column
    const chip = target.closest(".vc-conn-chip") as HTMLElement | null
    if (chip) {
      const colEl = chip.closest(".vc-column") as HTMLElement
      const colIdx = colEl ? parseInt(colEl.dataset.colIdx || "0") : 0
      const chipRef = chip.dataset.ref!
      // Range chip: expand all refs in range
      const refsJson = chip.dataset.refs
      if (refsJson) {
        try {
          const refs: string[] = JSON.parse(refsJson)
          expandConnectionMulti(refs, colIdx, flowEl, baseUrl, chip.textContent?.trim() || refs[0])
        } catch { expandConnection(chipRef, colIdx, flowEl, baseUrl) }
      } else {
        expandConnection(chipRef, colIdx, flowEl, baseUrl)
      }
      // After expansion, find and select the matching card in the NEW column
      requestAnimationFrame(() => {
        const newColIdx = colIdx + 1
        if (newColIdx >= flowColumns.length) return
        const newCol = flowColumns[newColIdx]
        // Find card matching the chip's ref (or containing it in grouped data-refs)
        let matchCard: HTMLElement | null = newCol.el.querySelector(`.vc-card[data-ref="${CSS.escape(chipRef)}"]`)
        if (!matchCard) {
          newCol.el.querySelectorAll(".vc-card[data-refs]").forEach((card) => {
            if (matchCard) return
            try {
              const refs: string[] = JSON.parse((card as HTMLElement).dataset.refs || "[]")
              if (refs.includes(chipRef)) matchCard = card as HTMLElement
            } catch {}
          })
        }
        if (matchCard) {
          // Clear other selections
          newCol.el.querySelectorAll(".vc-card.vc-selected").forEach(c => c.classList.remove("vc-selected"))
          matchCard.classList.add("vc-selected")
          matchCard.classList.add("vc-just-selected")
          setTimeout(() => matchCard?.classList.remove("vc-just-selected"), 600)
          newCol.el.classList.add("vc-col-has-selection")
          newCol.selectedRef = chipRef
          // Expand the card
          if (!matchCard.classList.contains("expanded")) {
            matchCard.classList.add("expanded")
            const hdr = matchCard.querySelector(".vc-card-header") as HTMLElement
            if (hdr) hdr.setAttribute("aria-expanded", "true")
            // Trigger verse text fetch
            if (!matchCard.dataset.fetched) {
              matchCard.dataset.fetched = "1"
              const cardRefsJson = matchCard.dataset.refs
              const cardRefs: string[] = cardRefsJson ? JSON.parse(cardRefsJson) : [matchCard.dataset.ref!]
              const fetchP = cardRefs.length > 1
                ? fetchGroupedVerseContext(cardRefs, globalContext)
                : fetchVerseWithContext(cardRefs[0], globalContext)
              fetchP.then((result) => {
                const textEl = matchCard!.querySelector(".vc-verse-text") as HTMLElement
                if (!textEl) return
                if (result) {
                  textEl.innerHTML = result.html
                  textEl.classList.remove("vc-shimmer")
                }
              })
            }
          }
          // Smooth scroll to the card
          setTimeout(() => matchCard!.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }), 100)
        }
        requestAnimationFrame(() => drawConnectingLines(flowEl))
      })
      return
    }

    // Note badge → show preview on mobile (tap)
    const badge = target.closest(".vc-note-badge") as HTMLElement | null
    if (badge && isMobile) {
      toggleMobileNotePreview(badge)
      return
    }

    // Note pill / pdf pill → let <a> navigate
    if (target.closest(".vc-note-pill") || target.closest(".vc-pdf-pill")) return

    // Card selection (click on card ref area to select/deselect)
    const cardRef = target.closest(".vc-card-ref") as HTMLElement | null
    if (cardRef) {
      const card = cardRef.closest(".vc-card") as HTMLElement
      if (card) {
        const ref = card.dataset.ref!
        const colEl = card.closest(".vc-column") as HTMLElement
        const colIdx = colEl ? parseInt(colEl.dataset.colIdx || "0") : 0
        const wasSelected = card.classList.contains("vc-selected")

        // Clear all selections in the same column
        colEl?.querySelectorAll(".vc-card.vc-selected").forEach((c) => c.classList.remove("vc-selected"))

        if (!wasSelected) {
          // Select this card, auto-expand, and expand its connections
          card.classList.add("vc-selected")
          card.classList.add("vc-just-selected")
          setTimeout(() => card.classList.remove("vc-just-selected"), 600)
          if (colEl) colEl.classList.add("vc-col-has-selection")
          // Auto-expand the card
          if (!card.classList.contains("expanded")) {
            card.classList.add("expanded")
            const hdr = card.querySelector(".vc-card-header") as HTMLElement
            if (hdr) hdr.setAttribute("aria-expanded", "true")
          }
          // Fetch verse text if not already fetched
          if (!card.dataset.fetched) {
            card.dataset.fetched = "1"
            const cardRefsJson = card.dataset.refs
            const cardRefs: string[] = cardRefsJson ? JSON.parse(cardRefsJson) : [ref]
            const fetchP = cardRefs.length > 1
              ? fetchGroupedVerseContext(cardRefs, globalContext)
              : fetchVerseWithContext(cardRefs[0], globalContext)
            fetchP.then((result) => {
              const textEl = card.querySelector(".vc-verse-text") as HTMLElement
              if (!textEl) return
              if (result) {
                textEl.innerHTML = result.html
                textEl.classList.remove("vc-shimmer")
              }
            })
          }
          // For grouped cards, expand using multi-ref
          const refsJson = card.dataset.refs
          if (refsJson) {
            try {
              const refs: string[] = JSON.parse(refsJson)
              expandConnectionMulti(refs, colIdx, flowEl, baseUrl, card.querySelector(".vc-card-ref")?.textContent?.trim() || refs[0])
            } catch { expandConnection(ref, colIdx, flowEl, baseUrl) }
          } else {
            expandConnection(ref, colIdx, flowEl, baseUrl)
          }

          // Auto-scroll to show new column
          requestAnimationFrame(() => {
            const lastCol = flowColumns[flowColumns.length - 1]
            if (lastCol?.el) {
              lastCol.el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
            }
          })
        } else {
          // Deselect — remove downstream columns
          if (colEl) colEl.classList.remove("vc-col-has-selection")
          removeColumnsFrom(colIdx + 1, flowEl)
        }
        requestAnimationFrame(() => drawConnectingLines(flowEl))
        return
      }
    }

    // Card header toggle
    const header = target.closest(".vc-card-header") as HTMLElement | null
    if (header) {
      const card = header.closest(".vc-card") as HTMLElement
      const wasExpanded = card.classList.contains("expanded")
      const cardInner = card.querySelector(".vc-card-inner") as HTMLElement | null
      if (wasExpanded && cardInner) {
        // Collapsing: remove anim-done first so overflow:hidden is restored
        cardInner.classList.remove("anim-done")
      }
      card.classList.toggle("expanded")
      header.setAttribute("aria-expanded", String(!wasExpanded))
      if (!wasExpanded && cardInner) {
        // Expanding: after animation, allow overflow for scrolling
        const body = card.querySelector(".vc-card-body") as HTMLElement | null
        if (body) {
          const handler = () => {
            cardInner.classList.add("anim-done")
            body.removeEventListener("transitionend", handler)
          }
          body.addEventListener("transitionend", handler)
        }
      }
      if (!wasExpanded && !card.dataset.fetched) {
        card.dataset.fetched = "1"
        const ref = card.dataset.ref!
        const refsJson = card.dataset.refs
        const refs: string[] = refsJson ? JSON.parse(refsJson) : [ref]
        const fetchP = refs.length > 1
          ? fetchGroupedVerseContext(refs, globalContext)
          : fetchVerseWithContext(refs[0], globalContext)
        fetchP.then((result) => {
          const textEl = card.querySelector(".vc-verse-text") as HTMLElement
          if (!textEl) return
          if (result) {
            textEl.innerHTML = result.html
            textEl.classList.remove("vc-shimmer")
          } else {
            textEl.textContent = "[verse text unavailable]"
            textEl.classList.add("vc-verse-unavailable")
            textEl.classList.remove("vc-shimmer")
          }
        })
      }
    }

    // Column close button
    const closeBtn = target.closest(".vc-col-close") as HTMLElement | null
    if (closeBtn) {
      const colEl = closeBtn.closest(".vc-column") as HTMLElement
      const colIdx = parseInt(colEl?.dataset.colIdx || "0")
      removeColumnsFrom(colIdx, flowEl)
      if (isMobile) {
        mobileActiveCol = Math.max(0, colIdx - 1)
        updateMobileView("back")
      }
      return
    }

    // "Search this verse" link in empty state
    const emptyLink = target.closest(".vc-empty-link") as HTMLElement | null
    if (emptyLink) {
      const ref = emptyLink.dataset.ref!
      input.value = ref
      executeSearch(ref, flowEl, countEl, historyEl, input, baseUrl)
      return
    }

    // "Show me a real verse" button in 404 state
    const randomBtn = target.closest(".vc-nf-random") as HTMLElement | null
    if (randomBtn && verseIndex) {
      const allKeys = Object.keys(verseIndex.index)
      const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)]
      input.value = randomKey
      executeSearch(randomKey, flowEl, countEl, historyEl, input, baseUrl)
      return
    }
  })

  // Note badge hover preview (desktop only)
  let previewTimeout: ReturnType<typeof setTimeout>
  let previewHideTimeout: ReturnType<typeof setTimeout>
  flowEl.addEventListener("mouseenter", (e) => {
    if (isMobile) return
    const badge = (e.target as HTMLElement).closest(".vc-note-badge") as HTMLElement | null
    if (!badge) return
    clearTimeout(previewTimeout)
    clearTimeout(previewHideTimeout)
    previewTimeout = setTimeout(() => showNotePreview(badge), 200)
  }, true)

  flowEl.addEventListener("mouseleave", (e) => {
    if (isMobile) return
    const badge = (e.target as HTMLElement).closest(".vc-note-badge") as HTMLElement | null
    if (!badge) return
    const related = (e as MouseEvent).relatedTarget as HTMLElement | null
    const preview = document.getElementById("vc-note-preview")
    // Don't hide if moving into the preview itself
    if (related && preview && (related === preview || preview.contains(related))) return
    clearTimeout(previewTimeout)
    // Delay hide so user can move mouse to the preview
    previewHideTimeout = setTimeout(() => hideNotePreview(), 150)
  }, true)

  // Keep preview alive when mouse is over it, hide when leaving
  document.addEventListener("mouseenter", (e) => {
    const target = e.target as HTMLElement
    if (target.id === "vc-note-preview" || target.closest?.("#vc-note-preview")) {
      clearTimeout(previewHideTimeout)
    }
  }, true)
  document.addEventListener("mouseleave", (e) => {
    const target = e.target as HTMLElement
    if (target.id === "vc-note-preview" || target.closest?.("#vc-note-preview")) {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null
      if (related && related.closest?.(".vc-note-badge")) return
      if (related && (related.id === "vc-note-preview" || related.closest?.("#vc-note-preview"))) return
      previewHideTimeout = setTimeout(() => hideNotePreview(), 150)
    }
  }, true)

  // Connected verse chip hover — show rich tooltip with all shared notes
  flowEl.addEventListener("mouseenter", (e) => {
    if (isMobile) return
    const chip = (e.target as HTMLElement).closest(".vc-conn-chip") as HTMLElement | null
    if (!chip || !verseIndex) return

    const ref = chip.dataset.ref
    if (!ref) return

    // Find the parent card's (or column's) verse ref to determine shared notes
    const card = chip.closest(".vc-card") as HTMLElement | null
    const col = chip.closest(".vc-column") as HTMLElement | null
    const parentRef = card?.dataset.ref ?? col?.dataset.ref
    const parentRefs: string[] = card?.dataset.refs ? JSON.parse(card.dataset.refs) : (parentRef ? [parentRef] : [])
    const parentSlugs = new Set<string>()
    for (const pr of parentRefs) {
      for (const e of (verseIndex.index[pr] ?? [])) parentSlugs.add(e.slug)
    }

    // Find shared notes between parent verse and this connected verse
    const connEntries = verseIndex.index[ref] ?? []
    const sharedNotes = connEntries.filter(e => parentSlugs.has(e.slug))
    // Also check PDF connections
    const parentPdfs = new Set<string>()
    for (const pr of parentRefs) {
      for (const p of (verseIndex.pdfConnections?.[pr] ?? [])) parentPdfs.add(p)
    }
    const sharedPdfs = (verseIndex.pdfConnections?.[ref] ?? []).filter(p => parentPdfs.has(p))

    if (sharedNotes.length === 0 && sharedPdfs.length === 0) {
      // Set plain tooltip for next hover cycle (no race since we set it lazily)
      if (!chip.hasAttribute("data-tooltip")) {
        chip.setAttribute("data-tooltip", "Explore connections")
      }
      return
    }

    const noteLinks = sharedNotes.map(n => {
      const color = sectionColors[n.folder] ?? "#8b8b8b"
      const displayTitle = formatNoteTitle(n)
      return `<a class="tt-note-link" href="/${n.slug}"><span class="tt-note-dot" style="background:${color}"></span><span class="tt-note-name">${escHtml(displayTitle)}</span></a>`
    })
    const pdfLinks = sharedPdfs.map(p => {
      const name = p.replace(/\.pdf$/i, "")
      return `<a class="tt-note-link" href="/Books-and-PDFs#${encodeURIComponent(name)}"><span class="tt-note-dot" style="background:#e67e22"></span><span class="tt-note-name">${escHtml(name)}</span></a>`
    })

    const html = `<div class="tt-section-label">Shared in</div><div class="tt-note-list">${[...noteLinks, ...pdfLinks].join("")}</div>`

    window.__tooltip?.show(chip, "", html)
  }, true)

  flowEl.addEventListener("mouseleave", (e) => {
    if (isMobile) return
    const chip = (e.target as HTMLElement).closest(".vc-conn-chip") as HTMLElement | null
    if (!chip) return
    window.__tooltip?.hide()
  }, true)

  // Keyboard nav for cards
  flowEl.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement
    if (target.classList.contains("vc-card-header")) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        target.click()
      }
    }
  })

  // Breadcrumb click handler
  const bcEl = document.getElementById("vc-breadcrumbs")
  const onBcClick = (e: Event) => {
    const chip = (e.target as HTMLElement).closest(".vc-bc-chip") as HTMLElement | null
    if (chip) {
      const idx = parseInt(chip.dataset.colIdx || "0")
      // Trim chain to this column
      removeColumnsFrom(idx + 1, flowEl)
      // Deselect in clicked column
      const col = flowColumns[idx]
      if (col) {
        col.el.querySelectorAll(".vc-card.vc-selected").forEach(c => c.classList.remove("vc-selected"))
        col.selectedRef = null
        col.el.classList.remove("vc-col-has-selection")
      }
      // Scroll into view
      flowColumns[idx]?.el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
      requestAnimationFrame(() => drawConnectingLines(flowEl))
    }
  }
  bcEl?.addEventListener("click", onBcClick)

  input.addEventListener("input", onInput)
  input.addEventListener("keydown", onKeydown)
  acList?.addEventListener("click", onAcClick)
  document.addEventListener("click", onDocClick)
  filterSelect?.addEventListener("change", onFilterChange)
  contextSelect?.addEventListener("change", onContextChange)
  window.addEventListener("popstate", onPopstate)

  window.addCleanup?.(() => {
    input.removeEventListener("input", onInput)
    input.removeEventListener("keydown", onKeydown)
    acList?.removeEventListener("click", onAcClick)
    document.removeEventListener("click", onDocClick)
    filterSelect?.removeEventListener("change", onFilterChange)
    contextSelect?.removeEventListener("change", onContextChange)
    window.removeEventListener("popstate", onPopstate)
    bcEl?.removeEventListener("click", onBcClick)
    mq.removeEventListener("change", mqHandler)
    clearTimeout(debounceTimer)
    clearTimeout(previewTimeout)
    document.removeEventListener("nav", init)
    document.removeEventListener("nav", injectChainIcons)
  })
}

// ── Data loading ──
async function loadVerseIndex(_baseUrl: string): Promise<void> {
  if (verseIndex) return
  try {
    const [viRes, ciRes] = await Promise.all([
      fetch("/static/verseIndex.json"),
      fetch("/static/contentIndex.json"),
    ])
    verseIndex = await viRes.json()
    // Build date map from content index
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

function formatNoteTitle(entry: VerseIndexEntry): string {
  return formatNoteTitleFromSlug(entry.slug, entry.title)
}

function formatNoteTitleFromSlug(slug: string, title: string): string {
  if (slug.startsWith("Daily/")) {
    const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
    if (m) {
      const d = new Date(m[1] + "T12:00:00")
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    }
  }
  return title
}

// ── Autocomplete ──
function showAutocomplete(query: string, acList: HTMLUListElement, input: HTMLInputElement) {
  if (!verseIndex) return
  const q = query.toLowerCase()
  const keys = Object.keys(verseIndex.index)

  let matches: { ref: string; count: number }[]

  // Try to normalize the query through the alias system
  const parsed = parseSearchQuery(query)
  const normalizedPrefix = parsed ? (parsed.chapter
    ? (parsed.verse ? `${parsed.book} ${parsed.chapter}:${parsed.verse}` : `${parsed.book} ${parsed.chapter}`)
    : parsed.book) : null

  if (normalizedPrefix && normalizedPrefix.toLowerCase() !== q) {
    // Alias matched — search using normalized form
    const nq = normalizedPrefix.toLowerCase()
    if (!nq.includes(":")) {
      if (!nq.includes(" ") || !parsed?.chapter) {
        // Book-only match
        const bookSet = new Set<string>()
        matches = []
        for (const key of keys) {
          if (key.toLowerCase().startsWith(nq)) {
            const book = key.replace(/\s+\d.*/, "")
            if (!bookSet.has(book)) {
              bookSet.add(book)
              const count = keys.filter((k) => k.startsWith(book)).length
              matches.push({ ref: book, count })
            }
          }
        }
        matches = matches.slice(0, 8)
      } else {
        // Chapter match
        matches = keys
          .filter((k) => k.toLowerCase().startsWith(nq))
          .map((k) => ({ ref: k, count: verseIndex!.index[k]?.length ?? 0 }))
          .sort((a, b) => parseInt(a.ref.match(/\d+/)?.[0] ?? "0") - parseInt(b.ref.match(/\d+/)?.[0] ?? "0"))
          .slice(0, 8)
      }
    } else {
      matches = keys
        .filter((k) => k.toLowerCase().startsWith(nq))
        .map((k) => ({ ref: k, count: verseIndex!.index[k]?.length ?? 0 }))
        .sort((a, b) => parseInt(a.ref.split(":")[1] ?? "0") - parseInt(b.ref.split(":")[1] ?? "0"))
        .slice(0, 12)
    }
  } else if (!q.includes(" ")) {
    const bookSet = new Set<string>()
    matches = []
    for (const key of keys) {
      const lk = key.toLowerCase()
      if (lk.startsWith(q)) {
        const book = key.replace(/\s+\d.*/, "")
        if (!bookSet.has(book)) {
          bookSet.add(book)
          const count = keys.filter((k) => k.startsWith(book)).length
          matches.push({ ref: book, count })
        }
      }
    }
    matches = matches.slice(0, 8)
  } else if (!q.includes(":")) {
    matches = keys
      .filter((k) => k.toLowerCase().startsWith(q))
      .map((k) => ({ ref: k, count: verseIndex!.index[k]?.length ?? 0 }))
      .sort((a, b) => parseInt(a.ref.match(/\d+/)?.[0] ?? "0") - parseInt(b.ref.match(/\d+/)?.[0] ?? "0"))
      .slice(0, 8)
  } else {
    matches = keys
      .filter((k) => k.toLowerCase().startsWith(q))
      .map((k) => ({ ref: k, count: verseIndex!.index[k]?.length ?? 0 }))
      .sort((a, b) => parseInt(a.ref.split(":")[1] ?? "0") - parseInt(b.ref.split(":")[1] ?? "0"))
      .slice(0, 12)
  }

  if (matches.length === 0) { closeAc(acList); return }

  acIndex = -1
  acList.innerHTML = matches
    .map((m) => `<li data-ref="${m.ref}" role="option"><span class="ac-book">${m.ref}</span><span class="ac-count">${m.count} notes</span></li>`)
    .join("")
  acList.classList.add("open")
}

function closeAc(acList: HTMLUListElement) {
  acList.classList.remove("open")
  acList.innerHTML = ""
  acIndex = -1
}

function updateAcHighlight(items: NodeListOf<Element>) {
  items.forEach((item, i) => item.classList.toggle("active", i === acIndex))
  if (acIndex >= 0) items[acIndex]?.scrollIntoView({ block: "nearest" })
}

// ── Search ──
function executeSearch(
  query: string, flowEl: HTMLElement, countEl: HTMLElement,
  historyEl: HTMLElement, input: HTMLInputElement, baseUrl: string,
) {
  // Normalize abbreviations to canonical form for history/URL
  const parsed = parseSearchQuery(query)
  const canonical = parsed
    ? `${parsed.book}${parsed.chapter ? " " + parsed.chapter : ""}${parsed.verse ? ":" + parsed.verse : ""}${parsed.endVerse ? "-" + parsed.endVerse : ""}`
    : query
  addToHistory(canonical)
  renderHistory(historyEl, input)
  input.value = canonical
  runSearch(canonical, flowEl, countEl, baseUrl)
  updateUrl(canonical)
}

function runSearch(query: string, flowEl: HTMLElement, countEl: HTMLElement, baseUrl: string) {
  if (!verseIndex) {
    flowEl.innerHTML = renderEmpty("Loading verse index...", [])
    return
  }

  const q = query.trim()
  const matchingKeys = findMatchingVerses(q)

  if (matchingKeys.length === 0) {
    const suggestions = findSuggestions(q)
    clearFlow(flowEl)
    flowEl.innerHTML = renderEmpty(`No notes reference "${q}" yet.`, suggestions)
    countEl.textContent = ""
    return
  }

  const filtered = filterBySection(matchingKeys)

  let totalNotes = 0
  for (const key of filtered) totalNotes += (verseIndex.index[key] ?? []).filter(e => e.slug !== "_bg").length
  countEl.textContent = `${filtered.length} verse${filtered.length !== 1 ? "s" : ""} · ${totalNotes} note${totalNotes !== 1 ? "s" : ""}`

  // Build horizontal flow: Column 0 = searched verses, Column 1 = 1st-degree connections
  clearFlow(flowEl)

  // Column 0: searched verse(s)
  addColumn(flowEl, 0, null, filtered, baseUrl, q)

  // Column 1: 1st-degree connections (all co-occurring verses)
  const firstDegree = new Set<string>()
  for (const key of filtered) {
    const coVs = verseIndex.cooccurrence[key] ?? []
    for (const cv of coVs) {
      if (!filtered.includes(cv)) firstDegree.add(cv)
    }
  }
  if (firstDegree.size > 0) {
    const cappedFirst = Array.from(firstDegree).slice(0, 50)
    addColumn(flowEl, 1, filtered[0], cappedFirst, baseUrl)
  }

  // Draw connecting lines after layout settles
  requestAnimationFrame(() => requestAnimationFrame(() => drawConnectingLines(flowEl)))
}

// ── Breadcrumbs ──
function updateBreadcrumbs() {
  const bc = document.getElementById("vc-breadcrumbs")
  if (!bc) return

  if (flowColumns.length === 0) {
    bc.style.display = "none"
    return
  }

  bc.style.display = ""
  // Build labels, deduplicating consecutive identical ones
  const items: { label: string; idx: number }[] = []
  let prevLabel = ""
  for (let i = 0; i < flowColumns.length; i++) {
    const col = flowColumns[i]
    const label = col.degree === 0
      ? (col.searchLabel || col.verses[0] || "Search")
      : (col.parentRef || `Degree ${col.degree}`)
    if (label !== prevLabel) {
      items.push({ label, idx: i })
      prevLabel = label
    }
  }

  const parts: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const isActive = item.idx === flowColumns.length - 1 || i === items.length - 1
    parts.push(`<button class="vc-bc-chip pressable${isActive ? " vc-bc-active" : ""}" data-col-idx="${item.idx}" data-tooltip="Jump to column ${item.idx + 1}">${item.label}</button>`)
    if (i < items.length - 1) {
      // Show connection reason as a labeled arrow between breadcrumbs
      const nextCol = flowColumns[items[i + 1].idx]
      const viaLabel = nextCol?.connectionVia?.replace(/^via /, "") || ""
      if (viaLabel) {
        parts.push(`<span class="vc-bc-arrow"><span class="vc-bc-via-label" data-tooltip="${escHtml(nextCol!.connectionVia!)}">${escHtml(viaLabel)}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></span>`)
      } else {
        parts.push(`<span class="vc-bc-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></span>`)
      }
    }
  }
  bc.innerHTML = parts.join("")
}

// ── Flow management ──
function clearFlow(flowEl: HTMLElement) {
  // Keep the SVG overlay
  const svg = flowEl.querySelector(".vc-lines")
  flowEl.innerHTML = ""
  if (svg) flowEl.appendChild(svg)
  flowColumns = []
  updateBreadcrumbs()
  // Hide onboarding
  const onboarding = document.getElementById("vc-onboarding")
  if (onboarding) onboarding.style.display = "none"
}

// ── Mobile drill-down helpers ──

function updateMobileView(direction: "forward" | "back" = "forward") {
  if (!isMobile) {
    // Desktop: show all columns
    flowColumns.forEach(c => { c.el.style.display = ""; c.el.classList.remove("vc-mobile-slide-in", "vc-mobile-slide-back") })
    removeMobileNav()
    return
  }
  // Mobile: show only active column
  flowColumns.forEach((c, i) => {
    if (i === mobileActiveCol) {
      c.el.style.display = ""
      c.el.classList.remove("vc-mobile-slide-in", "vc-mobile-slide-back")
      // Trigger animation
      void c.el.offsetWidth // Force reflow
      c.el.classList.add(direction === "forward" ? "vc-mobile-slide-in" : "vc-mobile-slide-back")
    } else {
      c.el.style.display = "none"
      c.el.classList.remove("vc-mobile-slide-in", "vc-mobile-slide-back")
    }
  })
  updateMobileNav()
}

function updateMobileNav() {
  const flowEl = document.getElementById("vc-flow")
  if (!flowEl) return
  let navEl = document.querySelector(".vc-mobile-nav") as HTMLElement | null
  if (!isMobile || flowColumns.length === 0) {
    navEl?.remove()
    return
  }
  if (!navEl) {
    navEl = document.createElement("div")
    navEl.className = "vc-mobile-nav"
    flowEl.parentElement?.insertBefore(navEl, flowEl)
  }
  const col = flowColumns[mobileActiveCol]
  const showBack = mobileActiveCol > 0
  const prevCol = showBack ? flowColumns[mobileActiveCol - 1] : null
  const prevLabel = prevCol?.parentRef ?? prevCol?.searchLabel ?? ""
  const currentLabel = col.parentRef
    ? col.parentRef
    : col.searchLabel ?? "Results"

  navEl.innerHTML = `
    ${showBack ? `<button class="vc-mobile-back pressable">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      ${escHtml(prevLabel)}
    </button>` : ""}
    <span class="vc-mobile-nav-title">${escHtml(currentLabel)}</span>
    ${col.degree > 0 ? `<span class="vc-mobile-depth-pill">Depth ${col.degree}</span>` : ""}
  `
  // Back button handler
  const backBtn = navEl.querySelector(".vc-mobile-back")
  backBtn?.addEventListener("click", () => {
    if (mobileActiveCol > 0) {
      mobileActiveCol--
      updateMobileView("back")
    }
  })
}

function removeMobileNav() {
  document.querySelector(".vc-mobile-nav")?.remove()
}

function addColumn(
  flowEl: HTMLElement, degree: number, parentRef: string | null,
  verses: string[], baseUrl: string, searchQuery?: string, connectionVia?: string,
) {
  if (!verseIndex) return

  const col = document.createElement("div")
  col.className = "vc-column"
  col.dataset.colIdx = String(flowColumns.length)
  col.dataset.degree = String(degree)
  if (parentRef) col.dataset.ref = parentRef

  let headerLabel: string
  if (degree === 0) {
    headerLabel = searchQuery || "Search Results"
  } else if (parentRef) {
    headerLabel = `Connected to ${parentRef}`
  } else {
    headerLabel = `${degree}${degree === 1 ? "st" : degree === 2 ? "nd" : degree === 3 ? "rd" : "th"} Degree`
  }

  const showClose = degree > 0

  // Build via pill for connected columns — shown inside column header
  let viaPillHtml = ""
  if (connectionVia && parentRef && verseIndex) {
    const parentEntries = verseIndex.index[parentRef] ?? []
    const firstEntry = parentEntries[0]
    const noteLink = firstEntry ? `/${firstEntry.slug}` : ""
    const viaText = connectionVia.replace(/^via /, "")
    viaPillHtml = noteLink
      ? `<a class="internal vc-via-pill" href="${noteLink}" data-tooltip="Both verses are referenced in this note">🔗 via ${escHtml(viaText)}</a>`
      : `<span class="vc-via-pill" data-tooltip="Both verses are referenced in this note">🔗 via ${escHtml(viaText)}</span>`
  }

  col.innerHTML = `
    <div class="vc-col-header">
      <div class="vc-col-header-top">
        <span class="vc-col-degree">${headerLabel}</span>
        <span class="vc-col-count" data-tooltip="${verses.length} verse${verses.length !== 1 ? "s" : ""} in this column">${verses.length} verse${verses.length !== 1 ? "s" : ""}</span>
        <span class="vc-col-actions">
          <button class="vc-expand-all pressable" data-tooltip="Expand all sections">+</button>
          <button class="vc-collapse-all pressable" data-tooltip="Collapse all sections">−</button>
          ${showClose ? '<button class="vc-col-close pressable" data-tooltip="Close column">&times;</button>' : ""}
        </span>
      </div>
      ${viaPillHtml}
    </div>
    <div class="vc-col-cards">
      ${renderColumnCards(verses, baseUrl, degree)}
    </div>
  `

  flowEl.appendChild(col)

  flowColumns.push({ degree, parentRef, verses, el: col, selectedRef: null, searchLabel: searchQuery, connectionVia })

  // Column depth gradient (Phase 7C)
  col.style.setProperty("--depth", String(degree))

  // Animate column entrance
  col.style.animation = "colSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both"

  // Flash header as attention cue for new columns (Phase 7F)
  if (degree > 0) {
    const header = col.querySelector(".vc-col-header") as HTMLElement
    if (header) {
      header.classList.add("vc-header-flash")
      setTimeout(() => header.classList.remove("vc-header-flash"), 800)
    }
  }

  // Auto-expand verse text when column has only 1 card (Phase 7F)
  if (verses.length === 1) {
    const textSection = col.querySelector('.vc-section[data-section="text"]')
    if (textSection) textSection.removeAttribute("data-collapsed")
  }

  // Update breadcrumbs
  updateBreadcrumbs()

  // Mobile drill-down: show only the new column
  if (isMobile) {
    mobileActiveCol = flowColumns.length - 1
    updateMobileView("forward")
  } else if (degree > 0) {
    // Desktop: scroll to new column
    setTimeout(() => col.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" }), 100)
  }
}

function getConnectionVia(parentRef: string): string {
  if (!verseIndex) return ""
  const parentNotes = verseIndex.index[parentRef] ?? []
  if (parentNotes.length === 0) return ""
  const firstName = formatNoteTitle(parentNotes[0])
  const extra = parentNotes.length > 1 ? ` +${parentNotes.length - 1}` : ""
  return `via ${firstName}${extra}`
}

function expandConnection(ref: string, fromColIdx: number, flowEl: HTMLElement, baseUrl: string) {
  if (!verseIndex) return

  // Remove any columns after fromColIdx
  removeColumnsFrom(fromColIdx + 1, flowEl)

  // Get connections for this verse
  const coVs = (verseIndex.cooccurrence[ref] ?? []).slice(0, 50)
  if (coVs.length === 0) return

  const degree = (flowColumns[fromColIdx]?.degree ?? 0) + 1
  const viaInfo = getConnectionVia(ref)
  addColumn(flowEl, degree, ref, coVs, baseUrl, undefined, viaInfo)

  requestAnimationFrame(() => requestAnimationFrame(() => drawConnectingLines(flowEl)))
}

function expandConnectionMulti(refs: string[], fromColIdx: number, flowEl: HTMLElement, baseUrl: string, rangeLabel: string) {
  if (!verseIndex || refs.length === 0) return

  removeColumnsFrom(fromColIdx + 1, flowEl)

  // Gather all unique connections from all refs in the range
  const allConns = new Set<string>()
  for (const ref of refs) {
    const coVs = verseIndex.cooccurrence[ref] ?? []
    for (const v of coVs) {
      // Don't include refs that are part of the source range
      if (!refs.includes(v)) allConns.add(v)
    }
  }

  const connList = Array.from(allConns).slice(0, 50)
  if (connList.length === 0) return

  const degree = (flowColumns[fromColIdx]?.degree ?? 0) + 1
  const viaInfo = getConnectionVia(refs[0])
  addColumn(flowEl, degree, rangeLabel, connList, baseUrl, undefined, viaInfo)

  requestAnimationFrame(() => requestAnimationFrame(() => drawConnectingLines(flowEl)))
}

function removeColumnsFrom(startIdx: number, flowEl: HTMLElement) {
  for (let i = flowColumns.length - 1; i >= startIdx; i--) {
    const col = flowColumns[i]
    col.el.style.animation = "colSlideOut 0.25s ease forwards"
    const elRef = col.el
    setTimeout(() => elRef.remove(), 250)
  }
  flowColumns = flowColumns.slice(0, startIdx)
  requestAnimationFrame(() => drawConnectingLines(flowEl))
  updateBreadcrumbs()
}

// ── Column card rendering (groups same-chapter verses) ──
function renderColumnCards(verses: string[], baseUrl: string, degree: number): string {
  const groups = consolidateRanges(verses)
  return groups.map((g, i) => {
    if (g.refs.length === 1) {
      return renderVerseCard(g.refs[0], baseUrl, degree, i)
    }
    return renderGroupedCard(g, baseUrl, degree, i)
  }).join("")
}

function renderGroupedCard(group: RangeGroup, baseUrl: string, degree: number, index: number): string {
  if (!verseIndex) return ""

  // Aggregate entries from all refs in the group
  const allEntries: VerseIndexEntry[] = []
  const seenSlugs = new Set<string>()
  const allCoVs = new Set<string>()
  const groupRefSet = new Set(group.refs)
  let groupHasBg = false

  for (const ref of group.refs) {
    if ((verseIndex.index[ref] ?? []).some(e => e.slug === "_bg")) groupHasBg = true
    let entries = (verseIndex.index[ref] ?? []).filter(e => e.slug !== "_bg")
    if (currentFilter !== "all") entries = entries.filter(e => e.folder === currentFilter)
    for (const e of entries) {
      if (!seenSlugs.has(e.slug)) {
        seenSlugs.add(e.slug)
        allEntries.push(e)
      }
    }
    const coVs = verseIndex.cooccurrence[ref] ?? []
    for (const v of coVs) {
      if (!groupRefSet.has(v)) allCoVs.add(v)
    }
  }

  const noteCount = allEntries.length
  const coVsList = Array.from(allCoVs).slice(0, 50)
  const bgConnCount = groupHasBg ? coVsList.length : 0
  const isSearched = degree === 0

  const notePills = allEntries
    .map((e) => {
      const href = `/${e.slug}`
      const label = sectionLabels[e.folder] ?? e.folder
      const dateStr = contentDates[e.slug]
      const isDaily = e.slug.startsWith("Daily/")
      const displayTitle = formatNoteTitle(e)
      const dateLabel = dateStr && !isDaily ? ` · ${relativeDate(dateStr)}` : ""
      const datePill = dateStr && !isDaily ? `<span class="vc-pill-date">${relativeDate(dateStr)}</span>` : ""
      return `<a class="vc-note-pill" data-section="${e.folder}" href="${href}" data-tooltip="${label}${dateLabel}">${escHtml(displayTitle)}${datePill}</a>`
    })
    .join("")

  // Connected chips (excluding refs in this group)
  const myNoteSlugs = new Set(allEntries.map(e => e.slug))
  const rangeGroups = consolidateRanges(coVsList)
  const connChips = rangeGroups
    .map((g) => {
      const refsAttr = g.refs.length > 1 ? ` data-refs='${JSON.stringify(g.refs)}'` : ""
      const firstRef = g.refs[0]
      let tooltip = "Explore connections"
      const connEntries = verseIndex!.index[firstRef] ?? []
      const sharedNotes = connEntries.filter(e => myNoteSlugs.has(e.slug))
      if (sharedNotes.length > 0) {
        const noteNames = sharedNotes.map(e => formatNoteTitle(e))
        if (noteNames.length <= 5) {
          tooltip = `Shared in: ${noteNames.join(", ")}`
        } else {
          tooltip = `Shared in: ${noteNames.slice(0, 4).join(", ")} +${noteNames.length - 4} more`
        }
      }
      return `<button class="vc-conn-chip pressable" data-ref="${firstRef}"${refsAttr}>${g.label}</button>`
    })
    .join("")

  const pdfs: string[] = []
  for (const ref of group.refs) {
    const p = verseIndex.pdfConnections?.[ref] ?? []
    for (const pdf of p) if (!pdfs.includes(pdf)) pdfs.push(pdf)
  }
  const pdfPills = pdfs
    .map((pdf) => {
      const name = pdf.replace(/\.pdf$/i, "")
      const href = `/Books-and-PDFs#${encodeURIComponent(name)}`
      return `<a class="vc-pdf-pill" href="${href}" data-tooltip="View PDF">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${escHtml(name)}
      </a>`
    })
    .join("")

  const noteBadge = noteCount > 0
    ? `<span class="vc-note-badge" data-tooltip="${noteCount} note${noteCount !== 1 ? "s" : ""} reference this verse" data-entries='${JSON.stringify(allEntries.map(e => ({ title: e.title, slug: e.slug, folder: e.folder })))}'>${noteCount} note${noteCount !== 1 ? "s" : ""}</span>`
    : bgConnCount > 0
      ? `<span class="vc-note-badge bg-only" data-tooltip="No user notes yet — ${bgConnCount} BibleGateway cross-references">0 notes</span>`
      : `<span class="vc-note-badge empty" data-tooltip="No notes reference this verse">0 notes</span>`
  const bgBadge = groupHasBg
    ? `<span class="vc-bg-badge" data-tooltip="${bgConnCount} BibleGateway cross-reference${bgConnCount !== 1 ? "s" : ""}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>BG</span>`
    : ""

  const connCount = coVsList.length
  const connLabel = connCount > 0 ? `→ ${connCount} connections` : ""

  const textSection = `<div class="vc-section" data-section="text">
    <button class="vc-section-toggle"><span>Verse Text (${group.refs.length} verses)</span><span class="vc-chevron">›</span></button>
    <div class="vc-section-body"><div class="vc-section-inner"><div class="vc-verse-text vc-shimmer">&nbsp;</div></div></div>
  </div>`

  const hasNotes = notePills.length > 0 || pdfPills.length > 0
  const notesSection = hasNotes ? `<div class="vc-section" data-section="notes" data-collapsed>
    <button class="vc-section-toggle"><span>Notes${noteCount > 0 ? ` (${noteCount})` : ""}${pdfs.length > 0 ? ` · ${pdfs.length} PDF${pdfs.length !== 1 ? "s" : ""}` : ""}</span><span class="vc-chevron">›</span></button>
    <div class="vc-section-body"><div class="vc-section-inner">
      ${notePills ? `<div class="vc-note-pills">${notePills}</div>` : ""}
      ${pdfPills ? `<div class="vc-pdf-pills">${pdfPills}</div>` : ""}
    </div></div>
  </div>` : ""

  const connSection = connChips ? `<div class="vc-section" data-section="connections" data-collapsed>
    <button class="vc-section-toggle"><span>Connected Verses (${connCount})</span><span class="vc-chevron">›</span></button>
    <div class="vc-section-body"><div class="vc-section-inner">
      <div class="vc-connected-chips">${connChips}</div>
    </div></div>
  </div>` : ""

  // Verse picker — individual verse badges for selecting specific verses from the range
  const versePicker = group.refs.length > 1
    ? `<div class="vc-verse-picker">${group.refs.map(r => {
        const vNum = r.match(/:(\d+)$/)?.[1] ?? r
        return `<button class="vc-verse-pick pressable" data-ref="${r}" data-tooltip="Explore connections for ${r}">v${vNum}</button>`
      }).join("")}</div>`
    : ""

  return `<div class="vc-card ${isSearched ? "vc-card-primary" : ""}" data-ref="${group.refs[0]}" data-refs='${JSON.stringify(group.refs)}' style="--card-index: ${index}">
    <div class="vc-card-header" role="button" tabindex="0" aria-expanded="false">
      <span class="vc-card-ref">${group.label}</span>
      <span class="vc-card-badges">
        ${noteBadge}
        ${bgBadge}
        ${connLabel ? `<span class="vc-conn-count" data-tooltip="${connCount} connected verse${connCount !== 1 ? "s" : ""} found">${connLabel}</span>` : ""}
      </span>
    </div>
    ${versePicker}
    <div class="vc-card-body">
      <div class="vc-card-inner">
        ${textSection}
        ${notesSection}
        ${connSection}
      </div>
    </div>
  </div>`
}

// ── Verse card rendering (single verse) ──
function renderVerseCard(verseKey: string, baseUrl: string, degree: number, index: number): string {
  if (!verseIndex) return ""
  const hasBg = (verseIndex.index[verseKey] ?? []).some(e => e.slug === "_bg")
  let entries = (verseIndex.index[verseKey] ?? []).filter((e) => e.slug !== "_bg")
  if (currentFilter !== "all") entries = entries.filter((e) => e.folder === currentFilter)

  const noteCount = entries.length
  const coVs = (verseIndex.cooccurrence[verseKey] ?? []).slice(0, 50)
  const bgConnCount = hasBg ? coVs.length : 0
  const isSearched = degree === 0

  const notePills = entries
    .map((e) => {
      const href = `/${e.slug}`
      const label = sectionLabels[e.folder] ?? e.folder
      const dateStr = contentDates[e.slug]
      const isDaily = e.slug.startsWith("Daily/")
      const displayTitle = formatNoteTitle(e)
      const dateLabel = dateStr && !isDaily ? ` · ${relativeDate(dateStr)}` : ""
      const datePill = dateStr && !isDaily ? `<span class="vc-pill-date">${relativeDate(dateStr)}</span>` : ""
      return `<a class="vc-note-pill" data-section="${e.folder}" href="${href}" data-tooltip="${label}${dateLabel}">${escHtml(displayTitle)}${datePill}</a>`
    })
    .join("")

  // Consolidate consecutive verses into ranges
  const rangeGroups = consolidateRanges(coVs)
  // "Why Connected" — build tooltip with shared note info
  const myNoteSlugs = new Set((verseIndex.index[verseKey] ?? []).filter(e => e.slug !== "_bg").map(e => e.slug))
  const connChips = rangeGroups
    .map((g) => {
      const refsAttr = g.refs.length > 1 ? ` data-refs='${JSON.stringify(g.refs)}'` : ""
      const firstRef = g.refs[0]
      // Build tooltip with all shared note names
      let tooltip = "Explore connections"
      const connEntries = verseIndex!.index[firstRef] ?? []
      const sharedNotes = connEntries.filter(e => myNoteSlugs.has(e.slug))
      const myPdfs = new Set(verseIndex!.pdfConnections?.[verseKey] ?? [])
      const connPdfs = (verseIndex!.pdfConnections?.[firstRef] ?? []).filter(p => myPdfs.has(p))
      const allNames: string[] = [
        ...sharedNotes.map(e => formatNoteTitle(e)),
        ...connPdfs.map(p => p.replace(/\.pdf$/i, "")),
      ]
      if (allNames.length > 0) {
        if (allNames.length <= 5) {
          tooltip = `Shared in: ${allNames.join(", ")}`
        } else {
          tooltip = `Shared in: ${allNames.slice(0, 4).join(", ")} +${allNames.length - 4} more`
        }
      }
      return `<button class="vc-conn-chip pressable" data-ref="${firstRef}"${refsAttr}>${g.label}</button>`
    })
    .join("")

  // PDF connections
  const pdfs = verseIndex.pdfConnections?.[verseKey] ?? []
  const pdfPills = pdfs
    .map((pdf) => {
      const name = pdf.replace(/\.pdf$/i, "")
      const href = `/Books-and-PDFs#${encodeURIComponent(name)}`
      return `<a class="vc-pdf-pill" href="${href}" data-tooltip="View PDF">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${escHtml(name)}
      </a>`
    })
    .join("")

  const noteBadge = noteCount > 0
    ? `<span class="vc-note-badge" data-tooltip="${noteCount} note${noteCount !== 1 ? "s" : ""} reference this verse" data-entries='${JSON.stringify(entries.map(e => ({ title: e.title, slug: e.slug, folder: e.folder })))}'>${noteCount} note${noteCount !== 1 ? "s" : ""}</span>`
    : bgConnCount > 0
      ? `<span class="vc-note-badge bg-only" data-tooltip="No user notes yet — ${bgConnCount} BibleGateway cross-references">0 notes</span>`
      : `<span class="vc-note-badge empty" data-tooltip="No notes reference this verse">0 notes</span>`
  const bgBadge = hasBg
    ? `<span class="vc-bg-badge" data-tooltip="${bgConnCount} BibleGateway cross-reference${bgConnCount !== 1 ? "s" : ""}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>BG</span>`
    : ""

  const connCount = coVs.length
  const connLabel = connCount > 0 ? `→ ${connCount} connections` : ""

  // Connection strength info
  const strength = verseIndex.connectionStrength
  const strengthBadge = (parentVerse: string | null, v: string) => {
    if (!parentVerse || !strength?.[parentVerse]?.[v]) return ""
    const s = strength[parentVerse][v]
    return ` <span class="vc-strength" data-tooltip="${s} shared note${s !== 1 ? "s" : ""}">${s}</span>`
  }

  // Build collapsible sections
  const textSection = `<div class="vc-section" data-section="text">
    <button class="vc-section-toggle"><span>Verse Text</span><span class="vc-chevron">›</span></button>
    <div class="vc-section-body"><div class="vc-section-inner"><div class="vc-verse-text vc-shimmer">&nbsp;</div></div></div>
  </div>`

  const hasNotes = notePills.length > 0 || pdfPills.length > 0
  const notesSection = hasNotes ? `<div class="vc-section" data-section="notes" data-collapsed>
    <button class="vc-section-toggle"><span>Notes${noteCount > 0 ? ` (${noteCount})` : ""}${pdfs.length > 0 ? ` · ${pdfs.length} PDF${pdfs.length !== 1 ? "s" : ""}` : ""}</span><span class="vc-chevron">›</span></button>
    <div class="vc-section-body"><div class="vc-section-inner">
      ${notePills ? `<div class="vc-note-pills">${notePills}</div>` : ""}
      ${pdfPills ? `<div class="vc-pdf-pills">${pdfPills}</div>` : ""}
    </div></div>
  </div>` : ""

  const connSection = connChips ? `<div class="vc-section" data-section="connections" data-collapsed>
    <button class="vc-section-toggle"><span>Connected Verses (${connCount})</span><span class="vc-chevron">›</span></button>
    <div class="vc-section-body"><div class="vc-section-inner">
      <div class="vc-connected-chips">${connChips}</div>
    </div></div>
  </div>` : ""

  return `<div class="vc-card ${isSearched ? "vc-card-primary" : ""}" data-ref="${verseKey}" style="--card-index: ${index}">
    <div class="vc-card-header" role="button" tabindex="0" aria-expanded="false">
      <span class="vc-card-ref">${verseKey}</span>
      <span class="vc-card-badges">
        ${noteBadge}
        ${bgBadge}
        ${connLabel ? `<span class="vc-conn-count" data-tooltip="${connCount} connected verse${connCount !== 1 ? "s" : ""} found">${connLabel}</span>` : ""}
      </span>
    </div>
    <div class="vc-card-body">
      <div class="vc-card-inner">
        ${textSection}
        ${notesSection}
        ${connSection}
      </div>
    </div>
  </div>`
}

const VERSE_NOT_FOUND_MESSAGES = [
  "Even Solomon in all his wisdom couldn't find that verse",
  "This verse has been raptured",
  "Looks like this scroll was lost in the Dead Sea",
  "The scribes seem to have missed this one",
  "Not even the Bereans could find this reference",
  "This must be from the book of Hezekiah... which doesn't exist",
  "404: Verse not found. Have you tried the Apocrypha?",
  "The ink has faded from this part of the scroll",
  "This verse is still being written... just kidding",
  "Perhaps you're thinking of a different testament?",
  "We searched every scroll in the library of Alexandria",
  "This verse went the way of the Ark of the Covenant",
]

function renderEmpty(message: string, suggestions: string[]): string {
  const isNotFound = message.includes("No notes reference") || message.includes("not found")

  if (isNotFound && suggestions.length === 0) {
    // Fun 404-style message with animated scroll illustration
    const msg = VERSE_NOT_FOUND_MESSAGES[Math.floor(Math.random() * VERSE_NOT_FOUND_MESSAGES.length)]
    return `<div class="vc-empty vc-not-found">
      <div class="vc-nf-scroll">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <line x1="9" y1="7" x2="15" y2="7" opacity="0.3"/>
          <line x1="9" y1="10" x2="13" y2="10" opacity="0.2"/>
        </svg>
        <span class="vc-nf-question">?</span>
      </div>
      <div class="vc-nf-message">${escHtml(msg)}</div>
      <button class="vc-nf-random pressable" data-tooltip="Show a random real verse instead">Show me a real verse instead</button>
    </div>`
  }

  const iconSvg = `<svg class="vc-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`
  const suggHtml = suggestions.length
    ? `<div class="vc-empty-suggestion">Try: ${suggestions.map((s) => `<button class="vc-empty-link" data-ref="${s}">${s}</button>`).join(" · ")}</div>`
    : ""
  return `<div class="vc-empty">${iconSvg}<div class="vc-empty-title">${message}</div>${suggHtml}</div>`
}

function renderOnboarding(): string {
  return `<div class="vc-onboarding" id="vc-onboarding">
    <div class="vc-onboarding-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </div>
    <div class="vc-onboarding-text">Search any verse to explore connections across your study notes</div>
    <div class="vc-onboarding-steps">
      <div class="vc-onboarding-step"><span class="vc-onboarding-num">1</span> Search a verse to see which notes reference it</div>
      <div class="vc-onboarding-step"><span class="vc-onboarding-num">2</span> Click connected verses to explore deeper</div>
      <div class="vc-onboarding-step"><span class="vc-onboarding-num">3</span> Use the context slider to see surrounding text</div>
    </div>
    <div class="vc-onboarding-examples">Try: <button class="vc-empty-link" data-ref="John 3:16">John 3:16</button> <button class="vc-empty-link" data-ref="Psalm 23:1">Psalm 23:1</button> <button class="vc-empty-link" data-ref="Isaiah 53:5">Isaiah 53:5</button> <button class="vc-empty-link" data-ref="Romans 8:28">Romans 8:28</button></div>
  </div>`
}

// ── Connecting lines (SVG) ──
function drawConnectingLines(_flowEl: HTMLElement) {
  // Connection lines removed — connection info shown in column header via pill
}

// ── Verse text with context ──
interface VerseResult {
  html: string
  mainText: string
}

async function fetchVerseWithContext(ref: string, contextCount: number): Promise<VerseResult | null> {
  // Parse ref: "John 3:16" → book="John", chapter=3, verse=16
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/)
  if (!match) {
    const text = await fetchVerseText(ref)
    return text ? { html: `<div class="vc-verse-line vc-main-verse"><span class="vc-verse-content">${escHtml(text)}</span></div>`, mainText: text } : null
  }

  const [, book, ch, vs] = match
  const verseNum = parseInt(vs)

  if (contextCount === 0) {
    const text = await fetchVerseText(ref)
    if (!text) return null
    const vNum = vs
    return { html: `<div class="vc-verse-line vc-main-verse"><span class="vc-verse-num" data-tooltip="Verse ${vNum}">${vNum}</span><span class="vc-verse-content">${escHtml(text)}</span></div>`, mainText: text }
  }

  // Full chapter mode
  if (contextCount === -1) {
    try {
      const chapterRef = `${book} ${ch}`
      const apiRef = chapterRef.replace(/\s+/g, "+").toLowerCase()
      const res = await fetch(`https://bible-api.com/${apiRef}?translation=kjv`)
      if (!res.ok) return null
      const data = await res.json()
      if (data.verses && Array.isArray(data.verses)) {
        let mainText = ""
        const html = data.verses.map((v: any) => {
          const isMain = v.verse === verseNum
          const cls = isMain ? "vc-verse-line vc-main-verse" : "vc-verse-line vc-context-verse"
          if (isMain) mainText = v.text?.trim() ?? ""
          const ctxRef = `${book} ${ch}:${v.verse}`
          const isConnected = verseIndex?.cooccurrence[ref]?.includes(ctxRef)
          const connCls = isConnected ? " vc-connected-context" : ""
          return `<div class="${cls}${connCls}"><span class="vc-verse-num" data-tooltip="Verse ${v.verse}">${v.verse}</span><span class="vc-verse-content">${escHtml(v.text?.trim() ?? "")}</span></div>`
        }).join("")
        if (mainText) saveVerseToCache(ref, mainText)
        return { html: `<div class="vc-chapter-view">${html}</div>`, mainText }
      }
      return null
    } catch { return null }
  }

  // Fetch range
  const startV = Math.max(1, verseNum - contextCount)
  const endV = verseNum + contextCount
  const rangeRef = `${book} ${ch}:${startV}-${endV}`

  try {
    const apiRef = rangeRef.replace(/\s+/g, "+").toLowerCase()
    const res = await fetch(`https://bible-api.com/${apiRef}?translation=kjv`)
    if (!res.ok) return null
    const data = await res.json()

    if (data.verses && Array.isArray(data.verses)) {
      let mainText = ""
      const html = data.verses.map((v: any) => {
        const isMain = v.verse === verseNum
        const cls = isMain ? "vc-verse-line vc-main-verse" : "vc-verse-line vc-context-verse"
        if (isMain) mainText = v.text?.trim() ?? ""
        const ctxRef = `${book} ${ch}:${v.verse}`
        const isConnected = verseIndex?.cooccurrence[ref]?.includes(ctxRef)
        const connCls = isConnected ? " vc-connected-context" : ""
        return `<div class="${cls}${connCls}"><span class="vc-verse-num" data-tooltip="Verse ${v.verse}">${v.verse}</span><span class="vc-verse-content">${escHtml(v.text?.trim() ?? "")}</span></div>`
      }).join("")

      if (mainText) saveVerseToCache(ref, mainText)
      return { html, mainText }
    }

    const text = data.text?.trim() ?? null
    if (text) {
      saveVerseToCache(ref, text)
      return { html: `<span class="vc-main-verse">${escHtml(text)}</span>`, mainText: text }
    }
    return null
  } catch {
    return null
  }
}

// Grouped verse context — merges overlapping ranges, deduplicates, adds gap markers
async function fetchGroupedVerseContext(refs: string[], contextCount: number): Promise<VerseResult | null> {
  if (refs.length === 0) return null
  if (refs.length === 1) return fetchVerseWithContext(refs[0], contextCount)

  // Parse all refs — all should share same book+chapter
  const parsed = refs.map(r => {
    const m = r.match(/^(.+?)\s+(\d+):(\d+)$/)
    return m ? { book: m[1], ch: m[2], verse: parseInt(m[3]) } : null
  }).filter(Boolean) as { book: string; ch: string; verse: number }[]
  if (parsed.length === 0) return null

  const { book, ch } = parsed[0]
  const mainVerses = new Set(parsed.map(p => p.verse))

  // Full chapter mode
  if (contextCount === -1) {
    try {
      const apiRef = `${book} ${ch}`.replace(/\s+/g, "+").toLowerCase()
      const res = await fetch(`https://bible-api.com/${apiRef}?translation=kjv`)
      if (!res.ok) return null
      const data = await res.json()
      if (!data.verses || !Array.isArray(data.verses)) return null
      let mainText = ""
      const html = data.verses.map((v: any) => {
        const isMain = mainVerses.has(v.verse)
        const cls = isMain ? "vc-verse-line vc-main-verse" : "vc-verse-line vc-context-verse"
        if (isMain && !mainText) mainText = v.text?.trim() ?? ""
        return `<div class="${cls}"><span class="vc-verse-num" data-tooltip="Verse ${v.verse}">${v.verse}</span><span class="vc-verse-content">${escHtml(v.text?.trim() ?? "")}</span></div>`
      }).join("")
      return { html: `<div class="vc-chapter-view">${html}</div>`, mainText }
    } catch { return null }
  }

  // context=0: just show the main verses, no context
  if (contextCount === 0) {
    const results = await Promise.all(refs.map(r => fetchVerseWithContext(r, 0)))
    const htmlParts = results.filter(Boolean).map(r => r!.html)
    const mainText = results.find(r => r?.mainText)?.mainText ?? ""
    return htmlParts.length > 0 ? { html: htmlParts.join(""), mainText } : null
  }

  // Build merged intervals from all refs ± context
  const intervals: [number, number][] = parsed.map(p => [
    Math.max(1, p.verse - contextCount),
    p.verse + contextCount
  ])
  // Sort by start
  intervals.sort((a, b) => a[0] - b[0])
  // Merge overlapping/adjacent intervals
  const merged: [number, number][] = [intervals[0]]
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1]
    if (intervals[i][0] <= last[1] + 1) {
      last[1] = Math.max(last[1], intervals[i][1])
    } else {
      merged.push(intervals[i])
    }
  }

  // Fetch all intervals in parallel
  try {
    const fetches = merged.map(async ([start, end]) => {
      const rangeRef = `${book} ${ch}:${start}-${end}`
      const apiRef = rangeRef.replace(/\s+/g, "+").toLowerCase()
      const res = await fetch(`https://bible-api.com/${apiRef}?translation=kjv`)
      if (!res.ok) return null
      const data = await res.json()
      return data.verses && Array.isArray(data.verses) ? data.verses : null
    })
    const results = await Promise.all(fetches)

    let mainText = ""
    const htmlBlocks: string[] = []

    for (let i = 0; i < results.length; i++) {
      const verses = results[i]
      if (!verses) continue

      // Add gap marker between non-contiguous intervals
      if (i > 0 && htmlBlocks.length > 0) {
        const prevEnd = merged[i - 1][1]
        const currStart = merged[i][0]
        const gapStart = prevEnd + 1
        const gapEnd = currStart - 1
        if (gapEnd >= gapStart) {
          const gapLabel = gapStart === gapEnd ? `v. ${gapStart}` : `vv. ${gapStart}–${gapEnd}`
          htmlBlocks.push(`<div class="vc-verse-gap">⋯ ${gapLabel} omitted</div>`)
        }
      }

      for (const v of verses) {
        const isMain = mainVerses.has(v.verse)
        const cls = isMain ? "vc-verse-line vc-main-verse" : "vc-verse-line vc-context-verse"
        if (isMain && !mainText) mainText = v.text?.trim() ?? ""
        if (isMain) saveVerseToCache(`${book} ${ch}:${v.verse}`, v.text?.trim() ?? "")
        const ctxRef = `${book} ${ch}:${v.verse}`
        const isConnected = refs.some(r => verseIndex?.cooccurrence[r]?.includes(ctxRef))
        const connCls = isConnected && !isMain ? " vc-connected-context" : ""
        htmlBlocks.push(`<div class="${cls}${connCls}"><span class="vc-verse-num" data-tooltip="Verse ${v.verse}">${v.verse}</span><span class="vc-verse-content">${escHtml(v.text?.trim() ?? "")}</span></div>`)
      }
    }

    return htmlBlocks.length > 0 ? { html: htmlBlocks.join(""), mainText } : null
  } catch { return null }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// ── Note preview (desktop hover) ──
function showNotePreview(badge: HTMLElement) {
  const preview = document.getElementById("vc-note-preview")
  if (!preview) return

  let entries: { title: string; slug: string; folder: string }[]
  try { entries = JSON.parse(badge.dataset.entries || "[]") } catch { return }
  if (entries.length === 0) return

  preview.innerHTML = entries.map((e) => {
    const color = sectionColors[e.folder] ?? "#8b8b8b"
    const label = sectionLabels[e.folder] ?? e.folder
    const displayTitle = formatNoteTitleFromSlug(e.slug, e.title)
    return `<a class="vc-preview-item" href="/${e.slug}">
      <span class="vc-preview-dot" style="background:${color}"></span>
      <span class="vc-preview-title">${escHtml(displayTitle)}</span>
      <span class="vc-preview-label">${label}</span>
    </a>`
  }).join("")

  // Position near badge
  const rect = badge.getBoundingClientRect()
  preview.style.left = rect.left + "px"
  preview.style.top = (rect.bottom + 8) + "px"
  preview.classList.add("visible")
}

function hideNotePreview() {
  const preview = document.getElementById("vc-note-preview")
  if (preview) preview.classList.remove("visible")
}

function toggleMobileNotePreview(badge: HTMLElement) {
  const card = badge.closest(".vc-card") as HTMLElement
  if (!card) return
  const existing = card.querySelector(".vc-mobile-notes")
  if (existing) { existing.remove(); return }

  let entries: { title: string; slug: string; folder: string }[]
  try { entries = JSON.parse(badge.dataset.entries || "[]") } catch { return }
  if (entries.length === 0) return

  const div = document.createElement("div")
  div.className = "vc-mobile-notes"
  div.innerHTML = entries.map((e) => {
    const color = sectionColors[e.folder] ?? "#8b8b8b"
    return `<a class="vc-mobile-note-link" href="/${e.slug}">
      <span class="vc-preview-dot" style="background:${color}"></span>
      ${escHtml(formatNoteTitleFromSlug(e.slug, e.title))}
    </a>`
  }).join("")

  badge.parentElement?.after(div)
}

// ── Verse text cache ──
async function fetchVerseText(ref: string): Promise<string | null> {
  const cached = getVerseFromCache(ref)
  if (cached) return cached
  try {
    const apiRef = ref.replace(/\s+/g, "+").toLowerCase()
    const res = await fetch(`https://bible-api.com/${apiRef}?translation=kjv`)
    if (!res.ok) return null
    const data = await res.json()
    const text = data.text?.trim() ?? null
    if (text) saveVerseToCache(ref, text)
    return text
  } catch { return null }
}

function getVerseFromCache(ref: string): string | null {
  try {
    const raw = localStorage.getItem(VERSE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[ref]
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > CACHE_TTL) {
      delete cache[ref]
      localStorage.setItem(VERSE_CACHE_KEY, JSON.stringify(cache))
      return null
    }
    return entry.text
  } catch { return null }
}

function saveVerseToCache(ref: string, text: string) {
  try {
    const raw = localStorage.getItem(VERSE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[ref] = { text, fetchedAt: Date.now() }
    const json = JSON.stringify(cache)
    if (json.length < 500_000) localStorage.setItem(VERSE_CACHE_KEY, json)
  } catch {}
}

// ── History ──
function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") } catch { return [] }
}

function addToHistory(query: string) {
  const h = getHistory().filter((q) => q !== query)
  h.unshift(query)
  if (h.length > MAX_HISTORY) h.length = MAX_HISTORY
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
}

function removeFromHistory(query: string) {
  const h = getHistory().filter((q) => q !== query)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
}

function renderHistory(el: HTMLElement, input: HTMLInputElement) {
  if (!el) return
  const h = getHistory()
  el.innerHTML = h
    .map((q) => `<button class="vc-history-chip pressable" data-query="${q}" data-tooltip="Search for ${q}">${q}<span class="chip-x" data-remove="${q}" data-tooltip="Remove from history">&times;</span></button>`)
    .join("")

  el.onclick = (e) => {
    const target = e.target as HTMLElement
    const removeBtn = target.closest("[data-remove]") as HTMLElement | null
    if (removeBtn) {
      e.stopPropagation()
      removeFromHistory(removeBtn.dataset.remove!)
      renderHistory(el, input)
      return
    }
    const chip = target.closest(".vc-history-chip") as HTMLElement | null
    if (chip) {
      const q = chip.dataset.query!
      input.value = q
      const flowEl = document.getElementById("vc-flow") as HTMLElement
      const countEl = document.getElementById("vc-count") as HTMLElement
      const baseUrl = document.querySelector(".verse-chain")?.getAttribute("data-base-url") ?? ""
      runSearch(q, flowEl, countEl, baseUrl)
      updateUrl(q)
    }
  }
}

// ── Filters ──
function findMatchingVerses(query: string): string[] {
  if (!verseIndex) return []
  const q = query.toLowerCase().trim()

  // Try exact match first
  const exact = Object.keys(verseIndex.index).find((k) => k.toLowerCase() === q)
  if (exact) return [exact]

  // Try normalization through alias system
  const parsed = parseSearchQuery(query)
  if (parsed) {
    const { book, chapter, verse, endVerse } = parsed

    if (verse && endVerse && chapter) {
      // Range: "1 cor 10:5-8"
      const start = parseInt(verse)
      const end = Math.min(parseInt(endVerse), start + 29)
      const keys: string[] = []
      for (let v = start; v <= end; v++) {
        const candidate = Object.keys(verseIndex.index).find(
          (k) => k.toLowerCase() === `${book} ${chapter}:${v}`.toLowerCase(),
        )
        if (candidate) keys.push(candidate)
      }
      if (keys.length > 0) return keys
    }

    if (verse && chapter) {
      // Specific verse: "1 cor 10:5"
      const exactNorm = Object.keys(verseIndex.index).find(
        (k) => k.toLowerCase() === `${book} ${chapter}:${verse}`.toLowerCase(),
      )
      if (exactNorm) return [exactNorm]
    }

    // Chapter or book prefix match
    const prefix = chapter ? `${book} ${chapter}` : book
    const results = Object.keys(verseIndex.index)
      .filter((k) => k.toLowerCase().startsWith(prefix.toLowerCase()))
      .sort((a, b) => parseInt(a.split(":")[1] ?? "0") - parseInt(b.split(":")[1] ?? "0"))
    if (results.length > 0) return results
  }

  // Original range match fallback
  const rangeMatch = q.match(/^(.+?)\s+(\d+):(\d+)-(\d+)$/i)
  if (rangeMatch) {
    const [, bookPart, ch, startV, endV] = rangeMatch
    const start = parseInt(startV)
    const end = Math.min(parseInt(endV), start + 29)
    const keys: string[] = []
    for (let v = start; v <= end; v++) {
      const candidate = Object.keys(verseIndex.index).find(
        (k) => k.toLowerCase() === `${bookPart.trim()} ${ch}:${v}`.toLowerCase(),
      )
      if (candidate) keys.push(candidate)
    }
    return keys
  }

  // Fallback: prefix match on raw query
  return Object.keys(verseIndex.index)
    .filter((k) => k.toLowerCase().startsWith(q))
    .sort((a, b) => parseInt(a.split(":")[1] ?? "0") - parseInt(b.split(":")[1] ?? "0"))
}

function filterBySection(keys: string[]): string[] {
  if (currentFilter === "all" || !verseIndex) return keys
  return keys.filter((key) => {
    const entries = verseIndex!.index[key] ?? []
    return entries.some((e) => e.folder === currentFilter)
  })
}

function findSuggestions(query: string): string[] {
  if (!verseIndex) return []
  const q = query.toLowerCase().trim()
  const bookMatch = q.match(/^(.+?)\s+(\d+):(\d+)/)
  if (bookMatch) {
    const [, book, ch] = bookMatch
    const broader = `${book} ${ch}`
    return Object.keys(verseIndex.index).filter((k) => k.toLowerCase().startsWith(broader.toLowerCase())).slice(0, 5)
  }
  return []
}

// ── URL ──
function updateUrl(query: string) {
  const params = new URLSearchParams()
  if (query) params.set("v", query)
  // Build chain from column selections (parentRef of columns 1+)
  const chainParts: string[] = []
  for (let i = 1; i < flowColumns.length; i++) {
    if (flowColumns[i].parentRef) chainParts.push(flowColumns[i].parentRef!)
  }
  if (chainParts.length > 0) params.set("chain", chainParts.join(","))
  if (currentFilter !== "all") params.set("f", currentFilter)
  const qs = params.toString()
  const newUrl = window.location.pathname + (qs ? `?${qs}` : "")
  if (newUrl !== window.location.pathname + window.location.search) {
    history.pushState(null, "", newUrl)
  }
}

// ── Chain icons on verse links (global) ──
function makeChainBtn(ref: string): HTMLSpanElement {
  const btn = document.createElement("span")
  btn.className = "verse-chain-btn"
  btn.setAttribute("role", "link")
  btn.setAttribute("tabindex", "0")
  btn.setAttribute("aria-label", `Explore verse chain for ${ref}`)
  btn.setAttribute("data-tooltip", "Explore verse chain")
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.spaNavigate?.(new URL(`/Verse-Chain?v=${encodeURIComponent(ref)}`, window.location.origin))
  })
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click() }
  })
  return btn
}

// Build regex for canonical book names to find unlinked verse refs in text nodes
const CANONICAL_BOOKS = [...new Set(Object.values(BOOK_ALIASES))]
  .sort((a, b) => b.length - a.length) // longest first to avoid partial matches
const VERSE_TEXT_RE = new RegExp(
  `((?:${CANONICAL_BOOKS.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s+\\d+:\\d+(?:\\s*-\\s*\\d+)?)`,
  "g",
)

function injectChainIcons() {
  // 1. Existing <a data-verse-ref> links
  document.querySelectorAll("a[data-verse-ref]").forEach((el) => {
    if (el.nextElementSibling?.classList.contains("verse-chain-btn")) return
    const ref = el.getAttribute("data-verse-ref")!
    el.parentNode?.insertBefore(makeChainBtn(ref), el.nextSibling)
  })

  // 2. Client-side fallback: scan text nodes in article for unlinked verse refs
  const article = document.querySelector("article")
  if (!article) return

  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip if inside an <a> tag or already-processed chain btn
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest("a, .verse-chain-btn, code, pre, .vc-verse-text")) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) textNodes.push(n as Text)

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ""
    VERSE_TEXT_RE.lastIndex = 0
    if (!VERSE_TEXT_RE.test(text)) continue

    // Split and wrap matches
    VERSE_TEXT_RE.lastIndex = 0
    const frag = document.createDocumentFragment()
    let lastIdx = 0
    let match: RegExpExecArray | null
    while ((match = VERSE_TEXT_RE.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)))
      }
      const matchedRef = match[1].trim()
      const normalized = normalizeBookName(matchedRef.replace(/\s+\d+:\d+.*$/, ""))
      const verseMatch = matchedRef.match(/(\d+):(\d+)(?:\s*-\s*(\d+))?$/)
      if (normalized && verseMatch) {
        const ref = `${normalized} ${verseMatch[1]}:${verseMatch[2]}`
        const link = document.createElement("a")
        link.className = "bible-auto-link internal"
        link.setAttribute("data-verse-ref", ref)
        link.href = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(matchedRef)}&version=KJV`
        link.target = "_blank"
        link.textContent = matchedRef
        frag.appendChild(link)
        frag.appendChild(makeChainBtn(ref))
      } else {
        frag.appendChild(document.createTextNode(matchedRef))
      }
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)))
    }
    if (lastIdx > 0) {
      textNode.parentNode?.replaceChild(frag, textNode)
    }
  }
}

document.addEventListener("nav", init)
document.addEventListener("nav", injectChainIcons)
