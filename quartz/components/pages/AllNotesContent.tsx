import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import style from "../styles/listPage.scss"
import { resolveRelative, FullSlug } from "../../util/path"
import { getDate, formatDate } from "../Date"

const sections = [
  { label: "Capture",           prefix: "00-—-Capture" },
  { label: "In Progress",       prefix: "10-—-In-Progress" },
  { label: "Complete",          prefix: "20-—-Complete" },
  { label: "Copy-Paste Rebukes", prefix: "Copy-Paste-Rebukes" },
]

const FileIcon = () => (
  <svg class="card-icon file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/>
    <path d="M13 2v7h7" fill="none" stroke="var(--light)" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>
)

export default (() => {
  const AllNotesContent: QuartzComponent = ({ allFiles, fileData, cfg }: QuartzComponentProps) => {
    const notes = allFiles.filter((f) => {
      const s = f.slug ?? ""
      return (
        !s.startsWith("Daily/") &&
        s !== "index" &&
        s !== "Search" &&
        s !== "All-Notes" &&
        !s.endsWith("/index")
      )
    })

    const totalCount = notes.length

    const grouped = sections
      .map(({ label, prefix }) => ({
        label,
        prefix,
        pages: notes.filter((f) => (f.slug ?? "").startsWith(prefix + "/")),
      }))
      .filter((g) => g.pages.length > 0)

    return (
      <div class="popover-hint all-notes-page">
        <div class="page-listing">
          <div class="folder-page-header">
            <p class="folder-item-count">{totalCount} notes total</p>
            <div class="view-toggle">
              {/* Compact grid */}
              <button class="view-btn" data-view-target="cards-sm" title="Compact grid">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="1" y="1" width="3" height="3" rx=".6"/>
                  <rect x="5.5" y="1" width="3" height="3" rx=".6"/>
                  <rect x="10" y="1" width="3" height="3" rx=".6"/>
                  <rect x="1" y="5.5" width="3" height="3" rx=".6"/>
                  <rect x="5.5" y="5.5" width="3" height="3" rx=".6"/>
                  <rect x="10" y="5.5" width="3" height="3" rx=".6"/>
                  <rect x="1" y="10" width="3" height="3" rx=".6"/>
                  <rect x="5.5" y="10" width="3" height="3" rx=".6"/>
                  <rect x="10" y="10" width="3" height="3" rx=".6"/>
                </svg>
              </button>
              {/* Spacious grid */}
              <button class="view-btn" data-view-target="cards-lg" title="Spacious grid">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="1" y="1" width="5.5" height="5.5" rx="1"/>
                  <rect x="7.5" y="1" width="5.5" height="5.5" rx="1"/>
                  <rect x="1" y="7.5" width="5.5" height="5.5" rx="1"/>
                  <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1"/>
                </svg>
              </button>
              {/* List */}
              <button class="view-btn" data-view-target="list" title="List view">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="4" width="18" height="2.5" rx="1.25"/>
                  <rect x="3" y="10.75" width="18" height="2.5" rx="1.25"/>
                  <rect x="3" y="17.5" width="18" height="2.5" rx="1.25"/>
                </svg>
              </button>
            </div>
          </div>

          {grouped.map(({ label, prefix, pages }) => (
            <div class="notes-section-group">
              <h2 class="notes-section-heading">
                <button class="section-collapse-btn" aria-label="Toggle section" title="Collapse section">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <a href={resolveRelative(fileData.slug!, prefix as FullSlug)} class="internal">
                  {label}
                </a>
                <span class="notes-section-count">{pages.length}</span>
              </h2>

              <div class="view-cards">
                <div class="cards-grid">
                  {pages.map((page) => {
                    const title = page.frontmatter?.title ?? ""
                    const date = getDate(cfg, page)
                    const dateStr = date ? formatDate(date, cfg.locale) : ""
                    return (
                      <div class="card-item">
                        <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal card-link">
                          <div class="card-body">
                            <div class="card-icon-wrap"><FileIcon /></div>
                            <div class="card-title">{title}</div>
                          </div>
                          <div class={`card-footer${dateStr ? "" : " card-footer-empty"}`}>
                            {dateStr && <span class="card-pill card-pill-date">{dateStr}</span>}
                          </div>
                        </a>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div class="view-list">
                <ul class="folder-list">
                  {pages.map((page) => {
                    const title = page.frontmatter?.title ?? ""
                    const date = getDate(cfg, page)
                    const dateStr = date ? formatDate(date, cfg.locale) : ""
                    return (
                      <li class="folder-list-item">
                        <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal folder-list-link">
                          <span class="folder-list-icon"><FileIcon /></span>
                          <span class="folder-list-title">{title}</span>
                          <span class="folder-list-pills">
                            {dateStr && <span class="card-pill card-pill-date">{dateStr}</span>}
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  AllNotesContent.css = style

  AllNotesContent.afterDOMLoaded = `
(function() {
  function initFolderView() {
    var listings = document.querySelectorAll('.page-listing')
    if (!listings.length) return

    var saved = localStorage.getItem('folder-view') || 'cards-sm'
    if (saved === 'cards') saved = 'cards-sm'

    listings.forEach(function(el) { el.setAttribute('data-view', saved) })
    syncButtons(saved)

    document.querySelectorAll('.view-btn').forEach(function(btn) {
      if (btn.dataset.vlistening) return
      btn.dataset.vlistening = '1'
      btn.addEventListener('click', function() {
        var t = this.dataset.viewTarget
        if (!t) return
        localStorage.setItem('folder-view', t)
        document.querySelectorAll('.page-listing').forEach(function(el) {
          el.setAttribute('data-view', t)
        })
        syncButtons(t)
      })
    })
  }

  function syncButtons(v) {
    document.querySelectorAll('.view-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.viewTarget === v)
    })
  }

  function initSectionCollapse() {
    document.querySelectorAll('.section-collapse-btn').forEach(function(btn) {
      if (btn.dataset.cl) return
      btn.dataset.cl = '1'
      btn.addEventListener('click', function() {
        var group = this.closest('.notes-section-group')
        if (group) group.classList.toggle('collapsed')
      })
    })
  }

  initFolderView()
  initSectionCollapse()
  document.addEventListener('nav', function() {
    initFolderView()
    initSectionCollapse()
  })
})()
`

  return AllNotesContent
}) satisfies QuartzComponentConstructor
