import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import { byDateAndAlphabetical } from "./PageList"
import style from "./styles/recentNotes.scss"
import { Date, getDate } from "./Date"
import { classNames } from "../util/lang"

interface Options {
  title?: string
  limit: number
}

const defaultOptions: Options = {
  title: "Latest in Folder",
  limit: 5,
}

const SidebarFileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/>
    <path d="M13 2v7h7" fill="none" stroke="var(--light)" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>
)

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts }

  const FolderRecentNotes: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const folderSlug = fileData.slug ?? ""

    const folderPrefix = folderSlug.endsWith("/index")
      ? folderSlug.slice(0, -"/index".length)
      : folderSlug

    const folderFiles = allFiles
      .filter((f) => {
        const s = f.slug ?? ""
        return s.startsWith(folderPrefix + "/") && !s.endsWith("/index")
      })
      .sort(byDateAndAlphabetical(cfg))
      .slice(0, opts.limit)

    if (folderFiles.length === 0) return null

    return (
      <div class={classNames(displayClass, "recent-notes")}>
        <h3>{opts.title}</h3>
        <ul class="recent-ul">
          {folderFiles.map((page) => {
            const title = page.frontmatter?.title ?? page.slug ?? ""
            const date = getDate(cfg, page)
            return (
              <li class="recent-li">
                <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal recent-row">
                  <span class="recent-row-icon">
                    <SidebarFileIcon />
                  </span>
                  <span class="recent-row-title">{title}</span>
                  {date && (
                    <span class="recent-row-date">
                      <Date date={date} locale={cfg.locale} />
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

  FolderRecentNotes.css = style
  return FolderRecentNotes
}) satisfies QuartzComponentConstructor
