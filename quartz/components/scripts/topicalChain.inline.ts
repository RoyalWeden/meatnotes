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
        return `<a class="tc-note-link" href="/${n.slug}" style="color:${color}">${n.title}</a>`
      })
      .join("")

    const coChips = g.coVerses
      .map((v) => `<a class="tc-co-chip" href="/Verse-Chain?v=${encodeURIComponent(v)}">${v}</a>`)
      .join("")

    // First group starts expanded
    const expanded = i === 0 ? " expanded" : ""

    html += `<div class="tc-group${expanded}" data-idx="${i}">
      <button class="tc-verse-pill" type="button" aria-expanded="${i === 0}">
        <span class="tc-chevron">&#9654;</span>
        <a href="/Verse-Chain?v=${encodeURIComponent(g.ref)}" class="tc-verse-ref" onclick="event.stopPropagation()">${g.ref}</a>
        ${noteCount > 0 ? `<span class="tc-badge">${noteCount}</span>` : ""}
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
      // Don't toggle if clicking the verse ref link itself
      if ((e.target as HTMLElement).closest(".tc-verse-ref")) return

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
