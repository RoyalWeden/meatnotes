import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { SimpleSlug, resolveRelative } from "../util/path"
import { QuartzPluginData } from "../plugins/vfile"
import { byDateAndAlphabetical } from "./PageList"
import style from "./styles/recentNotes.scss"
import { Date, getDate } from "./Date"
import { GlobalConfiguration } from "../cfg"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"

const SidebarFileIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z" />
    <path
      d="M13 2v7h7"
      fill="none"
      stroke="var(--light)"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
)

interface Options {
  title?: string
  limit: number
  linkToMore: SimpleSlug | false
  showTags: boolean
  filter: (f: QuartzPluginData) => boolean
  sort: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

const defaultOptions = (cfg: GlobalConfiguration): Options => ({
  limit: 3,
  linkToMore: false,
  showTags: true,
  filter: () => true,
  sort: byDateAndAlphabetical(cfg),
})

export default ((userOpts?: Partial<Options>) => {
  const RecentNotes: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const opts = { ...defaultOptions(cfg), ...userOpts }
    const pages = allFiles.filter(opts.filter).sort(opts.sort)
    const remaining = Math.max(0, pages.length - opts.limit)
    return (
      <details class={classNames(displayClass, "right-rail-section recent-notes")} id="recent-notes-home" open>
        <summary>
          <h3>{opts.title ?? i18n(cfg.locale).components.recentNotes.title}</h3>
          <svg
            class="rrs-fold"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <ul class="recent-ul rrs-content">
          {pages.slice(0, opts.limit).map((page) => {
            const title = page.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title
            return (
              <li class="recent-li">
                <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal recent-row">
                  <span class="recent-row-icon">
                    <SidebarFileIcon />
                  </span>
                  <span class="recent-row-title">{title}</span>
                  {page.dates && (
                    <span class="recent-row-date">
                      <Date date={getDate(cfg, page)!} locale={cfg.locale} />
                    </span>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
        {opts.linkToMore && remaining > 0 && (
          <p>
            <a href={resolveRelative(fileData.slug!, opts.linkToMore)}>
              {i18n(cfg.locale).components.recentNotes.seeRemainingMore({ remaining })}
            </a>
          </p>
        )}
      </details>
    )
  }

  RecentNotes.css = style

  // Persist <details> open state across navigation. Native <details>
  // toggling handles the open/close UI; this hook just remembers the user's
  // choice in localStorage so it survives reloads + SPA navs.
  RecentNotes.afterDOMLoaded = `
(function() {
  var STORAGE_KEY = 'recent-notes-home-open'

  function init() {
    var wrapper = document.getElementById('recent-notes-home')
    if (!wrapper) return
    if (wrapper.tagName !== 'DETAILS') return

    var saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') wrapper.setAttribute('open', '')
    else if (saved === 'false') wrapper.removeAttribute('open')
    // null saved → keep server-side default (which is open).

    if (wrapper.dataset.rnh) return
    wrapper.dataset.rnh = '1'
    wrapper.addEventListener('toggle', function() {
      localStorage.setItem(STORAGE_KEY, String(wrapper.open))
    })
  }

  init()
  document.addEventListener('nav', init)
})()
`

  return RecentNotes
}) satisfies QuartzComponentConstructor
