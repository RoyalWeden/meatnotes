// @ts-nocheck
import FlexSearch from "flexsearch"
import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { FullSlug, resolveRelative } from "../../util/path"

type ContentData = Record<string, ContentDetails>

declare const fetchData: Promise<ContentData>

interface FSItem {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  [key: string]: unknown
}

type SearchFilter = "all" | "title" | "content" | "tags"
type SearchScope = "all" | "idioms" | "capture" | "progress" | "complete"

// Module-level state (reset on each nav to the Search page)
let fsSearchFilter: SearchFilter = "all"
let fsActiveScopes: Set<SearchScope> = new Set(["all"])
let fsPhraseMode: boolean = false
let fsActiveFolderFilter: string | null = null

const SCOPE_PATTERNS: Record<SearchScope, ((slug: string) => boolean) | undefined> = {
  all: undefined,
  idioms: (slug) => slug.startsWith("Idioms/"),
  capture: (slug) => slug.startsWith("00-—-Capture/"),
  progress: (slug) => slug.startsWith("10-—-In-Progress/"),
  complete: (slug) => slug.startsWith("20-—-Complete/"),
}

function matchesScope(slug: string): boolean {
  if (fsActiveFolderFilter !== null) {
    return slug.startsWith(fsActiveFolderFilter + "/")
  }
  if (fsActiveScopes.has("all")) return true
  return [...fsActiveScopes].some((scope) => SCOPE_PATTERNS[scope]?.(slug) ?? false)
}

// Derive a friendly display label from a folder slug path
function friendlyFolderLabel(path: string): string {
  return path
    .split("/")
    .map((seg) => seg.replace(/^\d+-—-/, "").replace(/-/g, " ").trim())
    .filter(Boolean)
    .join(" > ")
}

const encoder = (str: string): string[] => {
  const tokens: string[] = []
  let bufferStart = -1
  let bufferEnd = -1
  const lower = str.toLowerCase()
  let i = 0
  for (const char of lower) {
    const code = char.codePointAt(0)!
    const isCJK =
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af)
    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13
    if (isCJK) {
      if (bufferStart !== -1) { tokens.push(lower.slice(bufferStart, bufferEnd)); bufferStart = -1 }
      tokens.push(char)
    } else if (isWhitespace) {
      if (bufferStart !== -1) { tokens.push(lower.slice(bufferStart, bufferEnd)); bufferStart = -1 }
    } else {
      if (bufferStart === -1) bufferStart = i
      bufferEnd = i + char.length
    }
    i += char.length
  }
  if (bufferStart !== -1) tokens.push(lower.slice(bufferStart))
  return tokens
}

// ─── Quote-based phrase extraction ──────────────────────────────────────────

function extractPhrases(query: string): { phrases: string[]; searchTerm: string } {
  const phrases: string[] = []
  const remainder = query
    .replace(/"([^"]+)"/g, (_, phrase) => {
      phrases.push(phrase.trim().toLowerCase())
      return " "
    })
    .replace(/\s+/g, " ")
    .trim()
  return { phrases, searchTerm: remainder || phrases.join(" ") }
}

interface DateRange {
  start: string
  end: string
  label: string
}

