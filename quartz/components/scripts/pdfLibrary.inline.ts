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
}

interface ExternalPdfEntry {
  title: string
  url: string
  description?: string
  isExternal: true
}

interface PdfGroupEntry {
  name: string
  items: Array<{ slug?: string; url?: string; label?: string }>
}

interface PdfIndex {
  local: PdfIndexEntry[]
  external: ExternalPdfEntry[]
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

  if (!grid || !filterInput) return

  // Prevent duplicate initialization
  if (grid.dataset.initialized === "true") return
  grid.dataset.initialized = "true"

  let allCards: HTMLElement[] = []

  // Render recent PDFs section
  renderRecentPdfs(grid)

  // Fetch PDF index
  fetch("/static/pdfIndex.json")
    .then((r) => r.json())
    .then((index: PdfIndex) => {
      // Build local PDF cards
      for (const entry of index.local) {
        const card = document.createElement("div")
        card.className = "pdf-card pdf-card-local"
        card.dataset.title = entry.title
        card.dataset.slug = entry.slug

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

        // Insert before external cards
        const firstExternal = grid.querySelector(".pdf-card-external")
        if (firstExternal) {
          grid.insertBefore(card, firstExternal)
        } else {
          grid.appendChild(card)
        }
      }

      // Wire up external card clicks — try viewer for .pdf URLs, fallback handled inside viewer
      grid.querySelectorAll<HTMLElement>(".pdf-card-external").forEach((card) => {
        card.addEventListener("click", () => {
          const url = card.dataset.url
          if (!url) return
          if (url.endsWith(".pdf") && window.__openPdfViewer) {
            window.__openPdfViewer(url, { title: card.dataset.title })
          } else {
            window.open(url, "_blank")
          }
        })
      })

      // Build grouped PDF cards
      if (index.groups && index.groups.length > 0) {
        for (const group of index.groups) {
          if (!group.items || group.items.length === 0) continue

          const card = document.createElement("div")
          card.className = "pdf-card pdf-card-group"
          card.dataset.title = group.name

          // Find thumbnail from the first local item in the group
          const firstLocal = group.items.find((i) => i.slug)
          const localEntry = firstLocal ? index.local.find((e) => e.slug === firstLocal.slug) : null
          const thumbHtml = localEntry
            ? `<div class="pdf-card-thumb"><img src="/${localEntry.thumbnail}" alt="" loading="lazy" />
                <span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span>
              </div>`
            : `<div class="pdf-card-thumb pdf-card-thumb-placeholder">
                <span class="pdf-card-badge pdf-card-badge-versions">${group.items.length} versions</span>
              </div>`

          card.innerHTML = `
            ${thumbHtml}
            <div class="pdf-card-info">
              <h3 class="pdf-card-title">${pdfLibEscapeHtml(group.name)}</h3>
              <select class="pdf-group-select" onclick="event.stopPropagation()">
                ${group.items.map((item, i) => {
                  const label = item.label || (item.slug ? index.local.find((e) => e.slug === item.slug)?.title || item.slug : item.url || "Version")
                  return `<option value="${i}">${pdfLibEscapeHtml(label)}</option>`
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
              if (item.url.endsWith(".pdf") && window.__openPdfViewer) {
                window.__openPdfViewer(item.url, { title: group.name })
              } else {
                window.open(item.url, "_blank")
              }
            }
          })

          grid.appendChild(card)
        }
      }

      // Collect all cards
      allCards = Array.from(grid.querySelectorAll<HTMLElement>(".pdf-card"))
      updateCount(allCards.length, allCards.length)

      // Check URL params for auto-open
      checkUrlForPdfOpen(index)
    })
    .catch((err) => {
      console.warn("[PdfLibrary] Failed to load PDF index:", err)
    })

  // Filter logic
  filterInput.addEventListener("input", () => {
    const query = filterInput.value.toLowerCase().trim()
    let visible = 0

    for (const card of allCards) {
      const title = (card.dataset.title || "").toLowerCase()
      const matches = !query || title.includes(query)
      card.classList.toggle("hidden", !matches)
      if (matches) visible++
    }

    updateCount(visible, allCards.length)
    if (emptyState) {
      emptyState.style.display = visible === 0 && allCards.length > 0 ? "block" : "none"
    }
  })

  function updateCount(visible: number, total: number) {
    if (countEl) {
      countEl.textContent = visible === total ? `${total} PDFs` : `${visible} of ${total} PDFs`
    }
  }

  function checkUrlForPdfOpen(index: PdfIndex) {
    const params = new URLSearchParams(window.location.search)
    const pdfSlug = params.get("pdf")
    if (pdfSlug && window.__openPdfViewer) {
      const pageNum = parseInt(params.get("page") || "1", 10)
      // Check if it's a valid local PDF
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
