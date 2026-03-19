import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import style from "../styles/listPage.scss"
import { SortFn, byDateAndAlphabeticalFolderFirst } from "../PageList"
import { Root } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { i18n } from "../../i18n"
import { QuartzPluginData } from "../../plugins/vfile"
import { ComponentChildren } from "preact"
import { trieFromAllFiles } from "../../util/ctx"
import { resolveRelative, isFolderPath } from "../../util/path"
import { getDate, formatDate } from "../Date"

interface FolderContentOptions {
  showFolderCount: boolean
  showSubfolders: boolean
  sort?: SortFn
}

const defaultOptions: FolderContentOptions = {
  showFolderCount: true,
  showSubfolders: true,
}

const FolderIcon = () => (
  <svg class="card-icon folder-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
  </svg>
)

const FileIcon = () => (
  <svg class="card-icon file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/>
    <path d="M13 2v7h7" fill="none" stroke="var(--light)" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>
)

export default ((opts?: Partial<FolderContentOptions>) => {
  const options: FolderContentOptions = { ...defaultOptions, ...opts }

  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props

    const trie = (props.ctx.trie ??= trieFromAllFiles(allFiles))
    const folder = trie.findNode(fileData.slug!.split("/"))
    if (!folder) return null

    const allPagesInFolder: (QuartzPluginData & { childCount?: number })[] =
      folder.children
        .map((node) => {
          if (node.data) {
            return node.data as QuartzPluginData & { childCount?: number }
          }
          if (node.isFolder && options.showSubfolders) {
            const getMostRecentDates = (): QuartzPluginData["dates"] => {
              let maybeDates: QuartzPluginData["dates"] | undefined = undefined
              for (const child of node.children) {
                if (child.data?.dates) {
                  if (!maybeDates) {
                    maybeDates = { ...child.data.dates }
                  } else {
                    if (child.data.dates.created > maybeDates.created) maybeDates.created = child.data.dates.created
                    if (child.data.dates.modified > maybeDates.modified) maybeDates.modified = child.data.dates.modified
                    if (child.data.dates.published > maybeDates.published) maybeDates.published = child.data.dates.published
                  }
                }
              }
              return maybeDates ?? { created: new Date(), modified: new Date(), published: new Date() }
            }
            return {
              slug: node.slug,
              dates: getMostRecentDates(),
              frontmatter: { title: node.displayName.replace(/^\d+\s*[—–-]\s*/, ""), tags: [] },
              childCount: node.children.length,
            } as QuartzPluginData & { childCount?: number }
          }
        })
        .filter((page): page is QuartzPluginData & { childCount?: number } => page !== undefined)

    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    const sorter = options.sort ?? byDateAndAlphabeticalFolderFirst(cfg)
    const sortedPages = [...allPagesInFolder].sort(sorter)

    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren

    return (
      <div class="popover-hint">
        <article class={classes}>{content}</article>
        <div class="page-listing">
          <div class="folder-page-header">
            {options.showFolderCount && (
              <p class="folder-item-count">
                {i18n(cfg.locale).pages.folderContent.itemsUnderFolder({ count: allPagesInFolder.length })}
              </p>
            )}
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

          <div class="view-cards">
            <div class="cards-grid">
              {sortedPages.map((page) => {
                const title = page.frontmatter?.title ?? ""
                const isFolder = isFolderPath(page.slug ?? "")
                const childCount = (page as any).childCount as number | undefined
                const date = getDate(cfg, page)
                const dateStr = date ? formatDate(date, cfg.locale) : ""
                const countLabel = isFolder && childCount !== undefined
                  ? `${childCount} note${childCount === 1 ? "" : "s"}`
                  : null

                return (
                  <div class="card-item">
                    <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal card-link">
                      <div class="card-body">
                        <div class="card-icon-wrap">
                          {isFolder ? <FolderIcon /> : <FileIcon />}
                        </div>
                        <div class="card-title">{title}</div>
                      </div>
                      <div class={`card-footer${countLabel || dateStr ? "" : " card-footer-empty"}`}>
                        {countLabel && <span class="card-pill card-pill-count">{countLabel}</span>}
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
              {sortedPages.map((page) => {
                const title = page.frontmatter?.title ?? ""
                const isFolder = isFolderPath(page.slug ?? "")
                const childCount = (page as any).childCount as number | undefined
                const date = getDate(cfg, page)
                const dateStr = date ? formatDate(date, cfg.locale) : ""
                const countLabel = isFolder && childCount !== undefined
                  ? `${childCount} note${childCount === 1 ? "" : "s"}`
                  : null
                return (
                  <li class="folder-list-item">
                    <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal folder-list-link">
                      <span class="folder-list-icon">
                        {isFolder ? <FolderIcon /> : <FileIcon />}
                      </span>
                      <span class="folder-list-title">{title}</span>
                      <span class="folder-list-pills">
                        {countLabel && <span class="card-pill card-pill-count">{countLabel}</span>}
                        {dateStr && <span class="card-pill card-pill-date">{dateStr}</span>}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  FolderContent.css = style

  FolderContent.afterDOMLoaded = `
(function() {
  function initFolderView() {
    var listings = document.querySelectorAll('.page-listing')
    if (!listings.length) return

    var saved = localStorage.getItem('folder-view') || 'cards-sm'
    // migrate old value
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

  initFolderView()
  document.addEventListener('nav', initFolderView)
})()
`

  return FolderContent
}) satisfies QuartzComponentConstructor
