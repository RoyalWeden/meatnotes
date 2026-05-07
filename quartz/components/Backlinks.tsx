import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/backlinks.scss"
import { resolveRelative, simplifySlug } from "../util/path"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import OverflowListFactory from "./OverflowList"

function formatDailyTitle(slug: string, fallbackTitle: string): string {
  if (slug.startsWith("Daily/")) {
    const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
    if (m) {
      const d = new Date(m[1] + "T12:00:00")
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    }
  }
  return fallbackTitle
}

interface BacklinksOptions {
  hideWhenEmpty: boolean
}

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts }
  const { OverflowList, overflowListAfterDOMLoaded } = OverflowListFactory()

  const Backlinks: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const slug = simplifySlug(fileData.slug!)
    const backlinkFiles = allFiles.filter((file) => file.links?.includes(slug))
    if (options.hideWhenEmpty && backlinkFiles.length == 0) {
      return null
    }
    return (
      <details class={classNames(displayClass, "right-rail-section backlinks")}>
        <summary class="backlinks-summary" data-tooltip="Toggle backlinks">
          <h3>{i18n(cfg.locale).components.backlinks.title}</h3>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="rrs-fold fold"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </summary>
        <OverflowList class="rrs-content">
          {backlinkFiles.length > 0 ? (
            backlinkFiles.map((f) => (
              <li>
                <a href={resolveRelative(fileData.slug!, f.slug!)} class="internal">
                  {formatDailyTitle(f.slug ?? "", f.frontmatter?.title ?? "")}
                </a>
              </li>
            ))
          ) : (
            <li>{i18n(cfg.locale).components.backlinks.noBacklinksFound}</li>
          )}
        </OverflowList>
      </details>
    )
  }

  Backlinks.css = style
  Backlinks.afterDOMLoaded = overflowListAfterDOMLoaded

  return Backlinks
}) satisfies QuartzComponentConstructor
