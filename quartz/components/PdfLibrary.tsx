import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/pdfLibrary.scss"
import pdfViewerStyle from "./styles/pdfViewer.scss"
import pdfLibraryScript from "./scripts/pdfLibrary.inline.ts"
import pdfViewerScript from "./scripts/pdfViewer.inline.ts"

export default (() => {
  const PdfLibrary: QuartzComponent = (_props: QuartzComponentProps) => {
    return (
      <div class="popover-hint pdf-library-page" data-pdf-view="compact">
        {/* Filter bar */}
        <div class="pdf-filter-bar">
          <div class="pdf-filter-input-wrap">
            <svg class="pdf-filter-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              class="pdf-filter-input"
              placeholder="Search PDFs..."
              aria-label="Filter PDFs by title"
            />
          </div>

          {/* Sort + view controls */}
          <div class="pdf-toolbar-right">
            <button class="pdf-sort-btn pressable" id="pdf-sort-btn" data-tooltip="Sort PDFs" aria-label="Sort order">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="9" y2="18" />
              </svg>
              <span id="pdf-sort-label">A→Z</span>
            </button>

            <div class="pdf-view-toggle">
              {/* Compact grid */}
              <button class="pdf-view-btn pdf-view-btn-active pressable" data-view="compact" data-tooltip="Compact grid" aria-label="Compact grid">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              {/* Spacious grid */}
              <button class="pdf-view-btn pressable" data-view="spacious" data-tooltip="Spacious grid" aria-label="Spacious grid">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="9" height="9" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              {/* List view */}
              <button class="pdf-view-btn pressable" data-view="list" data-tooltip="List view" aria-label="List view">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>

            <span class="pdf-count" id="pdf-count"></span>
          </div>
        </div>

        {/* Tag chip bar — hidden until JS populates chips */}
        <div class="pdf-tag-bar" id="pdf-tag-bar" style={{ display: "none" }}></div>

        {/* Search preview placeholder — shown in search preview (static HTML), hidden by JS once grid loads */}
        <div class="pdf-search-preview" id="pdf-search-preview">
          <p>Your Books &amp; PDFs library — browse and open local PDFs, external documents, and web links. Filter by tag or search by title.</p>
        </div>

        {/* Card grid — all cards injected by client-side script */}
        <div class="pdf-cards-grid" id="pdf-cards-grid"></div>

        {/* Empty state */}
        <div class="pdf-empty-state" id="pdf-empty-state" style={{ display: "none" }}>
          <p>No PDFs match your search.</p>
        </div>

        {/* PDF Viewer modal container */}
        <div id="pdf-viewer-modal" class="pdf-viewer-modal"></div>
      </div>
    )
  }

  PdfLibrary.css = style + pdfViewerStyle
  // Wrap each script in an IIFE to prevent minified variable name collisions
  PdfLibrary.afterDOMLoaded = ";(function(){" + pdfViewerScript + "})();\n;(function(){" + pdfLibraryScript + "})();"

  return PdfLibrary
}) satisfies QuartzComponentConstructor
