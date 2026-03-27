declare global {
  interface Window {
    __openPdfViewer?: (pdfUrl: string, opts?: { page?: number; title?: string; version?: number }) => void
  }
}

interface PdfIndexEntry {
  slug: string
  title: string
  filename: string
  pageCount: number
  fileSize: number
  lastModified: number
  thumbnail: string
  isExternal: false
  hidden?: boolean
  tags?: string[]
}

interface ExternalPdfEntry {
  title: string
  url: string
  description?: string
  isExternal: true
  hidden?: boolean
  tags?: string[]
}

interface WebLinkEntry {
  title: string
  url: string
  description?: string
  isLink: true
  tags?: string[]
}

interface PdfGroupEntry {
  name: string
  tags?: string[]
  items: Array<{ slug?: string; url?: string; label?: string; hidden?: boolean }>
}

interface PdfIndex {
  local: PdfIndexEntry[]
  external: ExternalPdfEntry[]
  links: WebLinkEntry[]
  groups: PdfGroupEntry[]
}

type SortMode = "az" | "za" | "recent"
type ViewMode = "compact" | "spacious" | "list"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function renderRecentPdfs(grid: HTMLElement) {
  grid.parentElement?.querySelector(".pdf-recent-section")?.remove()

  try {
    const recent: Array<{ slug: string; title: string; timestamp: number; lastModified?: number }> = JSON.parse(
      localStorage.getItem("pdf-recent") || "[]"
    )
    if (recent.length === 0) return

    const section = document.createElement("div")
    section.className = "pdf-recent-section"
    section.innerHTML = `<h3 class="pdf-recent-header">Recently Opened</h3>`

    const row = document.createElement("div")
    row.className = "pdf-recent-row"

    for (const item of recent) {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "pdf-recent-chip"
      chip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>${pdfLibEscapeHtml(item.title)}</span>`
      chip.addEventListener("click", () => {
        if (window.__openPdfViewer) {
          window.__openPdfViewer("/" + item.slug, { title: item.title, version: item.lastModified })
        }
      })
      row.appendChild(chip)
    }

    section.appendChild(row)
    grid.parentElement?.insertBefore(section, grid)
  } catch {}
}

function initPdfLibrary() {
  const grid = document.getElementById("pdf-cards-grid")
  const filterInput = document.querySelector(".pdf-filter-input") as HTMLInputElement | null
  const countEl = document.getElementById("pdf-count")
  const emptyState = document.getElementById("pdf-empty-state")
  const tagBar = document.getElementById("pdf-tag-bar")
  const sortBtn = document.getElementById("pdf-sort-btn")
  const sortLabel = document.getElementById("pdf-sort-label")
  const pdfPage = document.querySelector<HTMLElement>(".pdf-library-page")

  if (!grid || !filterInput) return
  if (grid.dataset.initialized === "true") return
  grid.dataset.initialized = "true"

  let allCards: HTMLElement[] = []
  const activeTags = new Set<string>()
  let sortMode: SortMode = (localStorage.getItem("pdf-sort") as SortMode) || "az"
  const viewMode: ViewMode = (localStorage.getItem("pdf-view") as ViewMode) || "compact"

  // Apply saved view mode immediately
  applyViewMode(viewMode)

  // Restore sort label
  const sortLabels: Record<SortMode, string> = { az: "A→Z", za: "Z→A", recent: "Recent" }
  if (sortLabel) sortLabel.textContent = sortLabels[sortMode]

  renderRecentPdfs(grid)

  function updateCount(visible: number, total: number) {
    if (countEl) {
      countEl.textContent = visible === total ? `${total} PDFs` : `${visible} of ${total} PDFs`
    }
  }

  function applyViewMode(mode: ViewMode) {
    if (!pdfPage) return
    pdfPage.setAttribute("data-pdf-view", mode)
    document.querySelectorAll(".pdf-view-btn").forEach((btn) => {
      btn.classList.toggle("pdf-view-btn-active", (btn as HTMLElement).dataset.view === mode)
    })
    localStorage.setItem("pdf-view", mode)
  }

  function applySortMode(mode: SortMode) {
    sortMode = mode
    localStorage.setItem("pdf-sort", mode)
    if (sortLabel) sortLabel.textContent = sortLabels[mode]

    const recentSlugs: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem("pdf-recent") || "[]").map((r: any) => r.slug || r.url || "")
      } catch { return [] }
    })()

    const sorted = [...allCards].sort((a, b) => {
      const ta = (a.dataset.title || "").toLowerCase()
      const tb = (b.dataset.title || "").toLowerCase()
      if (mode === "za") return tb.localeCompare(ta)
      if (mode === "recent") {
        const ai = recentSlugs.indexOf(a.dataset.slug || a.dataset.url || "")
        const bi = recentSlugs.indexOf(b.dataset.slug || b.dataset.url || "")
        if (ai === -1 && bi === -1) return ta.localeCompare(tb)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      }
      return ta.localeCompare(tb)
    })

    for (const card of sorted) grid.appendChild(card)
    applyFilters()
  }

  function applyFilters() {
    const query = filterInput!.value.toLowerCase().trim()
    let visible = 0
    for (const card of allCards) {
      const title = (card.dataset.title || "").toLowerCase()
      const tags = (card.dataset.tags || "").split(",").filter(Boolean)
      const matchesTag = activeTags.size === 0 || tags.some((t) => activeTags.has(t))
      const matchesSearch = !query || title.includes(query)
      const show = matchesTag && matchesSearch
      card.classList.toggle("hidden", !show)
      if (show) visible++
    }
    updateCount(visible, allCards.length)
    if (emptyState) {
      emptyState.style.display = visible === 0 && allCards.length > 0 ? "block" : "none"
    }
  }

  function buildTagChips() {
    if (!tagBar) return
    const tagSet = new Set<string>()
    for (const card of allCards) {
      for (const t of (card.dataset.tags || "").split(",").filter(Boolean)) tagSet.add(t)
    }
    if (tagSet.size === 0) return

    tagBar.style.display = "flex"

    const allChip = document.createElement("button")
    allChip.type = "button"
    allChip.className = "pdf-tag-chip pdf-tag-chip-active"
    allChip.textContent = "All"
    allChip.addEventListener("click", () => {
      activeTags.clear()
      tagBar.querySelectorAll(".pdf-tag-chip").forEach((c) => c.classList.remove("pdf-tag-chip-active"))
      allChip.classList.add("pdf-tag-chip-active")
      applyFilters()
    })
    tagBar.appendChild(allChip)

    for (const tag of [...tagSet].sort()) {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "pdf-tag-chip"
      chip.textContent = tag
      chip.addEventListener("click", () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag)
          chip.classList.remove("pdf-tag-chip-active")
        } else {
          activeTags.add(tag)
          chip.classList.add("pdf-tag-chip-active")
        }
        allChip.classList.toggle("pdf-tag-chip-active", activeTags.size === 0)
        applyFilters()
      })
      tagBar.appendChild(chip)
    }
  }

  // View toggle buttons
  document.querySelectorAll<HTMLElement>(".pdf-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.view as ViewMode
      if (mode) applyViewMode(mode)
    })
  })

  // Sort button (cycles az → za → recent → az)
  const sortCycle: SortMode[] = ["az", "za", "recent"]
  sortBtn?.addEventListener("click", () => {
    const next = sortCycle[(sortCycle.indexOf(sortMode) + 1) % sortCycle.length]
    applySortMode(next)
  })

  // Text search
  filterInput.addEventListener("input", applyFilters)

  // Fetch PDF index
  fetch("/static/pdfIndex.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((index: PdfIndex) => {
      // Local PDF cards
      for (const entry of index.local) {
        if (entry.hidden) continue
        const card = document.createElement("div")
        card.className = "pdf-card pdf-card-local"
        card.dataset.title = entry.title
        card.dataset.slug = entry.slug
        card.dataset.tags = (entry.tags ?? []).join(",")
        card.innerHTML = `
          <div class="pdf-card-thumb">
            <img src="/${entry.thumbnail}" alt="" loading="lazy" />
            <span class="pdf-card-badge-pages">${entry.pageCount} pages</span>
            <span class="pdf-card-badge-size">${formatFileSize(entry.fileSize)}</span>
          </div>
          <div class="pdf-card-info">
            <h3 class="pdf-card-title">${pdfLibEscapeHtml(entry.title)}</h3>
            <span class="pdf-card-meta">${entry.pageCount ? entry.pageCount + " pages · " : ""}${formatFileSize(entry.fileSize)}</span>
          </div>
        `
        card.addEventListener("click", () => {
          if (window.__openPdfViewer) window.__openPdfViewer("/" + entry.slug, { title: entry.title, version: entry.lastModified })
        })
        grid.appendChild(card)
      }

      // External PDF cards
      for (const entry of index.external) {
        if (entry.hidden) continue
        const card = document.createElement("div")
        card.className = "pdf-card pdf-card-external"
        card.dataset.title = entry.title
        card.dataset.url = entry.url
        card.dataset.tags = (entry.tags ?? []).join(",")
        card.innerHTML = `
          <div class="pdf-card-thumb">
            <div class="pdf-card-thumb-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span class="pdf-card-badge pdf-card-badge-external">External</span>
          </div>
          <div class="pdf-card-info">
            <h3 class="pdf-card-title">${pdfLibEscapeHtml(entry.title)}</h3>
            ${entry.description ? `<p class="pdf-card-desc">${pdfLibEscapeHtml(entry.description)}</p>` : ""}
            <span class="pdf-card-meta">External PDF</span>
          </div>
        `
        card.addEventListener("click", () => {
          if (entry.url.toLowerCase().endsWith(".pdf") && window.__openPdfViewer) {
            window.__openPdfViewer(entry.url, { title: entry.title })
          } else {
            window.open(entry.url, "_blank")
          }
        })
        grid.appendChild(card)
      }

      // Web link cards
      for (const entry of index.links ?? []) {
        const card = document.createElement("div")
        card.className = "pdf-card pdf-card-link"
        card.dataset.title = entry.title
        card.dataset.url = entry.url
        card.dataset.tags = (entry.tags ?? []).join(",")
        card.innerHTML = `
          <div class="pdf-card-thumb">
            <div class="pdf-card-thumb-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <span class="pdf-card-badge pdf-card-badge-link">Link</span>
          </div>
          <div class="pdf-card-info">
            <h3 class="pdf-card-title">${pdfLibEscapeHtml(entry.title)}</h3>
            ${entry.description ? `<p class="pdf-card-desc">${pdfLibEscapeHtml(entry.description)}</p>` : ""}
            <span class="pdf-card-meta">Web link</span>
          </div>
        `
        card.addEventListener("click", () => window.open(entry.url, "_blank"))
        grid.appendChild(card)
      }

      // Group cards
      if (index.groups && index.groups.length > 0) {
        for (const group of index.groups) {
          if (!group.items || group.items.length === 0) continue
          const card = document.createElement("div")
          card.className = "pdf-card pdf-card-group"
          card.dataset.title = group.name
          card.dataset.tags = (group.tags ?? []).join(",")

          const firstLocal = group.items.find((i) => i.slug)
          const localEntry = firstLocal ? index.local.find((e) => e.slug === firstLocal.slug) : null
          const firstExternalPdf = !localEntry
            ? group.items.find((i) => i.url && i.url.toLowerCase().endsWith(".pdf"))
            : null

          const thumbHtml = localEntry
            ? `<div class="pdf-card-thumb"><img src="/${localEntry.thumbnail}" alt="" loading="lazy" /><span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span></div>`
            : firstExternalPdf
              ? `<div class="pdf-card-thumb"><div class="pdf-card-thumb-placeholder"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span></div>`
              : `<div class="pdf-card-thumb pdf-card-thumb-placeholder"><span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span></div>`

          card.innerHTML = `${thumbHtml}
            <div class="pdf-card-info">
              <h3 class="pdf-card-title">${pdfLibEscapeHtml(group.name)}</h3>
              <select class="pdf-group-select" onclick="event.stopPropagation()">
                ${group.items.map((item, i) => {
                  const label = item.label || (item.slug ? index.local.find((e) => e.slug === item.slug)?.title || item.slug : item.url || "Version")
                  return `<option value="${i}">${pdfLibEscapeHtml(label ?? "")}</option>`
                }).join("")}
              </select>
              <span class="pdf-card-meta">${group.items.length} versions</span>
            </div>`

          card.addEventListener("click", () => {
            const select = card.querySelector(".pdf-group-select") as HTMLSelectElement
            const idx = parseInt(select?.value || "0", 10)
            const item = group.items[idx]
            if (!item) return
            if (item.slug && window.__openPdfViewer) {
              window.__openPdfViewer("/" + item.slug, { title: group.name })
            } else if (item.url) {
              if (item.url.toLowerCase().endsWith(".pdf") && window.__openPdfViewer) {
                window.__openPdfViewer(item.url, { title: group.name })
              } else {
                window.open(item.url, "_blank")
              }
            }
          })
          grid.appendChild(card)
        }
      }

      // Hide search preview placeholder now that grid is populated
      const previewPlaceholder = document.getElementById("pdf-search-preview")
      if (previewPlaceholder) previewPlaceholder.style.display = "none"

      // Collect cards, apply saved sort, build chips
      allCards = Array.from(grid.querySelectorAll<HTMLElement>(".pdf-card"))
      applySortMode(sortMode)
      buildTagChips()
      updateCount(allCards.length, allCards.length)

      // URL auto-open
      const params = new URLSearchParams(window.location.search)
      const pdfSlug = params.get("pdf")
      if (pdfSlug && window.__openPdfViewer) {
        const pageNum = parseInt(params.get("page") || "1", 10)
        const entry = index.local.find((e) => e.slug === pdfSlug)
        if (entry) window.__openPdfViewer("/" + entry.slug, { page: pageNum })
      }
    })
    .catch((err) => console.warn("[PdfLibrary] Failed to load PDF index:", err))
}

function pdfLibEscapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

initPdfLibrary()
document.addEventListener("nav", () => initPdfLibrary())
