// Verse Chain Explorer — interactive client-side logic
// Follows SPA pattern: document.addEventListener("nav", init) + window.addCleanup()

interface VerseIndexEntry {
  slug: string
  title: string
  folder: string
}

interface VerseIndexData {
  index: Record<string, VerseIndexEntry[]>
  cooccurrence: Record<string, string[]>
}

const HISTORY_KEY = "verse-chain-history"
const VERSE_CACHE_KEY = "verse-text-cache"
const MAX_HISTORY = 20
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

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

let verseIndex: VerseIndexData | null = null
let currentFilter = "all"
let versesOnly = false
let viewMode: "tree" | "graph" = "tree"
let acIndex = -1 // autocomplete selection index

function init() {
  const container = document.querySelector(".verse-chain") as HTMLElement | null
  if (!container) return

  const baseUrl = container.dataset.baseUrl ?? ""
  const input = document.getElementById("vc-input") as HTMLInputElement
  const acList = document.getElementById("vc-autocomplete") as HTMLUListElement
  const historyEl = document.getElementById("vc-history") as HTMLElement
  const filtersEl = document.getElementById("vc-filters") as HTMLElement
  const countEl = document.getElementById("vc-count") as HTMLElement
  const treeEl = document.getElementById("vc-tree") as HTMLElement
  const graphEl = document.getElementById("vc-graph") as HTMLElement
  const versesOnlyBtn = document.getElementById("vc-verses-only") as HTMLButtonElement
  const viewToggle = document.getElementById("vc-view-toggle") as HTMLButtonElement
  const exportBtn = document.getElementById("vc-export") as HTMLButtonElement

  if (!input || !treeEl) return

  // Reset state
  currentFilter = "all"
  versesOnly = false
  viewMode = "tree"
  acIndex = -1

  // Load index
  loadVerseIndex(baseUrl).then(() => {
    renderHistory(historyEl, input)
    updateFilterCounts(filtersEl)

    // Check URL params for deep link
    const params = new URLSearchParams(window.location.search)
    const v = params.get("v")
    const f = params.get("f")
    if (f) {
      currentFilter = f
      filtersEl?.querySelectorAll(".vc-filter-chip").forEach((btn) => {
        btn.classList.toggle("active", (btn as HTMLElement).dataset.filter === f)
      })
    }
    if (v) {
      input.value = v
      runSearch(v, treeEl, countEl, baseUrl)
    }
  })

  // --- Event listeners ---
  let debounceTimer: ReturnType<typeof setTimeout>

  const onInput = () => {
    clearTimeout(debounceTimer)
    const q = input.value.trim()
    if (q.length < 2) {
      closeAc(acList)
      return
    }
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
          executeSearch(ref, treeEl, countEl, historyEl, input, baseUrl)
        }
        return
      } else if (e.key === "Escape") {
        closeAc(acList)
        return
      }
    } else if (e.key === "Enter") {
      const q = input.value.trim()
      if (q) {
        closeAc(acList)
        executeSearch(q, treeEl, countEl, historyEl, input, baseUrl)
      }
    } else if (e.key === "Escape") {
      input.value = ""
      closeAc(acList)
      treeEl.innerHTML = ""
      countEl.textContent = ""
      updateUrl("")
    }
  }

  const onFilterClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest(".vc-filter-chip") as HTMLElement | null
    if (!btn) return
    filtersEl.querySelectorAll(".vc-filter-chip").forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")
    currentFilter = btn.dataset.filter || "all"
    const q = input.value.trim()
    if (q) runSearch(q, treeEl, countEl, baseUrl)
    updateUrl(q)
  }

  const onVersesOnly = () => {
    versesOnly = !versesOnly
    versesOnlyBtn.setAttribute("aria-pressed", String(versesOnly))
    versesOnlyBtn.classList.toggle("active", versesOnly)
    treeEl.classList.toggle("verses-only", versesOnly)
  }

  let cleanupGraph: (() => void) | null = null

  const onViewToggle = () => {
    if (viewMode === "tree") {
      viewMode = "graph"
      treeEl.style.display = "none"
      graphEl.style.display = ""
      viewToggle.classList.add("active")
      const q = input.value.trim()
      if (q && verseIndex) renderVerseGraph(q, graphEl)
    } else {
      viewMode = "tree"
      treeEl.style.display = ""
      graphEl.style.display = "none"
      viewToggle.classList.remove("active")
      if (cleanupGraph) { cleanupGraph(); cleanupGraph = null }
    }
  }

  const onExport = () => {
    const q = input.value.trim()
    if (!q || !verseIndex) return
    const md = buildExportMarkdown(q)
    navigator.clipboard.writeText(md).then(() => showToast("Copied to clipboard"))
  }

  const onPopstate = () => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get("v") || ""
    input.value = v
    if (v) runSearch(v, treeEl, countEl, baseUrl)
    else {
      treeEl.innerHTML = ""
      countEl.textContent = ""
    }
  }

  // Autocomplete click handler
  const onAcClick = (e: Event) => {
    const li = (e.target as HTMLElement).closest("li") as HTMLElement | null
    if (!li) return
    const ref = li.dataset.ref!
    input.value = ref
    closeAc(acList)
    executeSearch(ref, treeEl, countEl, historyEl, input, baseUrl)
  }

  // Close autocomplete on outside click
  const onDocClick = (e: Event) => {
    if (!(e.target as HTMLElement).closest(".vc-search-wrap")) {
      closeAc(acList)
    }
  }

  input.addEventListener("input", onInput)
  input.addEventListener("keydown", onKeydown)
  acList?.addEventListener("click", onAcClick)
  document.addEventListener("click", onDocClick)
  filtersEl?.addEventListener("click", onFilterClick)
  versesOnlyBtn?.addEventListener("click", onVersesOnly)
  viewToggle?.addEventListener("click", onViewToggle)
  exportBtn?.addEventListener("click", onExport)
  window.addEventListener("popstate", onPopstate)

  // Tree delegation: card expand/collapse + note pill clicks + connected chip clicks
  treeEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement

    // Connected verse chip
    const chip = target.closest(".vc-conn-chip") as HTMLElement | null
    if (chip) {
      const ref = chip.dataset.ref!
      input.value = ref
      executeSearch(ref, treeEl, countEl, historyEl, input, baseUrl)
      return
    }

    // Note pill
    const pill = target.closest(".vc-note-pill") as HTMLAnchorElement | null
    if (pill) return // Let the <a> navigate naturally

    // Empty state link
    const emptyLink = target.closest(".vc-empty-link") as HTMLElement | null
    if (emptyLink) {
      const ref = emptyLink.dataset.ref!
      input.value = ref
      executeSearch(ref, treeEl, countEl, historyEl, input, baseUrl)
      return
    }

    // Card header toggle
    const header = target.closest(".vc-card-header") as HTMLElement | null
    if (header) {
      const card = header.closest(".vc-card") as HTMLElement
      const wasExpanded = card.classList.contains("expanded")
      card.classList.toggle("expanded")
      header.setAttribute("aria-expanded", String(!wasExpanded))

      // Fetch verse text on first expand
      if (!wasExpanded && !card.dataset.fetched) {
        card.dataset.fetched = "1"
        const ref = card.dataset.ref!
        fetchVerseText(ref).then((text) => {
          const textEl = card.querySelector(".vc-verse-text") as HTMLElement
          if (textEl) {
            if (text) {
              textEl.textContent = text
              textEl.classList.remove("vc-shimmer")
            } else {
              textEl.textContent = "[verse text unavailable]"
              textEl.classList.add("vc-verse-unavailable")
              textEl.classList.remove("vc-shimmer")
            }
          }
        })
      }
    }
  })

  // Keyboard nav for cards
  treeEl.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement
    if (target.classList.contains("vc-card-header")) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        target.click()
      }
    }
  })

  // Cleanup on SPA nav
  window.addCleanup?.(() => {
    input.removeEventListener("input", onInput)
    input.removeEventListener("keydown", onKeydown)
    acList?.removeEventListener("click", onAcClick)
    document.removeEventListener("click", onDocClick)
    filtersEl?.removeEventListener("click", onFilterClick)
    versesOnlyBtn?.removeEventListener("click", onVersesOnly)
    viewToggle?.removeEventListener("click", onViewToggle)
    exportBtn?.removeEventListener("click", onExport)
    window.removeEventListener("popstate", onPopstate)
    clearTimeout(debounceTimer)
    if (cleanupGraph) { cleanupGraph(); cleanupGraph = null }
  })
}

