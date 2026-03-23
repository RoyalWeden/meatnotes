import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/pdfLibrary.scss"
import pdfViewerStyle from "./styles/pdfViewer.scss"
import pdfLibraryScript from "./scripts/pdfLibrary.inline.ts"
import pdfViewerScript from "./scripts/pdfViewer.inline.ts"

export default (() => {
  const PdfLibrary: QuartzComponent = (_props: QuartzComponentProps) => {
    return (
      <div class="popover-hint pdf-library-page">
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
          <span class="pdf-count" id="pdf-count"></span>
        </div>

        {/* Tag chip bar — hidden until JS populates chips */}
        <div class="pdf-tag-bar" id="pdf-tag-bar" style={{ display: "none" }}></div>

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
