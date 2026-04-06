// Topical Chain Navigator — right sidebar verse connections
// Scans page for data-verse-ref links, fetches verseIndex.json, shows connections

interface VerseIndexEntry {
  slug: string
  title: string
  folder: string
}

interface VerseIndexData {
  index: Record<string, VerseIndexEntry[]>
  cooccurrence: Record<string, string[]>
}

interface RangeGroup {
  label: string
  refs: string[]
}

function parseVerseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)$/)
  return m ? { book: m[1], chapter: parseInt(m[2]), verse: parseInt(m[3]) } : null
}

function consolidateRanges(refs: string[]): RangeGroup[] {
  if (refs.length === 0) return []
  const parsed = refs.map((r) => ({ ref: r, ...parseVerseRef(r) }))
  const withParsed = parsed.filter((p) => p.book)
  const without = parsed.filter((p) => !p.book).map((p) => ({ label: p.ref, refs: [p.ref] }))

  // Group by book+chapter
  const byChapter = new Map<string, { ref: string; verse: number }[]>()
  for (const p of withParsed) {
    const key = `${p.book} ${p.chapter}`
    if (!byChapter.has(key)) byChapter.set(key, [])
    byChapter.get(key)!.push({ ref: p.ref, verse: p.verse! })
  }

  const groups: RangeGroup[] = []
  for (const [chKey, verses] of byChapter) {
    verses.sort((a, b) => a.verse - b.verse)
    let rangeStart = verses[0]
    let rangeEnd = verses[0]
    const rangeRefs = [verses[0].ref]

    for (let i = 1; i < verses.length; i++) {
      if (verses[i].verse === rangeEnd.verse + 1) {
        rangeEnd = verses[i]
        rangeRefs.push(verses[i].ref)
      } else {
        const label = rangeStart.verse === rangeEnd.verse
          ? `${chKey}:${rangeStart.verse}`
          : `${chKey}:${rangeStart.verse}-${rangeEnd.verse}`
        groups.push({ label, refs: [...rangeRefs] })
        rangeStart = verses[i]
        rangeEnd = verses[i]
        rangeRefs.length = 0
        rangeRefs.push(verses[i].ref)
      }
    }
    const label = rangeStart.verse === rangeEnd.verse
      ? `${chKey}:${rangeStart.verse}`
      : `${chKey}:${rangeStart.verse}-${rangeEnd.verse}`
    groups.push({ label, refs: [...rangeRefs] })
  }

  return [...groups, ...without]
}

const sectionColors: Record<string, string> = {
  capture: "#8b8b8b",
  "in-progress": "#f59e0b",
  idiom: "#a855f7",
  complete: "#22c55e",
  rebukes: "#ef4444",
  daily: "#3b82f6",
}

// Cache the index globally
declare global {
  interface Window {
    _verseIndex?: VerseIndexData | null
  }
}

async function getVerseIndex(): Promise<VerseIndexData | null> {
  if (window._verseIndex !== undefined) return window._verseIndex
  try {
    const res = await fetch("/static/verseIndex.json")
    window._verseIndex = await res.json()
    return window._verseIndex!
  } catch {
    window._verseIndex = null
    return null
  }
}

