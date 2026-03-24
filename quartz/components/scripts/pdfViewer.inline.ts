// PDF Viewer Modal — loads PDF.js dynamically and renders PDFs in a modal overlay

let pdfjsLib: any = null
let currentDoc: any = null
let currentScale = 1.5
let currentPageNum = 1
let totalPages = 0
let currentPdfUrl = ""
let renderedPages = new Set<number>()
let pageContainers: HTMLElement[] = []
let scrollLocked = false
let savedScrollY = 0
let isViewerOpen = false

// Sidebar state
let sidebarOpen = true
let activeTab: "toc" | "search" | "annotations" = "toc"
let searchMatches: Array<{ pageNum: number; text: string; index: number }> = []
let currentMatchIndex = -1
let searchHitLimit = false
let pageTextContents: Map<number, string> = new Map()

const isMobile = () => window.matchMedia("(max-width: 800px)").matches

function lockScroll() {
  if (scrollLocked) return
  savedScrollY = window.scrollY
  document.body.style.position = "fixed"
  document.body.style.top = `-${savedScrollY}px`
  document.body.style.width = "100%"
  document.body.style.overflow = "hidden"
  scrollLocked = true
}

function unlockScroll() {
  if (!scrollLocked) return
  document.body.style.position = ""
  document.body.style.top = ""
  document.body.style.width = ""
  document.body.style.overflow = ""
  window.scrollTo(0, savedScrollY)
  scrollLocked = false
}

function formatFileTitle(url: string): string {
  const name = decodeURIComponent(url.split("/").pop() || "PDF")
    .replace(/\.pdf$/i, "")
    .replace(/-/g, " ")
  return name
}

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib
  // Use indirect import to prevent esbuild from resolving at build time
  const pdfPath = ["/static", "pdf.min.mjs"].join("/")
  const workerPath = ["/static", "pdf.worker.min.mjs"].join("/")
  pdfjsLib = await (new Function("p", "return import(p)"))(pdfPath)
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath
  return pdfjsLib
}

function createModal(): HTMLElement {
  let modal = document.getElementById("pdf-viewer-modal")
  if (!modal) {
    modal = document.createElement("div")
    modal.id = "pdf-viewer-modal"
    modal.className = "pdf-viewer-modal"
    document.body.appendChild(modal)
  }

  const mobile = isMobile()

  modal.innerHTML = `
    <div class="pdf-viewer-overlay"></div>
    <div class="pdf-viewer-container" tabindex="-1">
      <div class="pdf-viewer-toolbar">
        <div class="pdf-toolbar-left">
          <button class="pdf-tb-btn pdf-sidebar-toggle" title="Toggle sidebar" aria-label="Toggle sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          ${mobile ? `
          <button class="pdf-tb-btn pdf-mobile-menu-btn" title="Menu" aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          ` : ""}
          <span class="pdf-toolbar-title"></span>
        </div>
        <div class="pdf-toolbar-center">
          <span class="pdf-page-indicator">
            Page <span class="pdf-current-page">1</span> / <span class="pdf-total-pages">1</span>
          </span>
        </div>
        <div class="pdf-toolbar-right">
          <button class="pdf-tb-btn pdf-zoom-out" title="Zoom out (-)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <span class="pdf-zoom-level">100%</span>
          <button class="pdf-tb-btn pdf-zoom-in" title="Zoom in (+)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/>
            </svg>
          </button>
          <button class="pdf-tb-btn pdf-fit-width" title="Fit to width">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <div class="pdf-toolbar-sep"></div>
          <button class="pdf-tb-btn pdf-copy-link" title="Copy link to PDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <button class="pdf-tb-btn pdf-copy-page-link" title="Copy link to this page">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="pdf-tb-btn pdf-open-tab" title="Open in new tab">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          <button class="pdf-tb-btn pdf-download" title="Download PDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="pdf-tb-btn pdf-shortcuts-btn" title="Keyboard shortcuts">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          ${mobile ? `
          <button class="pdf-tb-btn pdf-mobile-share-btn" title="Share & Actions">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
          ` : ""}
          <div class="pdf-toolbar-sep"></div>
          <button class="pdf-tb-btn pdf-close" title="Close (Escape)">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="pdf-progress-track"><div class="pdf-progress-bar"></div></div>
      <div class="pdf-viewer-body">
        <div class="pdf-sidebar">
          <div class="pdf-sidebar-tabs">
            <button class="pdf-sidebar-tab active" data-tab="toc">Contents</button>
            <button class="pdf-sidebar-tab" data-tab="search">Search</button>
            <button class="pdf-sidebar-tab" data-tab="annotations">Notes</button>
          </div>
          <div class="pdf-sidebar-panel pdf-sidebar-toc active" data-panel="toc">
            <div class="pdf-sidebar-loading">Loading...</div>
          </div>
          <div class="pdf-sidebar-panel pdf-sidebar-search" data-panel="search">
            <div class="pdf-search-input-wrap">
              <input type="text" class="pdf-search-input" placeholder="Search in PDF..." />
              <div class="pdf-search-nav">
                <span class="pdf-search-count"></span>
                <button class="pdf-search-prev" title="Previous (Shift+Enter)" disabled>&#9650;</button>
                <button class="pdf-search-next" title="Next (Enter)" disabled>&#9660;</button>
              </div>
            </div>
            <div class="pdf-search-results"></div>
          </div>
          <div class="pdf-sidebar-panel pdf-sidebar-annotations" data-panel="annotations">
            <div class="pdf-sidebar-loading">Loading...</div>
          </div>
        </div>
        <div class="pdf-pages-container">
          <div class="pdf-pages-scroll" id="pdf-pages-scroll">
            <div class="pdf-loading-spinner">
              <div class="pdf-spinner"></div>
              <span>Loading PDF...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${mobile ? `
    <div class="pdf-bottom-sheet" id="pdf-bottom-sheet">
      <div class="pdf-bottom-sheet-handle"></div>
      <div class="pdf-bottom-sheet-actions">
        <button class="pdf-bs-action pdf-bs-copy-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <span>Copy Link</span>
        </button>
        <button class="pdf-bs-action pdf-bs-copy-page-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy Page</span>
        </button>
        <button class="pdf-bs-action pdf-bs-open-tab">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span>Open Tab</span>
        </button>
        <button class="pdf-bs-action pdf-bs-download">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Download</span>
        </button>
      </div>
      <div class="pdf-sidebar-tabs">
        <button class="pdf-sidebar-tab active" data-tab="toc">Contents</button>
        <button class="pdf-sidebar-tab" data-tab="search">Search</button>
        <button class="pdf-sidebar-tab" data-tab="annotations">Notes</button>
      </div>
      <div class="pdf-sidebar-panel pdf-sidebar-toc active" data-panel="toc">
        <div class="pdf-sidebar-loading">Loading...</div>
      </div>
      <div class="pdf-sidebar-panel pdf-sidebar-search" data-panel="search">
        <div class="pdf-search-input-wrap">
          <input type="text" class="pdf-search-input" placeholder="Search in PDF..." />
          <div class="pdf-search-nav">
            <span class="pdf-search-count"></span>
            <button class="pdf-search-prev" title="Previous" disabled>&#9650;</button>
            <button class="pdf-search-next" title="Next" disabled>&#9660;</button>
          </div>
        </div>
        <div class="pdf-search-results"></div>
      </div>
      <div class="pdf-sidebar-panel pdf-sidebar-annotations" data-panel="annotations">
        <div class="pdf-sidebar-loading">Loading...</div>
      </div>
    </div>
    ` : ""}
    <div class="pdf-toast" id="pdf-toast"></div>
  `

  return modal
}

function showToast(message: string) {
  const toast = document.getElementById("pdf-toast")
  if (!toast) return
  toast.textContent = message
  toast.classList.add("visible")
  setTimeout(() => toast.classList.remove("visible"), 2000)
}

