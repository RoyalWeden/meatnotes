import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  const dailyMatch = slug.match(/^Daily\/(\d{4})-(\d{2})-(\d{2})$/)
  if (dailyMatch) {
    const rawTitle = fileData.frontmatter?.title ?? ""
    const isDefaultTitle = !rawTitle || /^\d{4}-\d{2}-\d{2}$/.test(rawTitle)
    if (isDefaultTitle) {
      const [, yr, mo, dy] = dailyMatch
      const date = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(dy))
      const formatted = date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      return <h1 class={classNames(displayClass, "article-title")}>{formatted}</h1>
    }
  }

  const title = fileData.frontmatter?.title
  if (title) {
    return <h1 class={classNames(displayClass, "article-title")}>{title}</h1>
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title {
  /* Apple-display sizing: clamp(2rem, 4vw, 2.6rem) like an Apple Newsroom h1.
     The viewport-relative middle term scales gently between phone and desktop
     without looking enormous on big screens. Tighter top margin so the
     breadcrumb above it reads as a single visual block with the title. */
  font-size: clamp(2rem, 4vw, 2.6rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-weight: 700;
  color: var(--dark);
  margin: 1rem 0 0.4rem 0;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
