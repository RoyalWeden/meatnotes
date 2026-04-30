import { FullSlug, resolveRelative } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const TagList: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const tags = fileData.frontmatter?.tags
  if (tags && tags.length > 0) {
    return (
      <ul class={classNames(displayClass, "tags")}>
        {tags.map((tag) => {
          const linkDest = resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)
          return (
            <li>
              <a href={linkDest} class="internal tag-link">
                {tag}
              </a>
            </li>
          )
        })}
      </ul>
    )
  } else {
    return null
  }
}

TagList.css = `
.tags {
  /* Apple-article inline pills: small, accent-soft, sit tight under the
     content meta line as a continuation of the same dimmed ribbon. */
  list-style: none;
  display: flex;
  padding-left: 0;
  gap: 0.35rem;
  margin: 0 0 1.5rem 0;
  flex-wrap: wrap;
}

.section-li > .section > .tags {
  justify-content: flex-end;
}

.tags > li {
  display: inline-block;
  white-space: nowrap;
  margin: 0;
  overflow-wrap: normal;
}

a.internal.tag-link {
  border-radius: 999px;
  background-color: var(--accent-soft);
  color: var(--accent);
  padding: 0.15rem 0.55rem;
  margin: 0;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.5;
  transition: background-color 0.15s ease;
}

a.internal.tag-link:hover {
  background-color: var(--accent-tint);
}
`

export default (() => TagList) satisfies QuartzComponentConstructor