// --- Data loading ---
async function loadVerseIndex(_baseUrl: string): Promise<void> {
  if (verseIndex) return
  try {
    // Always fetch from current origin — baseUrl is for link generation, not data fetching
    const res = await fetch("/static/verseIndex.json")
    verseIndex = await res.json()
  } catch {
    verseIndex = { index: {}, cooccurrence: {} }
  }
}

// --- Autocomplete ---
function showAutocomplete(query: string, acList: HTMLUListElement, input: HTMLInputElement) {
  if (!verseIndex) return
  const q = query.toLowerCase()
  const keys = Object.keys(verseIndex.index)

  let matches: { ref: string; count: number }[]

  // Phase 1: book name only (no space yet)
  if (!q.includes(" ")) {
    const bookSet = new Set<string>()
    matches = []
    for (const key of keys) {
      const lk = key.toLowerCase()
      if (lk.startsWith(q)) {
        const book = key.replace(/\s+\d.*/, "")
        if (!bookSet.has(book)) {
          bookSet.add(book)
          // Count total verses for this book
          const count = keys.filter((k) => k.startsWith(book)).length
          matches.push({ ref: book, count })
        }
      }
    }
    matches = matches.slice(0, 8)
  }
  // Phase 2: book + chapter (has space, no colon)
  else if (!q.includes(":")) {
    matches = keys
      .filter((k) => k.toLowerCase().startsWith(q))
      .map((k) => ({ ref: k, count: verseIndex!.index[k]?.length ?? 0 }))
      .sort((a, b) => {
        // Numeric sort by chapter
        const aNum = parseInt(a.ref.match(/\d+/)?.[0] ?? "0")
        const bNum = parseInt(b.ref.match(/\d+/)?.[0] ?? "0")
        return aNum - bNum
      })
      .slice(0, 8)
  }
  // Phase 3: book + chapter:verse
  else {
    matches = keys
      .filter((k) => k.toLowerCase().startsWith(q))
      .map((k) => ({ ref: k, count: verseIndex!.index[k]?.length ?? 0 }))
      .sort((a, b) => {
        const aV = parseInt(a.ref.split(":")[1] ?? "0")
        const bV = parseInt(b.ref.split(":")[1] ?? "0")
        return aV - bV
      })
      .slice(0, 12)
  }

  if (matches.length === 0) {
    closeAc(acList)
    return
  }

  acIndex = -1
  acList.innerHTML = matches
    .map(
      (m) =>
        `<li data-ref="${m.ref}" role="option"><span class="ac-book">${m.ref}</span><span class="ac-count">${m.count} notes</span></li>`,
    )
    .join("")
  acList.classList.add("open")
}

