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
  margin: 2rem 0 0 0;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