function parseDateQuery(term: string): DateRange | null {
  const lower = term.trim().toLowerCase()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const ymd = (d: Date) => d.toLocaleDateString("sv")
  const single = (d: Date): DateRange => ({
    start: ymd(d),
    end: ymd(d),
    label: d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
  })
  const makeRange = (start: Date, end: Date, label: string): DateRange => ({
    start: ymd(start),
    end: ymd(end),
    label,
  })

  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"]
  const monthShort = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
  const allMonths = monthNames.join("|") + "|" + monthShort.join("|")
  const getMonthIdx = (m: string) => { let i = monthNames.indexOf(m); if (i === -1) i = monthShort.indexOf(m); return i }
  const stripOrd = (s: string) => s.replace(/(st|nd|rd|th)$/, "")

  if (lower === "today") return single(today)
  if (lower === "yesterday") { const d = new Date(today); d.setDate(d.getDate() - 1); return single(d) }

  if (lower === "this week") {
    const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return makeRange(mon, today, `${mon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`)
  }
  if (lower === "last week") {
    const thisMon = new Date(today); thisMon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7)
    const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1)
    return makeRange(lastMon, lastSun, `${lastMon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${lastSun.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`)
  }
  if (lower === "this month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return makeRange(first, today, today.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }
  if (lower === "last month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    return makeRange(first, last, first.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }

  // Weekday: "monday", "last monday", "this monday"
  const wdMatch = lower.match(/^(?:(?:last|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/)
  if (wdMatch) {
    const target = dayNames.indexOf(wdMatch[1])
    const d = new Date(today)
    const back = ((d.getDay() - target + 7) % 7) || 7
    d.setDate(d.getDate() - back)
    return single(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
  }

  // "N/a day/week/month ago|back"
  const agoMatch = lower.match(/^(a|\d+)\s+(day|days|week|weeks|month|months)\s+(?:ago|back)$/)
  if (agoMatch) {
    const n = agoMatch[1] === "a" ? 1 : parseInt(agoMatch[1])
    const d = new Date(today)
    if (agoMatch[2].startsWith("day")) d.setDate(d.getDate() - n)
    else if (agoMatch[2].startsWith("week")) d.setDate(d.getDate() - n * 7)
    else if (agoMatch[2].startsWith("month")) d.setMonth(d.getMonth() - n)
    return single(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
  }

  // ISO: YYYY-MM-DD
  const isoMatch = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return single(new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3])))

  // US slash: M/D or M/D/YYYY
  const slashMatch = lower.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]) - 1, d = parseInt(slashMatch[2]), yr = slashMatch[3] ? parseInt(slashMatch[3]) : now.getFullYear()
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) return single(new Date(yr, m, d))
  }

  // Month + year: "march 2026"
  const myMatch = lower.match(new RegExp(`^(${allMonths})\\s+(\\d{4})$`))
  if (myMatch) {
    const mi = getMonthIdx(myMatch[1]), yr = parseInt(myMatch[2])
    const first = new Date(yr, mi, 1), last = new Date(yr, mi + 1, 0)
    return makeRange(first, last, first.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }

  // Month alone: "march"
  const mAlone = lower.match(new RegExp(`^(${allMonths})$`))
  if (mAlone) {
    const mi = getMonthIdx(mAlone[1]), yr = now.getFullYear()
    const first = new Date(yr, mi, 1), last = new Date(yr, mi + 1, 0)
    return makeRange(first, last, first.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }

  // Month + day (with optional ordinal + year): "march 3rd", "march 3", "march 3rd, 2026"
  const mdMatch = lower.match(new RegExp(`^(${allMonths})\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:[,\\s]+(\\d{4}))?$`))
  if (mdMatch) {
    const mi = getMonthIdx(mdMatch[1]), day = parseInt(stripOrd(mdMatch[2])), yr = mdMatch[3] ? parseInt(mdMatch[3]) : now.getFullYear()
    return single(new Date(yr, mi, day))
  }

  // Day + month (with optional "the", "of", ordinal): "3rd march", "3rd of march", "the 3rd of march"
  const dmMatch = lower.match(new RegExp(`^(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?\\s+(${allMonths})(?:\\s+(\\d{4}))?$`))
  if (dmMatch) {
    const day = parseInt(stripOrd(dmMatch[1])), mi = getMonthIdx(dmMatch[2]), yr = dmMatch[3] ? parseInt(dmMatch[3]) : now.getFullYear()
    return single(new Date(yr, mi, day))
  }

  return null
}

function highlightText(term: string, text: string): string {
  if (!term || !text) return text
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  return text.replace(regex, "<mark>$1</mark>")
}

// ─── Boolean query parser ────────────────────────────────────────────────────

type Token = { type: "WORD" | "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN"; value: string }

type QueryNode =
  | { type: "term"; value: string }
  | { type: "and"; left: QueryNode; right: QueryNode }
  | { type: "or"; left: QueryNode; right: QueryNode }
  | { type: "not"; operand: QueryNode }

function tokenizeBoolQuery(q: string): Token[] {
  const raw = q.trim().match(/\(|\)|AND|OR|NOT|[^\s()]+/g) ?? []
  return raw.map((tok) => {
    if (tok === "AND") return { type: "AND", value: tok }
    if (tok === "OR") return { type: "OR", value: tok }
    if (tok === "NOT") return { type: "NOT", value: tok }
    if (tok === "(") return { type: "LPAREN", value: tok }
    if (tok === ")") return { type: "RPAREN", value: tok }
    return { type: "WORD", value: tok }
  })
}

function parseBoolQuery(q: string): QueryNode {
  const tokens = tokenizeBoolQuery(q)
  let pos = 0

  function peek(): Token | undefined { return tokens[pos] }
  function consume(): Token { return tokens[pos++] }

  function parseOr(): QueryNode {
    let left = parseAnd()
    while (peek()?.type === "OR") {
      consume()
      const right = parseAnd()
      left = { type: "or", left, right }
    }
    return left
  }

  function parseAnd(): QueryNode {
    let left = parseNot()
    while (peek()?.type === "AND") {
      consume()
      const right = parseNot()
      left = { type: "and", left, right }
    }
    return left
  }

  function parseNot(): QueryNode {
    if (peek()?.type === "NOT") {
      consume()
      return { type: "not", operand: parsePrimary() }
    }
    return parsePrimary()
  }

  function parsePrimary(): QueryNode {
    if (peek()?.type === "LPAREN") {
      consume()
      const node = parseOr()
      if (peek()?.type === "RPAREN") consume()
      return node
    }
    const words: string[] = []
    while (peek()?.type === "WORD") {
      words.push(consume().value)
    }
    if (words.length === 0) {
      if (peek()) consume()
      return { type: "term", value: "" }
    }
    return { type: "term", value: words.join(" ") }
  }

  return parseOr()
}

function queryHasBooleanOps(q: string): boolean {
  return /\bAND\b|\bOR\b|\bNOT\b|[()]/.test(q)
}

function setIntersection(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => b.has(x)))
}
function setUnion(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a, ...b])
}
function setDifference(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => !b.has(x)))
}