function showCopyFeedback(button: Element) {
  const originalSvg = button.innerHTML
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  button.classList.add("pdf-btn-copied")
  setTimeout(() => {
    button.innerHTML = originalSvg
    button.classList.remove("pdf-btn-copied")
  }, 1500)
}

function updatePageIndicator() {
  const modal = document.getElementById("pdf-viewer-modal")
  if (!modal) return
  const curEl = modal.querySelector(".pdf-current-page")
  const totalEl = modal.querySelector(".pdf-total-pages")
  if (curEl) curEl.textContent = String(currentPageNum)
  if (totalEl) totalEl.textContent = String(totalPages)

  // Update zoom level display
  const zoomEl = modal.querySelector(".pdf-zoom-level")
  if (zoomEl) zoomEl.textContent = Math.round(currentScale * 100) + "%"

  // Update URL silently
  if (currentPdfUrl) {
    const slug = currentPdfUrl.replace(/^\//, "")
    const url = new URL(window.location.href)
    url.searchParams.set("pdf", slug)
    url.searchParams.set("page", String(currentPageNum))
    history.replaceState(null, "", url.toString())
  }
}

function detectCurrentPage() {
  const scrollEl = document.getElementById("pdf-pages-scroll")
  if (!scrollEl || pageContainers.length === 0) return

  const scrollTop = scrollEl.scrollTop
  const scrollMid = scrollTop + scrollEl.clientHeight / 3

  for (let i = pageContainers.length - 1; i >= 0; i--) {
    if (pageContainers[i].offsetTop <= scrollMid) {
      if (currentPageNum !== i + 1) {
        currentPageNum = i + 1
        updatePageIndicator()
        // Save reading progress
        saveReadingProgress()
      }
      break
    }
  }
}

function saveReadingProgress() {
  if (!currentPdfUrl) return
  try {
    const key = "pdf-progress"
    const data: Record<string, { page: number; timestamp: number }> = JSON.parse(localStorage.getItem(key) || "{}")
    const slug = currentPdfUrl.replace(/^\//, "")
    data[slug] = { page: currentPageNum, timestamp: Date.now() }

    // Clean up entries older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    for (const k of Object.keys(data)) {
      if (data[k].timestamp < cutoff) delete data[k]
    }

    localStorage.setItem(key, JSON.stringify(data))
  } catch {}
}

function getSavedProgress(pdfUrl: string): number | null {
  try {
    const data: Record<string, { page: number; timestamp: number }> = JSON.parse(localStorage.getItem("pdf-progress") || "{}")
    const slug = pdfUrl.replace(/^\//, "")
    return data[slug]?.page || null
  } catch {
    return null
  }
}

async function renderPage(pageNum: number) {
  if (renderedPages.has(pageNum) || !currentDoc) return
  renderedPages.add(pageNum)

  const container = pageContainers[pageNum - 1]
  if (!container) return

  try {
    const page = await currentDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: currentScale })

    container.style.width = viewport.width + "px"
    container.style.height = viewport.height + "px"
    container.innerHTML = "" // Clear placeholder

    // Canvas
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width * (window.devicePixelRatio || 1)
    canvas.height = viewport.height * (window.devicePixelRatio || 1)
    canvas.style.width = viewport.width + "px"
    canvas.style.height = viewport.height + "px"
    const ctx = canvas.getContext("2d")!
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
    container.appendChild(canvas)

    await page.render({ canvasContext: ctx, viewport }).promise

    // Page number label
    const pageLabel = document.createElement("div")
    pageLabel.className = "pdf-page-number-label"
    pageLabel.textContent = String(pageNum)
    container.appendChild(pageLabel)

    // Text layer (pdfjs-dist v4 uses TextLayer class)
    const textContent = await page.getTextContent()
    const textDiv = document.createElement("div")
    textDiv.className = "pdf-text-layer"
    // Set --scale-factor for PDF.js v4 TextLayer font sizing
    textDiv.style.setProperty("--scale-factor", String(viewport.scale))
    container.appendChild(textDiv)

    try {
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textDiv,
        viewport,
      })
      await textLayer.render()
    } catch {
      // Text layer rendering is non-critical
    }

    // Store text content for search
    const textStr = textContent.items.map((item: any) => item.str).join(" ")
    pageTextContents.set(pageNum, textStr)

    // Annotation layer
    try {
      const annotations = await page.getAnnotations({ intent: "any" })
      if (annotations.length > 0) {
        // Debug logging for annotation detection
        console.log(`[PDF] Page ${pageNum} annotations:`, annotations.map((a: any) => ({
          sub: a.subtype, hasRect: !!a.rect, hasQP: !!a.quadPoints,
          contents: (a.contentsObj?.str || a.contents || "").substring(0, 50), color: a.color
        })))

        const annotDiv = document.createElement("div")
        annotDiv.className = "pdf-annotation-layer"
        annotDiv.style.width = viewport.width + "px"
        annotDiv.style.height = viewport.height + "px"
        container.appendChild(annotDiv)

        for (const annot of annotations) {
          // Skip annotations without rect AND without quadPoints (nothing to render)
          if (!annot.rect && !annot.quadPoints) continue

          // Skip Popup annotations — they are note containers, not visual elements
          if (annot.subtype === "Popup") continue

          // PDF.js v4 uses contentsObj.str instead of contents
          const annotContents = annot.contentsObj?.str || annot.contents || ""

          const isHighlight = annot.subtype === "Highlight" || annot.subtype === "Underline" ||
            annot.subtype === "StrikeOut" || annot.subtype === "Squiggly"
          const opacity = isHighlight ? 0.35 : 0.2
          const [r, g, b] = annot.color || [255, 255, 0]

          // Use quadPoints for multi-line highlights if available
          if (isHighlight && annot.quadPoints && annot.quadPoints.length >= 8) {
            // Each quad is 8 values: [x1,y1,x2,y2,x3,y3,x4,y4]
            for (let q = 0; q < annot.quadPoints.length; q += 8) {
              const qp = annot.quadPoints.slice(q, q + 8)
              const qMinX = Math.min(qp[0], qp[2], qp[4], qp[6])
              const qMaxX = Math.max(qp[0], qp[2], qp[4], qp[6])
              const qMinY = Math.min(qp[1], qp[3], qp[5], qp[7])
              const qMaxY = Math.max(qp[1], qp[3], qp[5], qp[7])
              const qRect = viewport.convertToViewportRectangle([qMinX, qMinY, qMaxX, qMaxY])
              const el = document.createElement("div")
              el.className = `pdf-annot pdf-annot-${annot.subtype}`
              el.style.left = Math.min(qRect[0], qRect[2]) + "px"
              el.style.top = Math.min(qRect[1], qRect[3]) + "px"
              el.style.width = Math.abs(qRect[2] - qRect[0]) + "px"
              el.style.height = Math.abs(qRect[3] - qRect[1]) + "px"
              el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`
              if (annotContents) el.title = annotContents
              annotDiv.appendChild(el)
            }
          } else if (annot.rect) {
            const [x1, y1, x2, y2] = annot.rect
            const rect = viewport.convertToViewportRectangle([x1, y1, x2, y2])
            const left = Math.min(rect[0], rect[2])
            const top = Math.min(rect[1], rect[3])
            const width = Math.abs(rect[2] - rect[0])
            const height = Math.abs(rect[3] - rect[1])

            const el = document.createElement("div")
            el.className = `pdf-annot pdf-annot-${annot.subtype || "unknown"}`
            el.style.left = left + "px"
            el.style.top = top + "px"
            el.style.width = width + "px"
            el.style.height = height + "px"
            el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`

            if (annotContents) {
              el.title = annotContents
            }

            // Handle link annotations
            if (annot.subtype === "Link" && annot.url) {
              el.style.cursor = "pointer"
              el.addEventListener("click", (e) => {
                e.preventDefault()
                window.open(annot.url, "_blank")
              })
            }

            // Show note icon for Text (sticky note) annotations
            if (annot.subtype === "Text" && annotContents) {
              el.style.width = "24px"
              el.style.height = "24px"
              el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.8)`
              el.style.borderRadius = "4px"
              el.style.cursor = "pointer"
              el.style.display = "flex"
              el.style.alignItems = "center"
              el.style.justifyContent = "center"
              el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
              el.addEventListener("click", (e) => {
                e.stopPropagation()
                // Show popover with note content
                let popover = el.querySelector(".pdf-note-popover") as HTMLElement | null
                if (popover) {
                  popover.remove()
                  return
                }
                popover = document.createElement("div")
                popover.className = "pdf-note-popover"
                popover.textContent = annotContents
                el.appendChild(popover)
                // Close on outside click
                const close = (ev: MouseEvent) => {
                  if (!el.contains(ev.target as Node)) {
                    popover?.remove()
                    document.removeEventListener("click", close)
                  }
                }
                setTimeout(() => document.addEventListener("click", close), 0)
              })
            }

            annotDiv.appendChild(el)
          }
        }
      }
    } catch {
      // Annotations optional
    }
  } catch (e) {
    console.warn(`[PdfViewer] Failed to render page ${pageNum}:`, e)
    container.innerHTML = `<div class="pdf-page-error">Failed to load page ${pageNum}</div>`
  }
}

function renderVisiblePages() {
  const scrollEl = document.getElementById("pdf-pages-scroll")
  if (!scrollEl) return

  const scrollTop = scrollEl.scrollTop
  const viewHeight = scrollEl.clientHeight
  const buffer = viewHeight // Render 1 viewport worth of buffer

  for (let i = 0; i < pageContainers.length; i++) {
    const container = pageContainers[i]
    const top = container.offsetTop
    const bottom = top + container.offsetHeight

    // Check if page is within viewport + buffer
    if (bottom >= scrollTop - buffer && top <= scrollTop + viewHeight + buffer) {
      renderPage(i + 1)
    }
  }
}

async function loadToc(container: HTMLElement) {
  if (!currentDoc) return

  try {
    const outline = await currentDoc.getOutline()
    if (!outline || outline.length === 0) {
      container.innerHTML = '<div class="pdf-sidebar-empty">No table of contents available</div>'
      return
    }

    function buildOutlineList(items: any[], level: number): string {
      return `<ul class="pdf-toc-list pdf-toc-level-${level}">` +
        items.map((item: any) => {
          const hasChildren = item.items && item.items.length > 0
          return `<li class="pdf-toc-item">
            <a class="pdf-toc-link" data-dest='${JSON.stringify(item.dest)}' title="${escapeAttr(item.title)}">
              ${pdfViewerEscapeHtml(item.title)}
            </a>
            ${hasChildren ? buildOutlineList(item.items, level + 1) : ""}
          </li>`
        }).join("") +
        "</ul>"
    }

    container.innerHTML = `<div class="pdf-toc-filter-wrap">
      <input type="text" class="pdf-toc-filter" placeholder="Filter contents..." />
    </div>` + buildOutlineList(outline, 0)

    // Wire up TOC filter with parent-child awareness
    const filterInput = container.querySelector(".pdf-toc-filter") as HTMLInputElement
    if (filterInput) {
      filterInput.addEventListener("input", () => {
        const q = filterInput.value.toLowerCase()
        const allItems = container.querySelectorAll<HTMLElement>(".pdf-toc-item")

        if (!q) {
          // Show everything when filter is empty
          allItems.forEach((item) => item.style.display = "")
          return
        }

        // First pass: hide all
        allItems.forEach((item) => item.style.display = "none")

        // Second pass: for each item that matches, show it + all ancestors + all descendants
        allItems.forEach((item) => {
          const link = item.querySelector(":scope > .pdf-toc-link")
          const text = link?.textContent?.toLowerCase() || ""
          if (!text.includes(q)) return

          // Show this item
          item.style.display = ""

          // Show all ancestors
          let parent = item.parentElement?.closest(".pdf-toc-item") as HTMLElement | null
          while (parent) {
            parent.style.display = ""
            parent = parent.parentElement?.closest(".pdf-toc-item") as HTMLElement | null
          }

          // Show all descendants
          item.querySelectorAll<HTMLElement>(".pdf-toc-item").forEach((child) => {
            child.style.display = ""
          })
        })
      })
    }

    // Wire up TOC clicks
    container.querySelectorAll<HTMLElement>(".pdf-toc-link").forEach((link) => {
      link.addEventListener("click", async () => {
        try {
          const destData = JSON.parse(link.dataset.dest || "null")
          if (!destData || !currentDoc) return

          let dest = destData
          if (typeof destData === "string") {
            dest = await currentDoc.getDestination(destData)
          }

          if (dest) {
            const ref = dest[0]
            const pageIndex = await currentDoc.getPageIndex(ref)
            scrollToPage(pageIndex + 1)
          }
        } catch {
          // Navigation failed silently
        }
      })
    })
  } catch {
    container.innerHTML = '<div class="pdf-sidebar-empty">Failed to load table of contents</div>'
  }
}

async function extractTextAtRect(pageProxy: any, rect: number[]): Promise<string> {
  try {
    const textContent = await pageProxy.getTextContent()
    const [ax1, ay1, ax2, ay2] = rect
    const minX = Math.min(ax1, ax2)
    const maxX = Math.max(ax1, ax2)
    const minY = Math.min(ay1, ay2)
    const maxY = Math.max(ay1, ay2)

    // Collect text items that overlap the annotation rect (using full bounding box)
    const overlapping: Array<{ str: string; x: number; y: number; w: number }> = []
    for (const item of textContent.items) {
      if (!item.str || !item.transform) continue
      const tx = item.transform[4]  // left edge (x origin)
      const ty = item.transform[5]  // baseline (y origin)
      const tw = item.width || 0
      const th = item.height || Math.abs(item.transform[3]) || 12

      // Item bounding box
      const itemLeft = tx
      const itemRight = tx + tw
      const itemBottom = ty
      const itemTop = ty + th

      // Check bounding box overlap (with small tolerance)
      const tol = 2
      if (itemRight > minX - tol && itemLeft < maxX + tol &&
          itemTop > minY - tol && itemBottom < maxY + tol) {
        overlapping.push({ str: item.str, x: tx, y: ty, w: tw })
      }
    }

    // Sort by Y descending (top to bottom in PDF coords), then X ascending (left to right)
    overlapping.sort((a, b) => {
      const dy = b.y - a.y
      if (Math.abs(dy) > 5) return dy
      return a.x - b.x
    })

    return overlapping.map(i => i.str).join(" ").trim()
  } catch {
    return ""
  }
}

async function loadAnnotations(container: HTMLElement) {
  if (!currentDoc) return
  const doc = currentDoc // capture reference to detect if viewer was closed/reopened

  const annotationItems: Array<{ pageNum: number; content: string; color?: number[]; subtype: string; highlightedText: string }> = []

  container.innerHTML = `<div class="pdf-sidebar-loading">Scanning annotations... (0/${totalPages})</div>`

  for (let i = 1; i <= totalPages; i++) {
    // Abort if the document changed (viewer was closed/reopened)
    if (currentDoc !== doc) return

    // Update progress every 10 pages
    if (i % 10 === 0) {
      const loadingEl = container.querySelector(".pdf-sidebar-loading")
      if (loadingEl) loadingEl.textContent = `Scanning annotations... (${i}/${totalPages})`
      // Yield to let UI update
      await new Promise(r => setTimeout(r, 0))
    }

    try {
      const page = await doc.getPage(i)
      const annotations = await page.getAnnotations({ intent: "any" })

      for (const annot of annotations) {
        // Skip Popup annotations — they are containers, not user annotations
        if (annot.subtype === "Popup") continue

        // Show any annotation that has contents, richText, or is a markup/note type
        const markupTypes = ["Highlight", "Text", "FreeText", "StrikeOut",
          "Underline", "Squiggly", "Stamp", "Ink", "Caret", "Redact"]
        // PDF.js v4 stores contents in contentsObj.str, richText as string or obj
        const contentStr = annot.contentsObj?.str || annot.contents || ""
        const richTextStr = typeof annot.richText === "string"
          ? annot.richText.replace(/<[^>]*>/g, "")
          : annot.richText?.str || ""
        const hasContent = contentStr || richTextStr
        const isMarkup = markupTypes.includes(annot.subtype)
        if (!hasContent && !isMarkup) continue

        {
          // Use note text if available, otherwise leave empty (highlighted text will be shown instead)
          const content = contentStr || richTextStr || ""

          // Extract highlighted text for markup annotations (Highlight, Underline, StrikeOut, Squiggly)
          let highlightedText = ""
          const textMarkupTypes = ["Highlight", "Underline", "StrikeOut", "Squiggly"]
          if (textMarkupTypes.includes(annot.subtype)) {
            if (annot.quadPoints && annot.quadPoints.length >= 8) {
              const texts: string[] = []
              for (let q = 0; q < annot.quadPoints.length; q += 8) {
                const qp = annot.quadPoints.slice(q, q + 8)
                const qMinX = Math.min(qp[0], qp[2], qp[4], qp[6])
                const qMaxX = Math.max(qp[0], qp[2], qp[4], qp[6])
                const qMinY = Math.min(qp[1], qp[3], qp[5], qp[7])
                const qMaxY = Math.max(qp[1], qp[3], qp[5], qp[7])
                const text = await extractTextAtRect(page, [qMinX, qMinY, qMaxX, qMaxY])
                if (text) texts.push(text)
              }
              highlightedText = texts.join(" ")
            } else if (annot.rect) {
              highlightedText = await extractTextAtRect(page, annot.rect)
            }
          }

          // Fallback: use contents as highlighted text if extraction failed
          if (textMarkupTypes.includes(annot.subtype) && !highlightedText && contentStr) {
            highlightedText = contentStr
          }

          annotationItems.push({
            pageNum: i,
            content,
            color: annot.color,
            subtype: annot.subtype,
            highlightedText: highlightedText || (markupTypes.includes(annot.subtype) && !content ? "(text not extractable)" : ""),
          })
        }
      }
    } catch {
      // Skip pages that fail
    }
  }

  if (annotationItems.length === 0) {
    container.innerHTML = '<div class="pdf-sidebar-empty">No annotations found</div>'
    return
  }

  let html = `<div class="pdf-annotations-list">`
  let currentGroup = -1

  for (const item of annotationItems) {
    if (item.pageNum !== currentGroup) {
      if (currentGroup !== -1) html += "</div>"
      html += `<div class="pdf-annot-group">
        <div class="pdf-annot-group-header">Page ${item.pageNum}</div>`
      currentGroup = item.pageNum
    }

    const colorStyle = item.color
      ? `border-left: 3px solid rgb(${item.color.join(",")})`
      : ""

    html += `<div class="pdf-annot-item" data-page="${item.pageNum}" style="${colorStyle}">
      <span class="pdf-annot-type">${item.subtype}</span>
      ${item.highlightedText ? `<span class="pdf-annot-highlighted">"${pdfViewerEscapeHtml(item.highlightedText)}"</span>` : ""}
      <span class="pdf-annot-text">${pdfViewerEscapeHtml(item.content)}</span>
    </div>`
  }

  html += "</div></div>"
  container.innerHTML = html

  // Wire up clicks
  container.querySelectorAll<HTMLElement>(".pdf-annot-item").forEach((el) => {
    el.addEventListener("click", () => {
      const pageNum = parseInt(el.dataset.page || "1", 10)
      scrollToPage(pageNum)
    })
  })
}

function scrollToPage(pageNum: number) {
  if (pageNum < 1 || pageNum > totalPages) return
  const scrollEl = document.getElementById("pdf-pages-scroll")
  const container = pageContainers[pageNum - 1]
  if (!scrollEl || !container) return

  renderPage(pageNum) // Ensure page is rendered
  scrollEl.scrollTo({ top: container.offsetTop, behavior: "smooth" })
}

// In-PDF search
const MAX_SEARCH_MATCHES = 200

async function performSearch(query: string) {
  searchMatches = []
  currentMatchIndex = -1

  if (!query.trim() || !currentDoc) {
    updateSearchUI()
    clearSearchHighlights()
    return
  }

  // Block single-character queries always
  if (query.trim().length < 2) {
    searchMatches = []
    currentMatchIndex = -1
    // Show message in count element
    const modal = document.getElementById("pdf-viewer-modal")
    const bottomSheet = document.getElementById("pdf-bottom-sheet")
    for (const container of [modal, bottomSheet].filter(Boolean) as HTMLElement[]) {
      const countEl = container.querySelector(".pdf-search-count")
      if (countEl) countEl.textContent = "Type at least 2 characters"
    }
    clearSearchHighlights()
    return
  }

  const lowerQuery = query.toLowerCase()
  searchHitLimit = false

  // Ensure all pages have text extracted
  for (let i = 1; i <= totalPages; i++) {
    if (!pageTextContents.has(i)) {
      try {
        const page = await currentDoc.getPage(i)
        const textContent = await page.getTextContent()
        const text = textContent.items.map((item: any) => item.str).join(" ")
        pageTextContents.set(i, text)
      } catch {
        pageTextContents.set(i, "")
      }
    }
  }

  // Find matches
  for (let i = 1; i <= totalPages; i++) {
    if (searchHitLimit) break
    const text = pageTextContents.get(i) || ""
    const lowerText = text.toLowerCase()
    let pos = 0

    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
      if (searchMatches.length >= MAX_SEARCH_MATCHES) {
        searchHitLimit = true
        break
      }
      // Extract context
      const start = Math.max(0, pos - 30)
      const end = Math.min(text.length, pos + query.length + 30)
      const contextText = (start > 0 ? "..." : "") +
        text.slice(start, pos) +
        "<<" + text.slice(pos, pos + query.length) + ">>" +
        text.slice(pos + query.length, end) +
        (end < text.length ? "..." : "")

      searchMatches.push({
        pageNum: i,
        text: contextText,
        index: searchMatches.length,
      })
      pos += query.length
    }
  }

  // Dynamic limit: if short query produces too many results relative to PDF size, block it
  if (query.trim().length < 3 && (searchHitLimit || searchMatches.length > totalPages * 2)) {
    searchMatches = []
    currentMatchIndex = -1
    const modal = document.getElementById("pdf-viewer-modal")
    const bottomSheet = document.getElementById("pdf-bottom-sheet")
    for (const container of [modal, bottomSheet].filter(Boolean) as HTMLElement[]) {
      const countEl = container.querySelector(".pdf-search-count")
      if (countEl) countEl.textContent = "Too many results — type a longer query"
    }
    clearSearchHighlights()
    return
  }

  updateSearchUI()

  if (searchMatches.length > 0) {
    navigateToMatch(0)
  }
}

function updateSearchUI() {
  const modal = document.getElementById("pdf-viewer-modal")
  const bottomSheet = document.getElementById("pdf-bottom-sheet")
  const containers = [modal, bottomSheet].filter(Boolean) as HTMLElement[]

  for (const container of containers) {
    const countEl = container.querySelector(".pdf-search-count")
    const prevBtn = container.querySelector(".pdf-search-prev") as HTMLButtonElement | null
    const nextBtn = container.querySelector(".pdf-search-next") as HTMLButtonElement | null
    const resultsEl = container.querySelector(".pdf-search-results")

    if (countEl) {
      if (searchHitLimit) {
        countEl.textContent = `${currentMatchIndex + 1} / ${MAX_SEARCH_MATCHES}+`
      } else if (searchMatches.length > 0) {
        countEl.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`
      } else {
        countEl.textContent = pageTextContents.size > 0 ? "No results" : ""
      }
    }

    if (prevBtn) prevBtn.disabled = searchMatches.length === 0
    if (nextBtn) nextBtn.disabled = searchMatches.length === 0

    if (resultsEl) {
      if (searchMatches.length === 0) {
        resultsEl.innerHTML = ""
      } else {
        resultsEl.innerHTML = searchMatches.map((m, i) => {
          const highlighted = m.text
            .replace(/<<(.*?)>>/g, '<mark class="pdf-search-highlight-text">$1</mark>')
          return `<div class="pdf-search-result${i === currentMatchIndex ? " active" : ""}" data-index="${i}">
            <span class="pdf-search-result-page">Page ${m.pageNum}</span>
            <span class="pdf-search-result-context">${highlighted}</span>
          </div>`
        }).join("")

        // Wire up clicks
        resultsEl.querySelectorAll<HTMLElement>(".pdf-search-result").forEach((el) => {
          el.addEventListener("click", () => {
            const idx = parseInt(el.dataset.index || "0", 10)
            navigateToMatch(idx)
          })
        })

        // Scroll active result into view
        const activeResult = resultsEl.querySelector(".pdf-search-result.active")
        if (activeResult) {
          activeResult.scrollIntoView({ block: "nearest" })
        }
      }
    }
  }
}

function navigateToMatch(index: number) {
  if (searchMatches.length === 0) return
  currentMatchIndex = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length
  const match = searchMatches[currentMatchIndex]
  scrollToPage(match.pageNum)
  updateSearchUI()

  // Highlight matching text on the page (delay for scroll + render to complete)
  clearSearchHighlights()
  setTimeout(() => highlightMatchOnPage(match.pageNum), 400)
}

function highlightMatchOnPage(pageNum: number) {
  const container = pageContainers[pageNum - 1]
  if (!container) return

  const textLayer = container.querySelector(".pdf-text-layer")
  if (!textLayer) return

  // Get the current search query from the input
  const searchInput = document.querySelector(".pdf-viewer-modal .pdf-search-input") as HTMLInputElement
  if (!searchInput || !searchInput.value.trim()) return
  const query = searchInput.value.trim().toLowerCase()

  const spans = textLayer.querySelectorAll("span")
  for (const span of spans) {
    const text = (span.textContent || "").toLowerCase()
    const matchIdx = text.indexOf(query)
    if (matchIdx === -1) continue

    // Use Range to measure exact bounds of the matched substring
    const textNode = span.firstChild
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue

    try {
      const range = document.createRange()
      range.setStart(textNode, matchIdx)
      range.setEnd(textNode, matchIdx + query.length)
      const rects = range.getClientRects()
      const containerRect = container.getBoundingClientRect()

      for (const rect of rects) {
        const overlay = document.createElement("div")
        overlay.className = "pdf-search-highlight-overlay"
        overlay.style.left = (rect.left - containerRect.left + container.scrollLeft) + "px"
        overlay.style.top = (rect.top - containerRect.top + container.scrollTop) + "px"
        overlay.style.width = rect.width + "px"
        overlay.style.height = rect.height + "px"
        container.appendChild(overlay)
      }
    } catch {
      // Fallback: highlight entire span
      const spanEl = span as HTMLElement
      const textLayerEl = textLayer as HTMLElement
      const overlay = document.createElement("div")
      overlay.className = "pdf-search-highlight-overlay"
      overlay.style.left = (spanEl.offsetLeft + textLayerEl.offsetLeft) + "px"
      overlay.style.top = (spanEl.offsetTop + textLayerEl.offsetTop) + "px"
      overlay.style.width = spanEl.offsetWidth + "px"
      overlay.style.height = spanEl.offsetHeight + "px"
      container.appendChild(overlay)
    }
  }
}

function clearSearchHighlights() {
  // Remove highlight overlays
  document.querySelectorAll(".pdf-search-highlight-overlay").forEach((el) => el.remove())
}

function pdfViewerEscapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function setupBottomSheetDrag(sheet: HTMLElement): void {
  const handle = sheet.querySelector(".pdf-bottom-sheet-handle") as HTMLElement | null
  if (!handle) return

  const SNAP_POINTS = [35, 60, 92]  // vh
  const DISMISS_VELOCITY = 0.5      // px/ms — positive = moving downward
  const DISMISS_HEIGHT_VH = 20      // vh threshold: dismiss on release below this

  let dragStartY = 0
  let dragStartHeightPx = 0
  let lastY = 0
  let lastTime = 0
  let velocity = 0

  function snapTo(vh: number): void {
    sheet.style.setProperty("--sheet-height", `${vh}vh`)
  }

  function dismiss(): void {
    sheet.classList.remove("open")
    snapTo(60)  // reset to default for next open
  }

  function snapToNearest(currentVH: number): void {
    const best = SNAP_POINTS.reduce((a, b) =>
      Math.abs(b - currentVH) < Math.abs(a - currentVH) ? b : a
    )
    snapTo(best)
  }

  handle.addEventListener("touchstart", (e: TouchEvent) => {
    dragStartY = e.touches[0].clientY
    lastY = dragStartY
    lastTime = performance.now()
    velocity = 0
    dragStartHeightPx = sheet.getBoundingClientRect().height
    sheet.classList.add("dragging")
  }, { passive: true })

  handle.addEventListener("touchmove", (e: TouchEvent) => {
    e.preventDefault()  // Prevent page scroll during drag (requires passive: false)
    const now = performance.now()
    const y = e.touches[0].clientY
    const dt = now - lastTime
    if (dt > 0) velocity = (y - lastY) / dt  // positive = dragging down
    lastY = y
    lastTime = now

    const dy = y - dragStartY  // positive = finger moved down = sheet gets smaller
    const vhPerPx = window.innerHeight / 100
    const newVH = Math.max(10, Math.min(95, (dragStartHeightPx - dy) / vhPerPx))
    sheet.style.setProperty("--sheet-height", `${newVH}vh`)
  }, { passive: false })

  handle.addEventListener("touchend", () => {
    sheet.classList.remove("dragging")
    const currentVH = sheet.getBoundingClientRect().height / (window.innerHeight / 100)
    if (velocity > DISMISS_VELOCITY || currentVH < DISMISS_HEIGHT_VH) {
      dismiss()
    } else {
      snapToNearest(currentVH)
    }
  }, { passive: true })
}

function wireUpEvents(modal: HTMLElement) {
  // Close
  modal.querySelector(".pdf-close")?.addEventListener("click", closePdfViewer)
  modal.querySelector(".pdf-viewer-overlay")?.addEventListener("click", closePdfViewer)

  // Keyboard shortcuts overlay
  const shortcutsBtn = modal.querySelector(".pdf-shortcuts-btn")
  shortcutsBtn?.addEventListener("click", () => {
    let overlay = modal.querySelector(".pdf-shortcuts-overlay") as HTMLElement | null
    if (overlay) {
      overlay.remove()
      return
    }
    overlay = document.createElement("div")
    overlay.className = "pdf-shortcuts-overlay"
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
    const mod = isMac ? "\u2318" : "Ctrl"
    overlay.innerHTML = `
      <div class="pdf-shortcuts-panel">
        <h3>Keyboard Shortcuts</h3>
        <div class="pdf-shortcut-row"><kbd>Esc</kbd><span>Close viewer</span></div>
        <div class="pdf-shortcut-row"><kbd>${mod}+F</kbd><span>Search in PDF</span></div>
        <div class="pdf-shortcut-row"><kbd>\u2190</kbd> <kbd>\u2192</kbd><span>Previous / Next page</span></div>
        <div class="pdf-shortcut-row"><kbd>+</kbd> <kbd>-</kbd><span>Zoom in / out</span></div>
        <div class="pdf-shortcut-row"><kbd>${mod}+Scroll</kbd><span>Pinch zoom</span></div>
      </div>
    `
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove()
    })
    modal.querySelector(".pdf-viewer-container")?.appendChild(overlay)
  })

  // Sidebar toggle
  modal.querySelector(".pdf-sidebar-toggle")?.addEventListener("click", () => {
    sidebarOpen = !sidebarOpen
    modal.querySelector(".pdf-viewer-body")?.classList.toggle("sidebar-collapsed", !sidebarOpen)
  })

  // Sidebar tabs
  const tabContainers = [modal, document.getElementById("pdf-bottom-sheet")].filter(Boolean) as HTMLElement[]
  for (const tabContainer of tabContainers) {
    tabContainer.querySelectorAll<HTMLElement>(".pdf-sidebar-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab as typeof activeTab
        if (!tabName) return
        activeTab = tabName

        // Update all tab containers
        for (const tc of tabContainers) {
          tc.querySelectorAll(".pdf-sidebar-tab").forEach((t) =>
            t.classList.toggle("active", (t as HTMLElement).dataset.tab === tabName))
          tc.querySelectorAll(".pdf-sidebar-panel").forEach((p) =>
            p.classList.toggle("active", (p as HTMLElement).dataset.panel === tabName))
        }
      })
    })
  }

  // Clickable page number → editable input
  const pageIndicator = modal.querySelector(".pdf-page-indicator")
  if (pageIndicator) {
    const currentPageSpan = pageIndicator.querySelector(".pdf-current-page") as HTMLElement
    if (currentPageSpan) {
      currentPageSpan.style.cursor = "pointer"
      currentPageSpan.title = "Click to jump to page"
      currentPageSpan.addEventListener("click", () => {
        const input = document.createElement("input")
        input.type = "number"
        input.className = "pdf-page-input"
        input.min = "1"
        input.max = String(totalPages)
        input.value = String(currentPageNum)
        currentPageSpan.style.display = "none"
        currentPageSpan.parentElement!.insertBefore(input, currentPageSpan)
        input.focus()
        input.select()

        const commit = () => {
          const val = parseInt(input.value, 10)
          if (val >= 1 && val <= totalPages) scrollToPage(val)
          input.remove()
          currentPageSpan.style.display = ""
        }
        input.addEventListener("blur", commit)
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); input.blur() }
          if (e.key === "Escape") { input.value = String(currentPageNum); input.blur() }
        })
      })
    }
  }

  // Clickable zoom level → editable input
  const zoomLevelSpan = modal.querySelector(".pdf-zoom-level") as HTMLElement
  if (zoomLevelSpan) {
    zoomLevelSpan.style.cursor = "pointer"
    zoomLevelSpan.title = "Click to set zoom"
    zoomLevelSpan.addEventListener("click", () => {
      const input = document.createElement("input")
      input.type = "number"
      input.className = "pdf-zoom-input"
      input.min = "50"
      input.max = "400"
      input.value = String(Math.round(currentScale * 100))
      zoomLevelSpan.style.display = "none"
      zoomLevelSpan.parentElement!.insertBefore(input, zoomLevelSpan)
      input.focus()
      input.select()

      const commit = () => {
        const val = parseInt(input.value, 10)
        if (val >= 50 && val <= 400) {
          const targetScale = val / 100
          zoom(targetScale - currentScale)
        }
        input.remove()
        zoomLevelSpan.style.display = ""
      }
      input.addEventListener("blur", commit)
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); input.blur() }
        if (e.key === "Escape") { input.value = String(Math.round(currentScale * 100)); input.blur() }
      })
    })
  }

  // Zoom
  modal.querySelector(".pdf-zoom-in")?.addEventListener("click", () => zoom(0.1))
  modal.querySelector(".pdf-zoom-out")?.addEventListener("click", () => zoom(-0.1))

  // Download with progress
  const downloadBtn = modal.querySelector(".pdf-download") as HTMLButtonElement | null
  downloadBtn?.addEventListener("click", async () => {
    if (downloadBtn.disabled) return
    downloadBtn.disabled = true
    const originalHTML = downloadBtn.innerHTML
    downloadBtn.textContent = "0%"
    downloadBtn.style.fontSize = "0.65rem"
    downloadBtn.style.minWidth = "32px"

    try {
      const response = await fetch(currentPdfUrl)
      const contentLength = response.headers.get("Content-Length")
      const total = contentLength ? parseInt(contentLength, 10) : 0

      if (!response.body || !total) {
        // Fallback: no streaming support or unknown size
        downloadBtn.textContent = "..."
        const blob = await response.blob()
        triggerDownload(blob)
        return
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        const pct = Math.round((received / total) * 100)
        downloadBtn.textContent = pct + "%"
      }

      const blob = new Blob(chunks, { type: "application/pdf" })
      triggerDownload(blob)
    } catch {
      window.open(currentPdfUrl, "_blank")
    } finally {
      downloadBtn.innerHTML = originalHTML
      downloadBtn.style.fontSize = ""
      downloadBtn.style.minWidth = ""
      downloadBtn.disabled = false
    }

    function triggerDownload(blob: Blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      // Smart filename: use PDF title if available, otherwise extract from URL
      const urlFilename = decodeURIComponent(currentPdfUrl.split("/").pop() || "document.pdf")
      const title = modal.querySelector(".pdf-title")?.textContent?.trim()
      a.download = title ? title.replace(/[/\\?%*:|"<>]/g, "-") + ".pdf" : urlFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  })

  // Open in new tab
  modal.querySelector(".pdf-open-tab")?.addEventListener("click", () => {
    window.open(currentPdfUrl, "_blank")
  })

  // Copy link
  const copyLinkBtn = modal.querySelector(".pdf-copy-link")
  copyLinkBtn?.addEventListener("click", () => {
    const slug = currentPdfUrl.replace(/^\//, "")
    const url = `${window.location.origin}/Books-and-PDFs?pdf=${encodeURIComponent(slug)}`
    navigator.clipboard.writeText(url).then(() => showCopyFeedback(copyLinkBtn))
  })

  // Copy page link
  const copyPageLinkBtn = modal.querySelector(".pdf-copy-page-link")
  copyPageLinkBtn?.addEventListener("click", () => {
    const slug = currentPdfUrl.replace(/^\//, "")
    const url = `${window.location.origin}/Books-and-PDFs?pdf=${encodeURIComponent(slug)}&page=${currentPageNum}`
    navigator.clipboard.writeText(url).then(() => showCopyFeedback(copyPageLinkBtn))
  })

  // Search
  const bottomSheet = document.getElementById("pdf-bottom-sheet")

  // Wire all search inputs (modal + bottom sheet)
  const allSearchInputs = document.querySelectorAll<HTMLInputElement>(".pdf-search-input")
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  allSearchInputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (searchTimeout) clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => performSearch(input.value), 300)
    })

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        if (e.shiftKey) {
          navigateToMatch(currentMatchIndex - 1)
        } else {
          navigateToMatch(currentMatchIndex + 1)
        }
      }
    })
  })

  // Search nav buttons
  document.querySelectorAll(".pdf-search-prev").forEach((btn) => {
    btn.addEventListener("click", () => navigateToMatch(currentMatchIndex - 1))
  })
  document.querySelectorAll(".pdf-search-next").forEach((btn) => {
    btn.addEventListener("click", () => navigateToMatch(currentMatchIndex + 1))
  })

  // Mobile bottom sheet
  const mobileMenuBtn = modal.querySelector(".pdf-mobile-menu-btn")
  if (mobileMenuBtn && bottomSheet) {
    mobileMenuBtn.addEventListener("click", () => {
      // Always reset to 60vh default snap point when opening via hamburger
      bottomSheet.style.setProperty("--sheet-height", "60vh")
      bottomSheet.classList.add("open")
    })

    const handle = bottomSheet.querySelector(".pdf-bottom-sheet-handle")
    if (handle) {
      handle.addEventListener("click", () => {
        bottomSheet.classList.remove("open")
      })
    }
  }

  // Drag-to-resize & swipe-to-dismiss on mobile bottom sheet
  if (bottomSheet) {
    setupBottomSheetDrag(bottomSheet)
  }

  // Mobile share button opens bottom sheet
  const mobileShareBtn = modal.querySelector(".pdf-mobile-share-btn")
  if (mobileShareBtn && bottomSheet) {
    mobileShareBtn.addEventListener("click", () => {
      bottomSheet.classList.add("open")
    })
  }

  // Bottom sheet action buttons
  if (bottomSheet) {
    bottomSheet.querySelector(".pdf-bs-copy-link")?.addEventListener("click", () => {
      const slug = currentPdfUrl.replace(/^\//, "")
      const url = `${window.location.origin}/Books-and-PDFs?pdf=${encodeURIComponent(slug)}`
      navigator.clipboard.writeText(url).then(() => showToast("Link copied"))
    })

    bottomSheet.querySelector(".pdf-bs-copy-page-link")?.addEventListener("click", () => {
      const slug = currentPdfUrl.replace(/^\//, "")
      const url = `${window.location.origin}/Books-and-PDFs?pdf=${encodeURIComponent(slug)}&page=${currentPageNum}`
      navigator.clipboard.writeText(url).then(() => showToast("Page link copied"))
    })

    bottomSheet.querySelector(".pdf-bs-open-tab")?.addEventListener("click", () => {
      window.open(currentPdfUrl, "_blank")
    })

    bottomSheet.querySelector(".pdf-bs-download")?.addEventListener("click", () => {
      // Trigger the main download button logic
      const dlBtn = modal.querySelector(".pdf-download") as HTMLButtonElement
      if (dlBtn) dlBtn.click()
      else window.open(currentPdfUrl, "_blank")
    })
  }

  // Fit to width
  modal.querySelector(".pdf-fit-width")?.addEventListener("click", async () => {
    if (!currentDoc) return
    const scrollEl = document.getElementById("pdf-pages-scroll")
    if (!scrollEl) return
    const containerWidth = scrollEl.clientWidth - 32 // account for padding
    try {
      const page = await currentDoc.getPage(1)
      const baseViewport = page.getViewport({ scale: 1.0 })
      const fitScale = containerWidth / baseViewport.width
      // Toggle: if already near fit-width, reset to default 1.5
      const targetScale = Math.abs(currentScale - fitScale) < 0.05 ? 1.5 : fitScale
      zoom(targetScale - currentScale)
    } catch {}
  })

  // Scroll listener for page detection, lazy loading, and progress bar
  const scrollEl = document.getElementById("pdf-pages-scroll")
  if (scrollEl) {
    scrollEl.addEventListener("scroll", () => {
      detectCurrentPage()
      renderVisiblePages()
      updateProgressBar()
    })

    // Pinch-to-zoom / Ctrl+wheel zoom
    scrollEl.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoom(e.deltaY < 0 ? 0.1 : -0.1)
      }
    }, { passive: false })
  }

  // Mobile swipe gestures for page navigation
  if (scrollEl) {
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0

    scrollEl.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
      touchStartTime = Date.now()
    }, { passive: true })

    scrollEl.addEventListener("touchend", (e) => {
      if (e.changedTouches.length !== 1) return
      const dx = e.changedTouches[0].clientX - touchStartX
      const dy = e.changedTouches[0].clientY - touchStartY
      const dt = Date.now() - touchStartTime

      // Only trigger if horizontal > vertical and fast enough swipe
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
        if (dx < 0) {
          // Swipe left → next page
          scrollToPage(Math.min(totalPages, currentPageNum + 1))
        } else {
          // Swipe right → previous page
          scrollToPage(Math.max(1, currentPageNum - 1))
        }
      }
    }, { passive: true })

    // Double-tap to zoom
    let lastTapTime = 0
    let lastTapX = 0
    let lastTapY = 0

    scrollEl.addEventListener("touchend", (e) => {
      if (e.changedTouches.length !== 1) return
      const now = Date.now()
      const touch = e.changedTouches[0]

      if (now - lastTapTime < 300 && Math.abs(touch.clientX - lastTapX) < 30 && Math.abs(touch.clientY - lastTapY) < 30) {
        // Double tap detected
        e.preventDefault()
        if (currentScale >= 2) {
          // Zoom back to fit-width
          if (currentDoc) {
            currentDoc.getPage(1).then((page: any) => {
              const baseVP = page.getViewport({ scale: 1.0 })
              const containerWidth = (scrollEl?.clientWidth || 300) - 16
              const fitScale = Math.max(0.5, containerWidth / baseVP.width)
              zoom(fitScale - currentScale)
            }).catch(() => {})
          }
        } else {
          // Zoom to 2x
          zoom(2 - currentScale)
        }
        lastTapTime = 0 // Reset to prevent triple-tap
      } else {
        lastTapTime = now
        lastTapX = touch.clientX
        lastTapY = touch.clientY
      }
    })
  }

  // Keyboard shortcuts
  modal.addEventListener("keydown", handleKeyboard)

  // Capture all keyboard shortcuts at document level when viewer is open
  document.addEventListener("keydown", (e) => {
    if (!isViewerOpen) return
    handleKeyboard(e)
  })
}

