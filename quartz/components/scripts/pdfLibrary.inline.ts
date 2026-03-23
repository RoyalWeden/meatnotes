declare global {
  interface Window {
    __openPdfViewer?: (pdfUrl: string, opts?: { page?: number; title?: string }) => void
  }
}

interface PdfIndexEntry {
  slug: string
  title: string
  filename: string
  pageCount: number
  fileSize: number
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function renderRecentPdfs(grid: HTMLElement) {
  // Remove existing recent section
  grid.parentElement?.querySelector(".pdf-recent-section")?.remove()

  try {
    const recent: Array<{ slug: string; title: string; timestamp: number }> = JSON.parse(
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
          window.__openPdfViewer("/" + item.slug, { title: item.title })
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

  if (!grid || !filterInput) return

  // Prevent duplicate initialization
  if (grid.dataset.initialized === "true") return
  grid.dataset.initialized = "true"

  let allCards: HTMLElement[] = []
  let activeTag: string | null = null

  // Render recent PDFs section
  renderRecentPdfs(grid)

  function updateCount(visible: number, total: number) {
    if (countEl) {
      countEl.textContent = visible === total ? `${total} PDFs` : `${visible} of ${total} PDFs`
    }
  }

  function applyFilters() {
    const query = filterInput!.value.toLowerCase().trim()
    let visible = 0
    for (const card of allCards) {
      const title = (card.dataset.title || "").toLowerCase()
      const tags = (card.dataset.tags || "").split(",").filter(Boolean)
      const matchesTag = !activeTag || tags.includes(activeTag)
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

    // "All" chip
    const allChip = document.createElement("button")
    allChip.type = "button"
    allChip.className = "pdf-tag-chip pdf-tag-chip-active"
    allChip.textContent = "All"
    allChip.addEventListener("click", () => {
      activeTag = null
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
        activeTag = tag
        tagBar.querySelectorAll(".pdf-tag-chip").forEach((c) => c.classList.remove("pdf-tag-chip-active"))
        chip.classList.add("pdf-tag-chip-active")
        applyFilters()
      })
      tagBar.appendChild(chip)
    }
  }

  // Fetch PDF index
  fetch("/static/pdfIndex.json")
    .then((r) => r.json())
    .then((index: PdfIndex) => {
      // Build local PDF cards
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
          </div>
        `

        card.addEventListener("click", () => {
          if (window.__openPdfViewer) {
            window.__openPdfViewer("/" + entry.slug, { title: entry.title })
          }
        })

        grid.appendChild(card)
      }

      // Build external PDF cards
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
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span class="pdf-card-badge pdf-card-badge-external">External</span>
          </div>
          <div class="pdf-card-info">
            <h3 class="pdf-card-title">${pdfLibEscapeHtml(entry.title)}</h3>
            ${entry.description ? `<p class="pdf-card-desc">${pdfLibEscapeHtml(entry.description)}</p>` : ""}
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

      // Build web link cards
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
          </div>
        `

        card.addEventListener("click", () => {
          window.open(entry.url, "_blank")
        })

        grid.appendChild(card)
      }

      // Build grouped PDF cards
      if (index.groups && index.groups.length > 0) {
        for (const group of index.groups) {
          if (!group.items || group.items.length === 0) continue

          const card = document.createElement("div")
          card.className = "pdf-card pdf-card-group"
          card.dataset.title = group.name
          card.dataset.tags = (group.tags ?? []).join(",")

          // Find thumbnail: prefer first local item, then try first external .pdf URL
          const firstLocal = group.items.find((i) => i.slug)
          const localEntry = firstLocal ? index.local.find((e) => e.slug === firstLocal.slug) : null
          const firstExternalPdf = !localEntry
            ? group.items.find((i) => i.url && i.url.toLowerCase().endsWith(".pdf"))
            : null

          let thumbHtml: string
          if (localEntry) {
            thumbHtml = `<div class="pdf-card-thumb">
              <img src="/${localEntry.thumbnail}" alt="" loading="lazy" />
              <span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span>
            </div>`
          } else if (firstExternalPdf) {
            thumbHtml = `<div class="pdf-card-thumb">
              <div class="pdf-card-thumb-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span>
            </div>`
          } else {
            thumbHtml = `<div class="pdf-card-thumb pdf-card-thumb-placeholder">
              <span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span>
            </div>`
          }

          card.innerHTML = `
            ${thumbHtml}
            <div class="pdf-card-info">
              <h3 class="pdf-card-title">${pdfLibEscapeHtml(group.name)}</h3>
              <select class="pdf-group-select" onclick="event.stopPropagation()">
                ${group.items.map((item, i) => {
                  const label = item.label || (item.slug ? index.local.find((e) => e.slug === item.slug)?.title || item.slug : item.url || "Version")
                  return `<option value="${i}">${pdfLibEscapeHtml(label ?? "")}</option>`
                }).join("")}
              </select>
            </div>
          `

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

      // Collect all cards and set up filtering
      allCards = Array.from(grid.querySelectorAll<HTMLElement>(".pdf-card"))
      updateCount(allCards.length, allCards.length)

      // Build tag chips
      buildTagChips()

      // Wire text search (applyFilters handles both tag + text)
      filterInput.addEventListener("input", applyFilters)

      // Check URL params for auto-open
      checkUrlForPdfOpen(index)
    })
    .catch((err) => {
      console.warn("[PdfLibrary] Failed to load PDF index:", err)
    })

  function checkUrlForPdfOpen(index: PdfIndex) {
    const params = new URLSearchParams(window.location.search)
    const pdfSlug = params.get("pdf")
    if (pdfSlug && window.__openPdfViewer) {
      const pageNum = parseInt(params.get("page") || "1", 10)
      const entry = index.local.find((e) => e.slug === pdfSlug)
      if (entry) {
        window.__openPdfViewer("/" + entry.slug, { page: pageNum })
      }
    }
  }
}

function pdfLibEscapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

initPdfLibrary()
document.addEventListener("nav", () => initPdfLibrary())
