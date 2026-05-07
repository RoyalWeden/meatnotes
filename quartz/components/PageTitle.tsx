import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={baseDir}>{title}</a>
    </h2>
  )
}

PageTitle.css = `
/* Phase 17c: small uppercase tracked label — matches the Inspector caps
   header vocabulary from Phase 4. Frees ~30px of sidebar vertical space and
   reads like Apple Notes' account-header. The full title remains the link
   target so clicking still goes home. */
.page-title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--darkgray);
  margin: 0 0 0.5rem 0;
  font-family: var(--bodyFont);
  line-height: 1.2;
}
.page-title a {
  color: inherit;
  text-decoration: none;
  transition: color 0.12s ease;
}
.page-title a:hover {
  color: var(--accent);
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