// ─── Build breadcrumb from slug ──────────────────────────────────────────────

function buildBreadcrumb(slug: string): string {
  const parts = slug.split("/")
  // Drop the last segment (the file name), keep only folder segments
  const folders = parts.slice(0, -1)
  if (folders.length === 0) return ""
  return folders
    .map((seg) => seg.replace(/^\d+-—-/, "").replace(/-/g, " ").trim())
    .filter(Boolean)
    .join(" > ")
}

// ─── Main ────────────────────────────────────────────────────────────────────

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  if (currentSlug !== ("Search" as FullSlug)) return

  // Reset state on each nav
  fsSearchFilter = "all"
  fsActiveScopes = new Set(["all"])
  fsPhraseMode = false
  fsActiveFolderFilter = null

  const data: ContentData = await fetchData
  const inputEl = document.getElementById("full-search-input") as HTMLInputElement | null
  const resultsEl = document.getElementById("full-search-results") as HTMLDivElement | null
  const countEl = document.getElementById("fs-count") as HTMLDivElement | null
  const sortEl = document.getElementById("fs-sort") as HTMLSelectElement | null
  const inputWrapEl = document.getElementById("fs-input-wrap") as HTMLElement | null
  const scopeRowEl = document.getElementById("fs-scope-row") as HTMLElement | null
  const phraseBtnEl = document.getElementById("fs-phrase-btn") as HTMLButtonElement | null

  if (!inputEl || !resultsEl) return

  // On DESKTOP the nav bar is sticky (custom.scss), so the FS bar must sit flush
  // below it and track its shrinking height via ResizeObserver + --header-shrink.
  // We measure `.page-header > header` (the actual nav element) not `.page-header`
  // (the full grid-row element, which is taller and would create a visible gap).
  //
  // On MOBILE `.sidebar.left` is sticky at top:0 and acts as the mobile nav bar
  // (~77px tall). The FS bar must sit flush below it, so we measure its bottom
  // and track changes with a ResizeObserver.
  const fsBar = document.getElementById("fs-sticky-bar")
  if (fsBar) {
    const isDesktop = window.matchMedia("(min-width: 801px)").matches
    if (isDesktop) {
      const navEl =
        (document.querySelector(".page-header > header") as HTMLElement | null) ??
        (document.querySelector(".page-header") as HTMLElement | null)

      const updateFsTop = () => {
        // Nav is sticky at top:0 so getBoundingClientRect().bottom === current nav height
        const bottom = navEl ? navEl.getBoundingClientRect().bottom : 0
        fsBar.style.top = `${Math.max(0, bottom)}px`
      }

      requestAnimationFrame(updateFsTop)
      if (navEl) {
        const ro = new ResizeObserver(updateFsTop)
        ro.observe(navEl)
        window.addCleanup(() => ro.disconnect())
      }
    } else {
      // Mobile: the left sidebar is sticky at top:0 and acts as the nav bar.
      // We must sit flush below it, tracking its height via ResizeObserver.
      const mobileNav = document.querySelector(".sidebar.left") as HTMLElement | null
      const updateMobileTop = () => {
        const bottom = mobileNav ? mobileNav.getBoundingClientRect().bottom : 0
        fsBar.style.top = `${Math.max(0, bottom)}px`
      }
      requestAnimationFrame(updateMobileTop)
      if (mobileNav) {
        const ro = new ResizeObserver(updateMobileTop)
        ro.observe(mobileNav)
        window.addCleanup(() => ro.disconnect())
      }
    }
  }

  const idDataMap = Object.keys(data) as FullSlug[]

  // Build folder index from all slug ancestors
  if (!(window as any).__fsFolderIndex) {
    const folderPaths = new Set<string>()
    for (const slug of idDataMap) {
      if (slug === "Search") continue
      const parts = slug.split("/")
      for (let i = 1; i < parts.length; i++) {
        folderPaths.add(parts.slice(0, i).join("/"))
      }
    }
    ;(window as any).__fsFolderIndex = [...folderPaths].map((path) => ({
      path,
      label: friendlyFolderLabel(path),
    }))
  }

  const folderIndex: Array<{ path: string; label: string }> = (window as any).__fsFolderIndex ?? []

  let indexPopulated = false

  const index = new FlexSearch.Document<FSItem>({
    encode: encoder,
    document: {
      id: "id",
      tag: "tags",
      index: [
        { field: "title", tokenize: "forward" },
        { field: "content", tokenize: "forward" },
        { field: "tags", tokenize: "forward" },
      ],
    },
  })

  async function populateIndex() {
    if (indexPopulated) return
    const promises: Promise<unknown>[] = []
    let id = 0
    for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
      promises.push(
        index.addAsync(id++, {
          id,
          slug: slug as FullSlug,
          title: fileData.title,
          content: fileData.content,
          tags: fileData.tags,
        }),
      )
    }
    await Promise.all(promises)
    indexPopulated = true
  }

  function resolveUrl(slug: FullSlug): string {
    return new URL(resolveRelative(currentSlug, slug), location.toString()).toString()
  }

  // ── Folder filter chip management ────────────────────────────────────────

  function setFolderFilter(path: string, label: string) {
    fsActiveFolderFilter = path
    // Remove any existing chip
    inputWrapEl?.querySelector(".fs-chip")?.remove()
    // Inject chip before the text input
    if (inputWrapEl) {
      const chip = document.createElement("span")
      chip.className = "fs-chip"
      chip.setAttribute("aria-label", `Filtering by folder: ${label}`)
      chip.innerHTML = `<span class="fs-chip-icon">📁</span><span class="fs-chip-label">${label}</span><button class="fs-chip-clear" type="button" aria-label="Clear folder filter">×</button>`
      inputWrapEl.insertBefore(chip, inputEl)
      const clearBtn = chip.querySelector(".fs-chip-clear") as HTMLButtonElement
      const clearBtnHandler = () => {
        clearFolderFilter()
        inputEl.dispatchEvent(new Event("input"))
        inputEl.focus()
      }
      clearBtn.addEventListener("click", clearBtnHandler)
      window.addCleanup(() => clearBtn.removeEventListener("click", clearBtnHandler))
    }
    // Hide scope row while folder filter is active
    if (scopeRowEl) scopeRowEl.classList.add("fs-scope-filtered")
    inputEl.placeholder = "Type to search or narrow…"
  }

  function clearFolderFilter() {
    fsActiveFolderFilter = null
    inputWrapEl?.querySelector(".fs-chip")?.remove()
    inputEl.placeholder = "Search all notes…"
    if (scopeRowEl) scopeRowEl.classList.remove("fs-scope-filtered")
  }

  // ── Filter + scope state management ────────────────────────────────────

  function setFilter(filter: SearchFilter) {
    fsSearchFilter = filter
    const filterBtns = document.querySelectorAll<HTMLElement>(".fs-filter-btn")
    filterBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter)
    })
  }

  function setPhraseMode(active: boolean) {
    fsPhraseMode = active
    if (phraseBtnEl) {
      phraseBtnEl.classList.toggle("active", active)
      phraseBtnEl.setAttribute("aria-pressed", String(active))
    }
  }

  function toggleScope(scope: SearchScope) {
    if (scope === "all") {
      fsActiveScopes = new Set(["all"])
    } else if (fsActiveScopes.has(scope)) {
      fsActiveScopes.delete(scope)
      if (fsActiveScopes.size === 0) fsActiveScopes.add("all")
    } else {
      fsActiveScopes.delete("all")
      fsActiveScopes.add(scope)
    }
    const scopeBtns = document.querySelectorAll<HTMLElement>(".fs-scope-btn")
    scopeBtns.forEach((btn) => {
      btn.classList.toggle("active", fsActiveScopes.has((btn.dataset.scope ?? "all") as SearchScope))
    })
  }

  // ── Section browser ──────────────────────────────────────────────────────

  const SECTIONS = [
    { emoji: "📥", label: "Capture",           path: "00-—-Capture",           desc: "Raw topics and sources" },
    { emoji: "📖", label: "In Progress",        path: "10-—-In-Progress",        desc: "Studies currently being developed" },
    { emoji: "✅", label: "Complete",           path: "20-—-Complete",           desc: "Finished, teachable study notes" },
    { emoji: "✉️", label: "Copy-Paste Rebukes", path: "Copy-Paste-Rebukes",      desc: "Ready-to-use scripture rebukes" },
  ]

  function renderSectionBrowser() {
    if (!resultsEl) return
    const sectionCards = SECTIONS.map((sec) => {
      const count = Object.keys(data).filter((s) => s.startsWith(sec.path + "/")).length
      return `
        <button class="fs-section-card" data-section-path="${sec.path}" data-section-label="${sec.label}">
          <span class="fs-section-emoji">${sec.emoji}</span>
          <span class="fs-section-info">
            <span class="fs-section-name">${sec.label}</span>
            <span class="fs-section-desc">${sec.desc}</span>
          </span>
          <span class="fs-section-count">${count}</span>
        </button>`
    }).join("")

    resultsEl.innerHTML = `
      <div class="fs-section-browser">
        <p class="fs-section-browser-heading">Browse by section</p>
        <div class="fs-section-grid">${sectionCards}</div>
      </div>`

    // Attach click handlers
    resultsEl.querySelectorAll<HTMLButtonElement>(".fs-section-card").forEach((card) => {
      const handler = () => {
        const path = card.dataset.sectionPath!
        const label = card.dataset.sectionLabel!
        setFolderFilter(path, label)
        inputEl.dispatchEvent(new Event("input"))
        inputEl.focus()
      }
      card.addEventListener("click", handler)
      window.addCleanup(() => card.removeEventListener("click", handler))
    })
  }

  // ── Folder cards (subfolder drill-down) ──────────────────────────────────

  function renderFolderCards(parentPath: string | null): string {
    let matches: Array<{ path: string; label: string }>
    if (parentPath !== null) {
      // Show direct children of parentPath
      const prefix = parentPath + "/"
      matches = folderIndex.filter((f) => {
        if (!f.path.startsWith(prefix)) return false
        const remainder = f.path.slice(prefix.length)
        return !remainder.includes("/") // direct children only
      })
    } else {
      // Show top-level folders
      matches = folderIndex.filter((f) => !f.path.includes("/"))
    }
    if (matches.length === 0) return ""
    const label = parentPath ? "Narrow to subfolder" : "Filter by folder"
    const cards = matches.map((folder) => `
      <button class="fs-folder-card" data-folder-path="${folder.path}" data-folder-label="${folder.label}">
        <span>📁</span>
        <span>${folder.label}</span>
      </button>`).join("")
    return `
      <span class="fs-folder-section-label">${label}</span>
      ${cards}
      <div class="fs-folder-divider"></div>`
  }

  function attachFolderCardHandlers(container: HTMLElement) {
    container.querySelectorAll<HTMLButtonElement>(".fs-folder-card").forEach((card) => {
      const handler = () => {
        const path = card.dataset.folderPath!
        const label = card.dataset.folderLabel!
        setFolderFilter(path, label)
        inputEl.dispatchEvent(new Event("input"))
        inputEl.focus()
      }
      card.addEventListener("click", handler)
      window.addCleanup(() => card.removeEventListener("click", handler))
    })
  }

  // ── Result card HTML ─────────────────────────────────────────────────────

  function buildResultCard(
    slug: FullSlug,
    fileData: ContentDetails,
    query: string,
    doHighlight: boolean,
  ): string {
    const url = resolveUrl(slug)
    const title = doHighlight ? highlightText(query, fileData.title ?? slug) : (fileData.title ?? slug)
    const dateStr = fileData.date
      ? new Date(fileData.date).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : ""
    const breadcrumb = buildBreadcrumb(slug)
    const rawExcerpt = (fileData.content ?? "").slice(0, 300)
    const excerpt = doHighlight ? highlightText(query, rawExcerpt) : ""
    const tagsHtml =
      fileData.tags && fileData.tags.length > 0
        ? `<ul class="fs-result-tags">${fileData.tags.map((t) => `<li>${doHighlight ? highlightText(query, "#" + t) : "#" + t}</li>`).join("")}</ul>`
        : ""

    return `
      <a class="fs-result-card" href="${url}">
        <div class="fs-result-header">
          <h3 class="fs-result-title">${title}</h3>
          ${dateStr ? `<span class="fs-result-date">${dateStr}</span>` : ""}
        </div>
        ${breadcrumb ? `<div class="fs-result-breadcrumb">${breadcrumb}</div>` : ""}
        ${excerpt ? `<p class="fs-result-excerpt">${excerpt}</p>` : ""}
        ${tagsHtml}
      </a>`
  }

  // Search for a term across fields, returns items
  async function searchFor(
    term: string,
    fields: string[],
  ): Promise<Array<{ slug: FullSlug; fileData: ContentDetails }>> {
    if (!term.trim() || fields.length === 0) return []
    const res = await index.searchAsync({ query: term, limit: 1000, index: fields })
    const ids = new Set<number>()
    for (const r of res) for (const id of r.result) ids.add(id as number)
    return [...ids]
      .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]] }))
      .filter((item) => item.slug !== "Search" && item.fileData != null && matchesScope(item.slug))
  }

  // Evaluate a boolean query AST
  async function evalBoolNode(node: QueryNode, fields: string[]): Promise<Set<number>> {
    if (node.type === "term") {
      if (!node.value) return new Set()
      const res = await index.searchAsync({ query: node.value, limit: 1000, index: fields })
      const ids = new Set<number>()
      for (const r of res) for (const id of r.result) ids.add(id as number)
      return ids
    }
    if (node.type === "and") {
      return setIntersection(await evalBoolNode(node.left, fields), await evalBoolNode(node.right, fields))
    }
    if (node.type === "or") {
      return setUnion(await evalBoolNode(node.left, fields), await evalBoolNode(node.right, fields))
    }
    if (node.type === "not") {
      const all = new Set(idDataMap.map((_, i) => i))
      const sub = await evalBoolNode(node.operand, fields)
      return setDifference(all, sub)
    }
    return new Set()
  }

  // Smart suggestions
  async function getSmartSuggestions(
    words: string[],
    fields: string[],
  ): Promise<Array<{ label: string; items: Array<{ slug: FullSlug; fileData: ContentDetails }> }>> {
    const seen = new Set<string>()
    const results: Array<{ label: string; items: Array<{ slug: FullSlug; fileData: ContentDetails }> }> = []

    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i + 1]}`
      if (seen.has(pair)) continue
      seen.add(pair)
      const r = await searchFor(pair, fields)
      if (r.length > 0) results.push({ label: `"${pair}"`, items: r })
    }

    const stopwords = new Set(["the", "a", "an", "in", "of", "to", "for", "and", "or", "but", "is", "it"])
    for (const word of words) {
      if (word.length < 3 || stopwords.has(word.toLowerCase())) continue
      if (seen.has(word)) continue
      seen.add(word)
      const r = await searchFor(word, fields)
      if (r.length > 0) results.push({ label: `"${word}"`, items: r.slice(0, 5) })
    }

    return results.slice(0, 3)
  }

  const MAX_RESULTS = 100

  function renderResults(
    items: Array<{ slug: FullSlug; fileData: ContentDetails; doHighlight?: boolean }>,
    query: string,
    dateLabel?: string,
    words?: string[],
    fields?: string[],
  ) {
    if (!resultsEl) return
    resultsEl.innerHTML = ""

    if (items.length === 0) {
      const doSuggestions = async () => {
        const w = words ?? query.trim().split(/\s+/).filter(Boolean)
        const f = fields ?? ["title", "content", "tags"]
        if (w.length >= 2 && !queryHasBooleanOps(query)) {
          const suggestions = await getSmartSuggestions(w, f)
          if (suggestions.length > 0) {
            resultsEl.innerHTML = `
              <p class="fs-no-results">No results for <em>"${query}"</em>.</p>
              <details class="fs-similar" open>
                <summary>💡 Similar results</summary>
                ${suggestions
                  .map(
                    (g) => `
                  <div class="fs-similar-group">
                    <p class="fs-similar-label">Results for ${g.label}</p>
                    ${g.items.map((item) => buildResultCard(item.slug, item.fileData, g.label.replace(/"/g, ""), true)).join("")}
                  </div>`,
                  )
                  .join("")}
              </details>`
            if (countEl) countEl.textContent = ""
            return
          }
        }
        resultsEl.innerHTML = `<p class="fs-no-results">No results found. Try a different search term.</p>`
        if (countEl) countEl.textContent = ""
      }
      doSuggestions()
      return
    }

    const total = items.length
    const displayed = items.slice(0, MAX_RESULTS)

    if (countEl) {
      const count = `${total} result${total === 1 ? "" : "s"}`
      countEl.textContent = dateLabel ? `📅 ${dateLabel} — ${count}` : count
    }

    let html = ""
    if (total > MAX_RESULTS) {
      html += `<div class="fs-see-all">Showing ${MAX_RESULTS} of ${total} results — refine your search to see more</div>`
    }
    html += displayed
      .map((item) => buildResultCard(item.slug, item.fileData, query, item.doHighlight ?? true))
      .join("")
    resultsEl.innerHTML = html
  }

  function getActiveFields(): string[] {
    if (fsSearchFilter === "all") return ["title", "content", "tags"]
    return [fsSearchFilter]
  }

  async function doSearch(query: string) {
    if (!resultsEl) return

    const trimmed = query.trim()

    // Empty query: show section browser or folder content
    if (!trimmed) {
      if (fsActiveFolderFilter !== null) {
        // Show subfolder cards + all notes in this folder
        const folderCards = renderFolderCards(fsActiveFolderFilter)
        const folderItems = Object.entries(data)
          .filter(([slug]) => slug !== "Search" && slug.startsWith(fsActiveFolderFilter + "/"))
          .sort(([, a], [, b]) => {
            const aTs = new Date(a.date ?? 0).getTime()
            const bTs = new Date(b.date ?? 0).getTime()
            return bTs - aTs
          })
          .map(([slug, fileData]) => ({ slug: slug as FullSlug, fileData, doHighlight: false }))

        const total = folderItems.length
        const displayed = folderItems.slice(0, MAX_RESULTS)

        if (countEl) {
          countEl.textContent = `${total} note${total === 1 ? "" : "s"} in folder`
        }

        let html = folderCards
        if (total > MAX_RESULTS) {
          html += `<div class="fs-see-all">Showing ${MAX_RESULTS} of ${total} notes — type to search within this folder</div>`
        }
        html += displayed.map((item) => buildResultCard(item.slug, item.fileData, "", false)).join("")
        resultsEl.innerHTML = html
        attachFolderCardHandlers(resultsEl)
      } else {
        if (countEl) countEl.textContent = ""
        renderSectionBrowser()
      }
      return
    }

    const sort = sortEl?.value ?? "relevance"
    const { phrases, searchTerm: effectiveTerm } = extractPhrases(query)
    const hasQuotes = phrases.length > 0
    const usePhrase = !hasQuotes && fsPhraseMode

    // Date query
    const dateRange = parseDateQuery(query)
    if (dateRange) {
      const toLocalDateStr = (ts: string | Date | undefined): string => {
        if (!ts) return ""
        return new Date(ts as string).toLocaleDateString("sv")
      }
      const toSlugDateStr = (slug: string): string => {
        const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
        return m ? m[1] : ""
      }
      const inRange = (d: string) => d >= dateRange.start && d <= dateRange.end
      const dateMatches = Object.entries(data)
        .filter(([slug, fd]) => {
          const fileDate = toLocalDateStr(fd.date as string | undefined)
          const slugDate = toSlugDateStr(slug)
          return (inRange(fileDate) || inRange(slugDate)) && slug !== "Search" && matchesScope(slug)
        })
        .sort(([, a], [, b]) => {
          const aTs = new Date(a.date ?? 0).getTime()
          const bTs = new Date(b.date ?? 0).getTime()
          return sort === "date-asc" ? aTs - bTs : bTs - aTs
        })
        .map(([slug, fileData]) => ({ slug: slug as FullSlug, fileData, doHighlight: false }))
      renderResults(dateMatches, query, dateRange.label)
      return
    }

    await populateIndex()

    const searchFields = getActiveFields()
    if (searchFields.length === 0) {
      renderResults([], query)
      return
    }

    // Show folder cards for query >= 2 chars when no folder filter active
    const folderCardsHtml =
      fsActiveFolderFilter === null && effectiveTerm.length >= 2
        ? (() => {
            const lowerQuery = effectiveTerm.toLowerCase()
            const topLevelMatches = folderIndex
              .filter((f) => !f.path.includes("/") && f.label.toLowerCase().includes(lowerQuery))
              .slice(0, 5)
            if (topLevelMatches.length === 0) return ""
            const cards = topLevelMatches.map((folder) => `
              <button class="fs-folder-card" data-folder-path="${folder.path}" data-folder-label="${folder.label}">
                <span>📁</span>
                <span>${folder.label}</span>
              </button>`).join("")
            return `
              <span class="fs-folder-section-label">Filter by folder</span>
              ${cards}
              <div class="fs-folder-divider"></div>`
          })()
        : fsActiveFolderFilter !== null
          ? renderFolderCards(fsActiveFolderFilter)
          : ""

    // Boolean query path
    if (!hasQuotes && queryHasBooleanOps(effectiveTerm)) {
      try {
        const ast = parseBoolQuery(effectiveTerm)
        const ids = await evalBoolNode(ast, searchFields)
        let items = [...ids]
          .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]], doHighlight: false }))
          .filter((item) => item.slug !== "Search" && item.fileData != null && matchesScope(item.slug))

        applySortInPlace(items, sort)
        if (folderCardsHtml) {
          renderResultsWithFolderPrefix(items, query, folderCardsHtml)
        } else {
          renderResults(items, effectiveTerm)
        }
      } catch {
        const searchResults = await index.searchAsync({ query: effectiveTerm, limit: 1000, index: searchFields })
        const allIds = new Set<number>()
        for (const r of searchResults) for (const id of r.result) allIds.add(id as number)
        let items = [...allIds]
          .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]], doHighlight: true }))
          .filter((item) => item.slug !== "Search" && item.fileData != null && matchesScope(item.slug))
        applySortInPlace(items, sort)
        if (folderCardsHtml) {
          renderResultsWithFolderPrefix(items, query, folderCardsHtml)
        } else {
          renderResults(items, effectiveTerm)
        }
      }
      return
    }

    // Plain search path
    const searchResults = await index.searchAsync({ query: effectiveTerm, limit: 1000, index: searchFields })
    const allIds = new Set<number>()
    for (const r of searchResults) for (const id of r.result) allIds.add(id as number)

    let items = [...allIds]
      .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]], doHighlight: true }))
      .filter((item) => item.slug !== "Search" && item.fileData != null && matchesScope(item.slug))

    // Apply phrase filters
    if (hasQuotes) {
      items = items.filter((item) =>
        phrases.every(
          (p) =>
            item.fileData.content?.toLowerCase().includes(p) ||
            item.fileData.title?.toLowerCase().includes(p),
        ),
      )
    } else if (usePhrase && effectiveTerm.trim()) {
      const q = effectiveTerm.toLowerCase()
      items = items.filter(
        (item) =>
          item.fileData.content?.toLowerCase().includes(q) ||
          item.fileData.title?.toLowerCase().includes(q),
      )
    }

    applySortInPlace(items, sort)

    const words = effectiveTerm.trim().split(/\s+/).filter(Boolean)
    if (folderCardsHtml) {
      renderResultsWithFolderPrefix(items, effectiveTerm, folderCardsHtml, undefined, words, searchFields)
    } else {
      renderResults(items, effectiveTerm, undefined, words, searchFields)
    }
  }

  function applySortInPlace(
    items: Array<{ slug: FullSlug; fileData: ContentDetails; doHighlight?: boolean }>,
    sort: string,
  ) {
    if (sort === "date-desc" || sort === "date-asc") {
      items.sort((a, b) => {
        const aTs = new Date(a.fileData.date ?? 0).getTime()
        const bTs = new Date(b.fileData.date ?? 0).getTime()
        return sort === "date-asc" ? aTs - bTs : bTs - aTs
      })
    } else if (sort === "title") {
      items.sort((a, b) => (a.fileData.title ?? "").localeCompare(b.fileData.title ?? ""))
    }
  }

  function renderResultsWithFolderPrefix(
    items: Array<{ slug: FullSlug; fileData: ContentDetails; doHighlight?: boolean }>,
    query: string,
    folderHtml: string,
    dateLabel?: string,
    words?: string[],
    fields?: string[],
  ) {
    if (!resultsEl) return
    resultsEl.innerHTML = ""

    if (items.length === 0) {
      // Still show folder cards even with no results
      resultsEl.innerHTML = folderHtml + `<p class="fs-no-results">No matching notes found. Try a different search term.</p>`
      attachFolderCardHandlers(resultsEl)
      if (countEl) countEl.textContent = ""
      return
    }

    const total = items.length
    const displayed = items.slice(0, MAX_RESULTS)

    if (countEl) {
      const count = `${total} result${total === 1 ? "" : "s"}`
      countEl.textContent = dateLabel ? `📅 ${dateLabel} — ${count}` : count
    }

    let html = folderHtml
    if (total > MAX_RESULTS) {
      html += `<div class="fs-see-all">Showing ${MAX_RESULTS} of ${total} results — refine your search to see more</div>`
    }
    html += displayed.map((item) => buildResultCard(item.slug, item.fileData, query, item.doHighlight ?? true)).join("")
    resultsEl.innerHTML = html
    attachFolderCardHandlers(resultsEl)
  }

  // ── Event listeners ────────────────────────────────────────────────────

  const onInput = () => doSearch(inputEl.value)
  inputEl.addEventListener("input", onInput)
  window.addCleanup(() => inputEl.removeEventListener("input", onInput))

  // Backspace on empty input clears folder filter
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Backspace" && inputEl.value === "" && fsActiveFolderFilter !== null) {
      clearFolderFilter()
      inputEl.dispatchEvent(new Event("input"))
    }
  }
  inputEl.addEventListener("keydown", onKeydown)
  window.addCleanup(() => inputEl.removeEventListener("keydown", onKeydown))

  const onSortChange = () => doSearch(inputEl.value)
  sortEl?.addEventListener("change", onSortChange)
  window.addCleanup(() => sortEl?.removeEventListener("change", onSortChange))

  // Filter buttons
  document.querySelectorAll<HTMLButtonElement>(".fs-filter-btn").forEach((btn) => {
    const handler = () => {
      const f = (btn.dataset.filter ?? "all") as SearchFilter
      setFilter(f)
      doSearch(inputEl.value)
    }
    btn.addEventListener("click", handler)
    window.addCleanup(() => btn.removeEventListener("click", handler))
  })

  // Phrase button
  if (phraseBtnEl) {
    const phraseHandler = () => {
      setPhraseMode(!fsPhraseMode)
      doSearch(inputEl.value)
    }
    phraseBtnEl.addEventListener("click", phraseHandler)
    window.addCleanup(() => phraseBtnEl.removeEventListener("click", phraseHandler))
  }

  // Scope buttons
  document.querySelectorAll<HTMLButtonElement>(".fs-scope-btn").forEach((btn) => {
    const handler = () => {
      const scope = (btn.dataset.scope ?? "all") as SearchScope
      toggleScope(scope)
      doSearch(inputEl.value)
    }
    btn.addEventListener("click", handler)
    window.addCleanup(() => btn.removeEventListener("click", handler))
  })

  // Click on input wrap focuses the input
  if (inputWrapEl) {
    const wrapClickHandler = (e: MouseEvent) => {
      if (e.target === inputWrapEl) inputEl.focus()
    }
    inputWrapEl.addEventListener("click", wrapClickHandler)
    window.addCleanup(() => inputWrapEl.removeEventListener("click", wrapClickHandler))
  }

  // ── Initial load ─────────────────────────────────────────────────────────

  const urlParams = new URLSearchParams(location.search)
  const initialQuery = urlParams.get("q") ?? ""
  inputEl.value = initialQuery

  if (initialQuery) {
    await doSearch(initialQuery)
  } else {
    // Show section browser on load
    renderSectionBrowser()
  }
})