function init() {
  const container = document.getElementById("topical-chain")
  const content = document.getElementById("tc-content")
  if (!container || !content) return

  // Find all verse refs on this page
  const verseLinks = document.querySelectorAll("a[data-verse-ref]")
  const refs = new Set<string>()
  verseLinks.forEach((el) => {
    const ref = el.getAttribute("data-verse-ref")
    if (ref) refs.add(ref)
  })

  // Hide entirely if no Bible references
  if (refs.size === 0) {
    container.style.display = "none"
    return
  }

  container.style.display = ""
  content.innerHTML = '<div class="tc-loading">Loading connections…</div>'

  // Get current page slug from URL
  const currentSlug = decodeURIComponent(window.location.pathname.replace(/^\//, ""))

  getVerseIndex().then((index) => {
    if (!index) {
      content.innerHTML = ""
      container.style.display = "none"
      return
    }
    renderConnections(content, index, refs, currentSlug)
  })
}

interface VerseGroup {
  ref: string
  notes: VerseIndexEntry[]
  coVerses: string[]
}

function renderConnections(
  content: HTMLElement,
  index: VerseIndexData,
  refs: Set<string>,
  currentSlug: string,
) {
  const groups: VerseGroup[] = []

  for (const ref of refs) {
    // Get notes for this verse, excluding current page
    const notes = (index.index[ref] ?? []).filter((e) => e.slug !== currentSlug)
    const coVerses = (index.cooccurrence[ref] ?? []).filter((v) => !refs.has(v)).slice(0, 8)

    if (notes.length > 0 || coVerses.length > 0) {
      groups.push({ ref, notes, coVerses })
    }
  }

  // Sort by connection count (most connected first)
  groups.sort((a, b) => (b.notes.length + b.coVerses.length) - (a.notes.length + a.coVerses.length))

  if (groups.length === 0) {
    content.innerHTML = ""
    content.closest(".topical-chain")!.style.display = "none"
    return
  }

  let html = ""
  groups.forEach((g, i) => {
    const noteCount = g.notes.length
    const notePills = g.notes
      .map((n) => {
        const color = sectionColors[n.folder] ?? "#8b8b8b"
        let displayTitle = n.title
        if (n.slug.startsWith("Daily/")) {
          const m = n.slug.match(/(\d{4}-\d{2}-\d{2})/)
          if (m) {
            const d = new Date(m[1] + "T12:00:00")
            displayTitle = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          }
        }
        return `<a class="tc-note-link" href="/${n.slug}" style="color:${color}">${displayTitle}</a>`
      })
      .join("")

    const coRanges = consolidateRanges(g.coVerses)
    const coChips = coRanges
      .map((rg) => `<a class="tc-co-chip" href="/Verse-Chain?v=${encodeURIComponent(rg.refs[0])}">${rg.label}</a>`)
      .join("")

    // First group starts expanded
    const expanded = i === 0 ? " expanded" : ""

    html += `<div class="tc-group${expanded}" data-idx="${i}">
      <button class="tc-verse-pill pressable" type="button" aria-expanded="${i === 0}">
        <span class="tc-chevron">&#9654;</span>
        <span class="tc-verse-label">${g.ref}</span>
        ${noteCount > 0 ? `<span class="tc-badge">${noteCount}</span>` : ""}
        <a href="/Verse-Chain?v=${encodeURIComponent(g.ref)}" class="tc-chain-link" data-tooltip="Open in Verse Chain" onclick="event.stopPropagation()" aria-label="Open ${g.ref} in Verse Chain">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </a>
      </button>
      <div class="tc-body">
        <div class="tc-body-inner">
          ${notePills ? `<div class="tc-notes">${notePills}</div>` : ""}
          ${coChips ? `<div class="tc-co-verses">${coChips}</div>` : ""}
        </div>
      </div>
    </div>`
  })

  content.innerHTML = html

  // Accordion click handlers
  content.querySelectorAll(".tc-verse-pill").forEach((pill) => {
    pill.addEventListener("click", (e) => {
      // Don't toggle if clicking the chain link icon
      if ((e.target as HTMLElement).closest(".tc-chain-link")) return
      e.preventDefault()

      const group = pill.closest(".tc-group") as HTMLElement
      const isExpanded = group.classList.contains("expanded")

      // Collapse all groups
      content.querySelectorAll(".tc-group.expanded").forEach((g) => {
        g.classList.remove("expanded")
        g.querySelector(".tc-verse-pill")?.setAttribute("aria-expanded", "false")
      })

      // Toggle: if it was collapsed, expand it
      if (!isExpanded) {
        group.classList.add("expanded")
        pill.setAttribute("aria-expanded", "true")
      }
    })
  })
}

document.addEventListener("nav", init)