function handleKeyboard(e: KeyboardEvent) {
  if (!isViewerOpen) return

  // Don't capture if typing in an input field (except Escape and Ctrl+F)
  const target = e.target as HTMLElement
  const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"

  switch (e.key) {
    case "Escape":
      e.preventDefault()
      if (inInput) {
        ;(target as HTMLInputElement).blur()
        return
      }
      const bottomSheet = document.getElementById("pdf-bottom-sheet")
      if (bottomSheet?.classList.contains("open")) {
        bottomSheet.classList.remove("open")
        return
      }
      if (sidebarOpen && !isMobile()) {
        sidebarOpen = false
        document.querySelector(".pdf-viewer-body")?.classList.add("sidebar-collapsed")
        return
      }
      closePdfViewer()
      break

    case "f":
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        // Focus search input
        const searchInput = document.querySelector(".pdf-viewer-modal .pdf-search-input") as HTMLInputElement
        if (searchInput) {
          // Activate search tab
          activeTab = "search"
          document.querySelectorAll(".pdf-sidebar-tab").forEach((t) =>
            t.classList.toggle("active", (t as HTMLElement).dataset.tab === "search"))
          document.querySelectorAll(".pdf-sidebar-panel").forEach((p) =>
            p.classList.toggle("active", (p as HTMLElement).dataset.panel === "search"))

          if (isMobile()) {
            const bottomSheet = document.getElementById("pdf-bottom-sheet")
            if (bottomSheet) bottomSheet.style.setProperty("--sheet-height", "60vh")
            bottomSheet?.classList.add("open")
            const mobileInput = bottomSheet?.querySelector(".pdf-search-input") as HTMLInputElement
            mobileInput?.focus()
          } else {
            if (!sidebarOpen) {
              sidebarOpen = true
              document.querySelector(".pdf-viewer-body")?.classList.remove("sidebar-collapsed")
            }
            searchInput.focus()
          }
        }
      }
      break

    case "+":
    case "=":
      if (!inInput) {
        e.preventDefault()
        zoom(0.1)
      }
      break

    case "-":
      if (!inInput) {
        e.preventDefault()
        zoom(-0.1)
      }
      break

    case "ArrowLeft":
      if (!inInput) {
        e.preventDefault()
        scrollToPage(Math.max(1, currentPageNum - 1))
      }
      break

    case "ArrowRight":
      if (!inInput) {
        e.preventDefault()
        scrollToPage(Math.min(totalPages, currentPageNum + 1))
      }
      break

    case "Home":
      if (!inInput) {
        e.preventDefault()
        scrollToPage(1)
      }
      break

    case "End":
      if (!inInput) {
        e.preventDefault()
        scrollToPage(totalPages)
      }
      break
  }
}