function closeAc(acList: HTMLUListElement) {
  acList.classList.remove("open")
  acList.innerHTML = ""
  acIndex = -1
}

function updateAcHighlight(items: NodeListOf<Element>) {
  items.forEach((item, i) => {
    item.classList.toggle("active", i === acIndex)
  })
  if (acIndex >= 0) items[acIndex]?.scrollIntoView({ block: "nearest" })
}

// --- Search execution ---
function executeSearch(
  query: string,
  treeEl: HTMLElement,
  countEl: HTMLElement,
  historyEl: HTMLElement,
  input: HTMLInputElement,
  baseUrl: string,
) {
  addToHistory(query)
  renderHistory(historyEl, input)
  runSearch(query, treeEl, countEl, baseUrl)
  updateUrl(query)
}

function runSearch(query: string, treeEl: HTMLElement, countEl: HTMLElement, baseUrl: string) {
  if (!verseIndex) {
    treeEl.innerHTML = renderEmpty("Loading verse index...", [])
    return
  }

  // Normalize: try exact match first, then prefix match
  const q = query.trim()
  const matchingKeys = findMatchingVerses(q)

  if (matchingKeys.length === 0) {
    // Find suggestions from co-occurrence
    const suggestions = findSuggestions(q)
    treeEl.innerHTML = renderEmpty(
      `No notes reference "${q}" yet.`,
      suggestions,
    )
    countEl.textContent = ""
    return
  }

  // Apply section filter
  const filtered = filterBySection(matchingKeys)

  // Update filter chip counts
  updateFilterCountsForResults(matchingKeys)

  // Count total notes
  let totalNotes = 0
  for (const key of filtered) {
    totalNotes += verseIndex.index[key]?.length ?? 0
  }
  countEl.textContent = `${filtered.length} verse${filtered.length !== 1 ? "s" : ""} · ${totalNotes} note${totalNotes !== 1 ? "s" : ""}`

  // Render cards
  treeEl.innerHTML = filtered
    .map((key) => renderVerseCard(key, baseUrl))
    .join("")

  if (versesOnly) treeEl.classList.add("verses-only")
  else treeEl.classList.remove("verses-only")
}

