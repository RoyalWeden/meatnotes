import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import { byDateAndAlphabetical } from "./PageList"
import { Date, getDate } from "./Date"
// reuse RecentNotes CSS so it matches exactly
import style from "./styles/recentNotes.scss"

const RecentIdioms: QuartzComponent = ({ allFiles, fileData, cfg }: QuartzComponentProps) => {
  const idiomFiles = allFiles
    .filter(
      (f) =>
        f.filePath?.includes("01 — Idioms") &&
        f.slug &&
        !f.slug.endsWith("index") &&
        f.slug !== fileData.slug,
    )
    .sort(byDateAndAlphabetical(cfg))
    .slice(0, 5)

  if (idiomFiles.length === 0) return null

  return (
    <div class="recent-notes" id="recent-idioms">
      <div class="recent-notes-heading">
        <h3>Recent Idioms</h3>
        <button
          class="section-collapse-btn recent-notes-collapse"
          aria-label="Toggle section"
          data-target="recent-idioms"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        </button>
      </div>
      <ul class="recent-ul">
        {idiomFiles.map((page) => {
          const title =
            (page.frontmatter?.title as string | undefined) ??
            page.slug?.split("/").pop()?.replace(/-/g, " ") ??
            ""
          return (
            <li class="recent-li">
              <a
                href={resolveRelative(fileData.slug!, page.slug!)}
                class="internal recent-row"
                data-no-popover="true"
              >
                <span class="recent-row-icon">
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
    </div>
  )
}

RecentIdioms.css = style as unknown as string

RecentIdioms.afterDOMLoaded = `
(function() {
  var STORAGE_KEY = 'recent-idioms-collapsed'

  function init() {
    var wrapper = document.getElementById('recent-idioms')
    if (!wrapper) return
    var btn = wrapper.querySelector('.recent-notes-collapse')
    if (!btn) return

    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      wrapper.classList.add('collapsed')
    }

    if (btn.dataset.ri) return
    btn.dataset.ri = '1'
    btn.addEventListener('click', function() {
      var collapsed = wrapper.classList.toggle('collapsed')
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    })
  }

  init()
  document.addEventListener('nav', init)
})()
`

export default (() => RecentIdioms) satisfies QuartzComponentConstructor