let zoomInProgress = false

async function zoom(delta: number) {
  const newScale = Math.max(0.5, Math.min(4, currentScale + delta))
  if (newScale === currentScale) return
  if (zoomInProgress) {
    // Queue the delta for after current zoom finishes
    currentScale = Math.max(0.5, Math.min(4, newScale))
    updatePageIndicator()
    return
  }
  zoomInProgress = true

  const scrollEl = document.getElementById("pdf-pages-scroll")

  // Save scroll position: find visible page and fraction within it
  let savedPageIndex = 0
  let savedFraction = 0
  if (scrollEl && pageContainers.length > 0) {
    const scrollTop = scrollEl.scrollTop
    const scrollMid = scrollTop + scrollEl.clientHeight / 3
    for (let i = pageContainers.length - 1; i >= 0; i--) {
      if (pageContainers[i].offsetTop <= scrollMid) {
        savedPageIndex = i
        const pageHeight = pageContainers[i].offsetHeight
        savedFraction = pageHeight > 0 ? (scrollMid - pageContainers[i].offsetTop) / pageHeight : 0
        break
      }
    }
  }

  currentScale = newScale

  // Re-render all visible pages
  renderedPages.clear()
  for (const container of pageContainers) {
    container.innerHTML = '<div class="pdf-page-placeholder"></div>'
  }

  // Set correct dimensions for all page containers
  if (currentDoc) {
    for (let i = 0; i < pageContainers.length; i++) {
      try {
        const page = await currentDoc.getPage(i + 1)
        const viewport = page.getViewport({ scale: currentScale })
        pageContainers[i].style.width = viewport.width + "px"
        pageContainers[i].style.height = viewport.height + "px"
      } catch {
        // Skip
      }
    }
  }

  // Restore scroll position
  if (scrollEl && pageContainers[savedPageIndex]) {
    const newPageTop = pageContainers[savedPageIndex].offsetTop
    const newPageHeight = pageContainers[savedPageIndex].offsetHeight
    scrollEl.scrollTop = newPageTop + savedFraction * newPageHeight - scrollEl.clientHeight / 3
  }

  updatePageIndicator()
  renderVisiblePages()
  zoomInProgress = false
}