function findMatchingVerses(query: string): string[] {
  if (!verseIndex) return []
  const q = query.toLowerCase().trim()

  // Exact match
  const exact = Object.keys(verseIndex.index).find((k) => k.toLowerCase() === q)
  if (exact) return [exact]

  // Range expansion: e.g. "John 5:3-9"
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

  // Prefix match: "John 5" matches "John 5:1", "John 5:2", etc.
  return Object.keys(verseIndex.index)
    .filter((k) => k.toLowerCase().startsWith(q))
    .sort((a, b) => {
      const aV = parseInt(a.split(":")[1] ?? "0")
      const bV = parseInt(b.split(":")[1] ?? "0")
      return aV - bV
    })
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
  // Try broader range
  const bookMatch = q.match(/^(.+?)\s+(\d+):(\d+)/)
  if (bookMatch) {
    const [, book, ch] = bookMatch
    const broader = `${book} ${ch}`
    const matches = Object.keys(verseIndex.index).filter((k) =>
      k.toLowerCase().startsWith(broader.toLowerCase()),
    )
    return matches.slice(0, 5)
  }
  return []
}

// --- Rendering ---
function renderVerseCard(verseKey: string, baseUrl: string): string {
  if (!verseIndex) return ""
  let entries = verseIndex.index[verseKey] ?? []

  // Filter entries by section if needed
  if (currentFilter !== "all") {
    entries = entries.filter((e) => e.folder === currentFilter)
  }

  const noteCount = entries.length
  const coVs = (verseIndex.cooccurrence[verseKey] ?? []).slice(0, 15)

  const notePills = entries
    .map((e) => {
      const href = `/${e.slug}`
      const label = sectionLabels[e.folder] ?? e.folder
      return `<a class="vc-note-pill" data-section="${e.folder}" href="${href}" title="${label}">${e.title}</a>`
    })
    .join("")

  const connChips = coVs
    .map((v) => `<button class="vc-conn-chip" data-ref="${v}">${v}</button>`)
    .join("")

  return `<div class="vc-card" data-ref="${verseKey}" role="button" tabindex="-1">
    <div class="vc-card-header" role="button" tabindex="0" aria-expanded="false">
      <span class="vc-card-arrow">&#x25B6;</span>
      <span class="vc-card-ref">${verseKey}</span>
      <span class="vc-card-meta">${noteCount} note${noteCount !== 1 ? "s" : ""}</span>
    </div>
    <div class="vc-card-body">
      <div class="vc-card-inner">
        <div class="vc-verse-text vc-shimmer">&nbsp;</div>
        <div class="vc-note-pills">${notePills}</div>
        ${
          connChips
            ? `<div class="vc-connected">
            <div class="vc-connected-label">Connected verses</div>
            <div class="vc-connected-chips">${connChips}</div>
          </div>`
            : ""
        }
      </div>
    </div>
  </div>`
}

