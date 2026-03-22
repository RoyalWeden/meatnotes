import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/pdfLibrary.scss"
import pdfViewerStyle from "./styles/pdfViewer.scss"
import pdfLibraryScript from "./scripts/pdfLibrary.inline.ts"
import pdfViewerScript from "./scripts/pdfViewer.inline.ts"

export default (() => {
  const PdfLibrary: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    // Get external PDFs from frontmatter
    const externalPdfs = (fileData.frontmatter?.externalPdfs as
      | Array<{ title: string; url: string; description?: string }>
      | undefined) ?? []

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

        {/* Card grid - local PDFs will be injected by client-side script */}
        <div class="pdf-cards-grid" id="pdf-cards-grid">
          {/* External PDF cards rendered server-side */}
          {externalPdfs.map((pdf) => (
            <div
              class="pdf-card pdf-card-external"
              data-title={pdf.title}
              data-url={pdf.url}
            >
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
                <h3 class="pdf-card-title">{pdf.title}</h3>
                {pdf.description && <p class="pdf-card-desc">{pdf.description}</p>}
              </div>
            </div>
          ))}
        </div>

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