function updateProgressBar() {
  const scrollEl = document.getElementById("pdf-pages-scroll")
  const bar = document.querySelector(".pdf-progress-bar") as HTMLElement
  if (!scrollEl || !bar) return
  const scrollable = scrollEl.scrollHeight - scrollEl.clientHeight
  const pct = scrollable > 0 ? (scrollEl.scrollTop / scrollable) * 100 : 0
  bar.style.width = Math.min(100, pct) + "%"
}

function closePdfViewer() {
  const modal = document.getElementById("pdf-viewer-modal")
  if (modal) {
    modal.classList.remove("open")
  }

  isViewerOpen = false
  document.body.classList.remove("pdf-viewer-open")
  unlockScroll()

  // Clean up URL
  const url = new URL(window.location.href)
  url.searchParams.delete("pdf")
  url.searchParams.delete("page")
  history.replaceState(null, "", url.toString())

  // Clean up
  if (currentDoc) {
    currentDoc.destroy()
    currentDoc = null
  }
  renderedPages.clear()
  pageContainers = []
  pageTextContents.clear()
  searchMatches = []
  currentMatchIndex = -1
}

window.__openPdfViewer = async function (pdfUrl: string, opts?: { page?: number; title?: string }) {
  currentPdfUrl = pdfUrl
  currentPageNum = opts?.page || 1

  // Save to recent PDFs
  try {
    const recentKey = "pdf-recent"
    const recent: Array<{ slug: string; title: string; timestamp: number }> = JSON.parse(localStorage.getItem(recentKey) || "[]")
    const slug = pdfUrl.replace(/^\//, "")
    const title = opts?.title || formatFileTitle(pdfUrl)
    const filtered = recent.filter((r) => r.slug !== slug)
    filtered.unshift({ slug, title, timestamp: Date.now() })
    localStorage.setItem(recentKey, JSON.stringify(filtered.slice(0, 5)))
  } catch {}
  currentScale = 1.5
  renderedPages.clear()
  pageContainers = []
  pageTextContents.clear()
  searchMatches = []
  currentMatchIndex = -1
  sidebarOpen = !isMobile()
  activeTab = "toc"

  const modal = createModal()
  lockScroll()
  isViewerOpen = true
  document.body.classList.add("pdf-viewer-open")

  // Set title
  const titleEl = modal.querySelector(".pdf-toolbar-title")
  if (titleEl) titleEl.textContent = formatFileTitle(pdfUrl)

  // Show modal
  modal.classList.add("open")
  if (!isMobile()) {
    modal.querySelector(".pdf-viewer-body")?.classList.toggle("sidebar-collapsed", !sidebarOpen)
  }

  wireUpEvents(modal)

  // Focus the modal for keyboard events
  ;(modal.querySelector(".pdf-viewer-container") as HTMLElement)?.focus()

  try {
    const lib = await loadPdfJs()
    const doc = await lib.getDocument(pdfUrl).promise
    currentDoc = doc
    totalPages = doc.numPages
    updatePageIndicator()

    // Create page containers
    const scrollEl = document.getElementById("pdf-pages-scroll")
    if (!scrollEl) return

    scrollEl.innerHTML = ""

    // Get first page dimensions (used as default for all placeholders)
    const firstPage = await doc.getPage(1)
    const baseViewport = firstPage.getViewport({ scale: 1.0 })

    // On mobile, auto-calculate fit-to-width scale
    if (isMobile()) {
      const containerWidth = scrollEl.clientWidth - 16 // account for padding
      currentScale = Math.max(0.5, containerWidth / baseViewport.width)
    }

    const defaultViewport = firstPage.getViewport({ scale: currentScale })
    const defaultWidth = defaultViewport.width
    const defaultHeight = defaultViewport.height

    // Create all page containers at once using first page dimensions
    // Individual pages will be resized when actually rendered
    for (let i = 1; i <= totalPages; i++) {
      const container = document.createElement("div")
      container.className = "pdf-page"
      container.dataset.pageNum = String(i)
      container.style.width = defaultWidth + "px"
      container.style.height = defaultHeight + "px"
      container.innerHTML = '<div class="pdf-page-placeholder"></div>'

      scrollEl.appendChild(container)
      pageContainers.push(container)
    }

    // Render initial visible pages
    renderVisiblePages()

    // Scroll to requested page or saved progress
    if (currentPageNum > 1) {
      setTimeout(() => scrollToPage(currentPageNum), 100)
    } else {
      // Check for saved reading progress
      const savedPage = getSavedProgress(pdfUrl)
      if (savedPage && savedPage > 1 && savedPage <= totalPages) {
        currentPageNum = savedPage
        setTimeout(() => {
          scrollToPage(savedPage)
          showToast(`Resuming from page ${savedPage}`)
        }, 100)
      }
    }

    // Load TOC
    const tocPanel = modal.querySelector('.pdf-sidebar-panel[data-panel="toc"]') as HTMLElement
    if (tocPanel) loadToc(tocPanel)

    // Load TOC in bottom sheet too
    const bsTocPanel = document.querySelector('#pdf-bottom-sheet .pdf-sidebar-panel[data-panel="toc"]') as HTMLElement
    if (bsTocPanel) loadToc(bsTocPanel)

    // Load annotations (async, don't block)
    const annotPanel = modal.querySelector('.pdf-sidebar-panel[data-panel="annotations"]') as HTMLElement
    if (annotPanel) loadAnnotations(annotPanel)

    const bsAnnotPanel = document.querySelector('#pdf-bottom-sheet .pdf-sidebar-panel[data-panel="annotations"]') as HTMLElement
    if (bsAnnotPanel) loadAnnotations(bsAnnotPanel)
  } catch (e) {
    console.error("[PdfViewer] Failed to load PDF:", e)
    // For external URLs, CORS errors → fallback to new tab
    const isExternal = pdfUrl.startsWith("http")
    if (isExternal) {
      closePdfViewer()
      showToast("Opening in new tab (external PDF)")
      window.open(pdfUrl, "_blank")
      return
    }
    const scrollEl = document.getElementById("pdf-pages-scroll")
    if (scrollEl) {
      scrollEl.innerHTML = `<div class="pdf-loading-error">
        <p>Failed to load PDF</p>
        <p class="pdf-error-detail">${pdfViewerEscapeHtml(String(e))}</p>
        <button class="pdf-tb-btn" onclick="window.open('${escapeAttr(pdfUrl)}', '_blank')">Open in new tab</button>
      </div>`
    }
  }
}