function renderEmpty(message: string, suggestions: string[]): string {
  const suggHtml = suggestions.length
    ? `<div class="vc-empty-suggestion">Try: ${suggestions.map((s) => `<button class="vc-empty-link" data-ref="${s}">${s}</button>`).join(" · ")}</div>`
    : ""
  return `<div class="vc-empty"><div class="vc-empty-title">${message}</div>${suggHtml}</div>`
}

// --- Verse text fetching ---
async function fetchVerseText(ref: string): Promise<string | null> {
  // Check localStorage cache first
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
  } catch {
    return null
  }
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
  } catch {
    return null
  }
}

function saveVerseToCache(ref: string, text: string) {
  try {
    const raw = localStorage.getItem(VERSE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[ref] = { text, fetchedAt: Date.now() }
    const json = JSON.stringify(cache)
    if (json.length < 500_000) {
      localStorage.setItem(VERSE_CACHE_KEY, json)
    }
  } catch {
    // localStorage full or unavailable
  }
}

// --- History ---
function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
  } catch {
    return []
  }
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
    .map(
      (q) =>
        `<button class="vc-history-chip" data-query="${q}">${q}<span class="chip-x" data-remove="${q}">&times;</span></button>`,
    )
    .join("")

  // Re-attach click handlers via delegation
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
      input.dispatchEvent(new Event("input"))
      // Trigger search
      const treeEl = document.getElementById("vc-tree") as HTMLElement
      const countEl = document.getElementById("vc-count") as HTMLElement
      const baseUrl = document.querySelector(".verse-chain")?.getAttribute("data-base-url") ?? ""
      runSearch(q, treeEl, countEl, baseUrl)
      updateUrl(q)
    }
  }
}

// --- Filter counts ---
function updateFilterCounts(filtersEl: HTMLElement) {
  if (!filtersEl || !verseIndex) return
  filtersEl.querySelectorAll(".vc-filter-chip").forEach((btn) => {
    const filter = (btn as HTMLElement).dataset.filter
    if (filter === "all") return
    // Count total notes in this section
    let count = 0
    for (const entries of Object.values(verseIndex!.index)) {
      count += entries.filter((e) => e.folder === filter).length
    }
    const countSpan = btn.querySelector(".chip-count")
    if (countSpan) countSpan.textContent = `(${count})`
    else if (count > 0) btn.innerHTML += ` <span class="chip-count">(${count})</span>`
  })
}

function updateFilterCountsForResults(matchingKeys: string[]) {
  if (!verseIndex) return
  const filtersEl = document.getElementById("vc-filters")
  if (!filtersEl) return

  filtersEl.querySelectorAll(".vc-filter-chip").forEach((btn) => {
    const filter = (btn as HTMLElement).dataset.filter
    if (filter === "all") {
      let total = 0
      for (const key of matchingKeys) total += verseIndex!.index[key]?.length ?? 0
      const cs = btn.querySelector(".chip-count")
      if (cs) cs.textContent = `(${total})`
      else btn.innerHTML += ` <span class="chip-count">(${total})</span>`
      return
    }
    let count = 0
    for (const key of matchingKeys) {
      const entries = verseIndex!.index[key] ?? []
      count += entries.filter((e) => e.folder === filter).length
    }
    const cs = btn.querySelector(".chip-count")
    if (cs) cs.textContent = `(${count})`
    else if (count > 0) btn.innerHTML += ` <span class="chip-count">(${count})</span>`
  })
}

// --- URL state ---
function updateUrl(query: string) {
  const params = new URLSearchParams()
  if (query) params.set("v", query)
  if (currentFilter !== "all") params.set("f", currentFilter)
  const qs = params.toString()
  const newUrl = window.location.pathname + (qs ? `?${qs}` : "")
  if (newUrl !== window.location.pathname + window.location.search) {
    history.pushState(null, "", newUrl)
  }
}

// --- Export ---
function buildExportMarkdown(query: string): string {
  if (!verseIndex) return ""
  const keys = findMatchingVerses(query)
  const lines: string[] = [`## Verse Chain: ${query}`, ""]

  for (const key of keys) {
    const entries = verseIndex.index[key] ?? []
    lines.push(`### ${key}`)

    // Try to get cached verse text
    const cached = getVerseFromCache(key)
    if (cached) lines.push(`> ${cached}`, "")

    if (entries.length > 0) {
      lines.push(`Cited in ${entries.length} note${entries.length !== 1 ? "s" : ""}:`)
      for (const e of entries) {
        lines.push(`- [[${e.slug}]] · ${sectionLabels[e.folder] ?? e.folder}`)
      }
    }

    const coVs = verseIndex.cooccurrence[key] ?? []
    if (coVs.length > 0) {
      lines.push("", `Connected verses: ${coVs.join(" · ")}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// --- Toast ---
function showToast(message: string) {
  let toast = document.querySelector(".vc-toast") as HTMLElement
  if (!toast) {
    toast = document.createElement("div")
    toast.className = "vc-toast"
    document.body.appendChild(toast)
  }
  toast.textContent = message
  toast.classList.add("show")
  setTimeout(() => toast.classList.remove("show"), 2000)
}

// --- Graph view (D3 SVG) ---

const bookGroupColors: Record<string, string> = {
  pentateuch: "#f59e0b",
  historical: "#22c55e",
  wisdom: "#14b8a6",
  "major-prophets": "#3b82f6",
  "minor-prophets": "#6366f1",
  gospels: "#eab308",
  "acts-epistles": "#ef4444",
  revelation: "#a855f7",
  deuterocanonical: "#10b981",
  pseudepigrapha: "#f97316",
  "early-church": "#ec4899",
}

const bookGroupMap: Record<string, string> = {}
const groupDefs: [string, string[]][] = [
  ["pentateuch", ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]],
  ["historical", ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"]],
  ["wisdom", ["Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon"]],
  ["major-prophets", ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"]],
  ["minor-prophets", ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"]],
  ["gospels", ["Matthew", "Mark", "Luke", "John"]],
  ["acts-epistles", ["Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude"]],
  ["revelation", ["Revelation"]],
  ["deuterocanonical", ["Tobit", "Judith", "Wisdom of Solomon", "Sirach", "Baruch", "Letter of Jeremiah", "Additions to Esther", "Prayer of Azariah", "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees", "3 Maccabees", "4 Maccabees", "Prayer of Manasseh", "1 Esdras", "2 Esdras"]],
  ["pseudepigrapha", ["Jubilees", "Enoch"]],
  ["early-church", ["1 Clement"]],
]
for (const [group, names] of groupDefs) {
  for (const name of names) bookGroupMap[name] = group
}

function getVerseColor(ref: string): string {
  const book = ref.replace(/\s+\d.*/, "")
  const group = bookGroupMap[book] ?? "wisdom"
  return bookGroupColors[group] ?? "#14b8a6"
}

function nodeSize(count: number): number {
  return Math.min(Math.max(count * 2 + 6, 8), 24)
}

interface GraphNode {
  id: string
  type: "verse" | "note"
  label: string
  color: string
  count: number
  slug?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLink {
  source: GraphNode | string
  target: GraphNode | string
}

async function renderVerseGraph(query: string, graphEl: HTMLElement) {
  if (!verseIndex) return

  const d3 = await import("d3")

  const matchingKeys = findMatchingVerses(query)
  if (matchingKeys.length === 0) {
    graphEl.innerHTML = `<div class="vc-empty"><div class="vc-empty-title">No verses to graph</div></div>`
    return
  }

  graphEl.innerHTML = ""

  const width = graphEl.offsetWidth || 600
  const height = Math.max(graphEl.offsetHeight, 400)

  // Build nodes and links
  const nodesMap = new Map<string, GraphNode>()
  const links: GraphLink[] = []

  for (const key of matchingKeys) {
    const entries = verseIndex.index[key] ?? []
    const noteCount = currentFilter === "all"
      ? entries.length
      : entries.filter((e) => e.folder === currentFilter).length
    nodesMap.set(`v:${key}`, {
      id: `v:${key}`,
      type: "verse",
      label: key,
      color: getVerseColor(key),
      count: noteCount,
    })
  }

  for (const key of matchingKeys) {
    let entries = verseIndex.index[key] ?? []
    if (currentFilter !== "all") entries = entries.filter((e) => e.folder === currentFilter)
    for (const entry of entries) {
      const noteId = `n:${entry.slug}`
      if (!nodesMap.has(noteId)) {
        const secColor = sectionColors[entry.folder] ?? "#8b8b8b"
        nodesMap.set(noteId, {
          id: noteId, type: "note", label: entry.title, color: secColor, count: 1, slug: entry.slug,
        })
      }
      links.push({ source: `v:${key}`, target: noteId })
    }
  }

  // Connected verses (1 hop, capped)
  for (const key of matchingKeys) {
    const coVs = (verseIndex.cooccurrence[key] ?? []).slice(0, 8)
    for (const cv of coVs) {
      const cvId = `v:${cv}`
      if (!nodesMap.has(cvId)) {
        nodesMap.set(cvId, {
          id: cvId, type: "verse", label: cv, color: getVerseColor(cv), count: verseIndex.index[cv]?.length ?? 0,
        })
      }
      links.push({ source: `v:${key}`, target: cvId })
    }
  }

  const nodes = [...nodesMap.values()]

  const svg = d3.select(graphEl)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)

  const g = svg.append("g")

  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on("zoom", (event: any) => g.attr("transform", event.transform))

  svg.call(zoomBehavior)

  const simulation = d3.forceSimulation<GraphNode>(nodes)
    .force("charge", d3.forceManyBody().strength(-120))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80))
    .force("collide", d3.forceCollide<GraphNode>((d) => d.type === "verse" ? nodeSize(d.count) + 4 : 20))

  const link = g.selectAll(".vc-glink")
    .data(links)
    .join("line")
    .attr("class", "vc-glink")
    .attr("stroke", "var(--lightgray)")
    .attr("stroke-width", 1)
    .attr("stroke-opacity", 0.5)

  const node = g.selectAll<SVGGElement, GraphNode>(".vc-gnode")
    .data(nodes)
    .join("g")
    .attr("class", "vc-gnode")
    .attr("cursor", "pointer")
    .call(d3.drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null
      }) as any)

  node.filter((d) => d.type === "verse")
    .append("circle")
    .attr("r", (d) => nodeSize(d.count))
    .attr("fill", (d) => d.color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)

  node.filter((d) => d.type === "note")
    .append("rect")
    .attr("width", 12).attr("height", 12)
    .attr("x", -6).attr("y", -6)
    .attr("rx", 3)
    .attr("fill", (d) => d.color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)

  node.append("text")
    .text((d) => d.label.length > 22 ? d.label.slice(0, 20) + "…" : d.label)
    .attr("font-size", (d) => d.type === "verse" ? "10px" : "9px")
    .attr("font-weight", (d) => d.type === "verse" ? "600" : "400")
    .attr("fill", "var(--darkgray)")
    .attr("text-anchor", "middle")
    .attr("dy", (d) => d.type === "verse" ? nodeSize(d.count) + 12 : 18)
    .attr("pointer-events", "none")

  // Tooltip
  const tooltip = d3.select(graphEl)
    .append("div")
    .style("position", "absolute").style("display", "none")
    .style("background", "var(--dark)").style("color", "var(--light)")
    .style("padding", "4px 8px").style("border-radius", "6px")
    .style("font-size", "0.75rem").style("pointer-events", "none")
    .style("z-index", "10").style("white-space", "nowrap")

  node.on("mouseenter", (event: MouseEvent, d: GraphNode) => {
    const info = d.type === "verse"
      ? `${d.label} · ${d.count} note${d.count !== 1 ? "s" : ""}`
      : d.label
    tooltip.text(info).style("display", "block")
    const rect = graphEl.getBoundingClientRect()
    tooltip
      .style("left", `${event.clientX - rect.left + 10}px`)
      .style("top", `${event.clientY - rect.top - 20}px`)
  })
  .on("mouseleave", () => tooltip.style("display", "none"))

  // Click: verse → re-search, note → navigate
  node.on("click", (_event: MouseEvent, d: GraphNode) => {
    if (d.type === "verse") {
      const ref = d.label
      const inp = document.getElementById("vc-input") as HTMLInputElement
      if (inp) {
        inp.value = ref
        const tree = document.getElementById("vc-tree")!
        const cnt = document.getElementById("vc-count")!
        const hist = document.getElementById("vc-history")!
        const base = document.querySelector(".verse-chain")?.getAttribute("data-base-url") ?? ""
        executeSearch(ref, tree, cnt, hist, inp, base)
        // Re-render graph with new query
        renderVerseGraph(ref, graphEl)
      }
    } else if (d.slug) {
      window.spaNavigate?.(new URL(`/${d.slug}`, window.location.origin))
    }
  })

  // Hover highlight
  node.on("mouseenter.highlight", (_event: MouseEvent, d: GraphNode) => {
    const connected = new Set<string>([d.id])
    for (const l of links) {
      const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id
      const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id
      if (src === d.id) connected.add(tgt)
      if (tgt === d.id) connected.add(src)
    }
    node.attr("opacity", (n) => connected.has(n.id) ? 1 : 0.2)
    link.attr("stroke-opacity", (l: any) => {
      const s = typeof l.source === "string" ? l.source : l.source.id
      const t = typeof l.target === "string" ? l.target : l.target.id
      return connected.has(s) && connected.has(t) ? 0.8 : 0.08
    })
  })
  .on("mouseleave.highlight", () => {
    node.attr("opacity", 1)
    link.attr("stroke-opacity", 0.5)
  })

  simulation.on("tick", () => {
    link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y)
    node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
  })

  // Reset button
  const resetBtn = document.createElement("button")
  resetBtn.className = "vc-graph-reset"
  resetBtn.textContent = "Reset"
  resetBtn.onclick = () => svg.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity)
  graphEl.appendChild(resetBtn)
}

// --- Chain icons on verse links (global, runs on every page) ---
function injectChainIcons() {
  document.querySelectorAll("a[data-verse-ref]").forEach((el) => {
    if (el.nextElementSibling?.classList.contains("verse-chain-btn")) return
    const ref = el.getAttribute("data-verse-ref")!
    const btn = document.createElement("span")
    btn.className = "verse-chain-btn"
    btn.setAttribute("role", "link")
    btn.setAttribute("tabindex", "0")
    btn.setAttribute("aria-label", `Explore verse chain for ${ref}`)
    btn.title = "Explore verse chain"
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
    btn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.spaNavigate?.(new URL(`/Verse-Chain?v=${encodeURIComponent(ref)}`, window.location.origin))
    })
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        btn.click()
      }
    })
    el.parentNode?.insertBefore(btn, el.nextSibling)
  })
}

document.addEventListener("nav", init)
document.addEventListener("nav", injectChainIcons)
