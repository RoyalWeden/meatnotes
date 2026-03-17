import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/fullSearch.inline"
import style from "./styles/fullSearch.scss"

export default (() => {
  const FullSearch: QuartzComponent = (_props: QuartzComponentProps) => {
    return (
      <div class="full-search">
        <div class="full-search-controls">
          <input
            type="text"
            id="full-search-input"
            class="full-search-input"
            placeholder="Search notes by title, content, tags, or date (e.g. 'march 30', '3 days ago')…"
            autocomplete="off"
          />
          <div class="full-search-options">
            <label class="full-search-filter">
              <input type="checkbox" id="fs-filter-title" checked /> Title
            </label>
            <label class="full-search-filter">
              <input type="checkbox" id="fs-filter-content" checked /> Content
            </label>
            <label class="full-search-filter">
              <input type="checkbox" id="fs-filter-tags" checked /> Tags
            </label>
            <select id="fs-sort" class="full-search-sort">
              <option value="relevance">Sort: Relevance</option>
              <option value="date-desc">Sort: Newest first</option>
              <option value="date-asc">Sort: Oldest first</option>
              <option value="title">Sort: Title A–Z</option>
            </select>
          </div>
        </div>
        <div id="full-search-count" class="full-search-count"></div>
        <div id="full-search-results" class="full-search-results"></div>
      </div>
    )
  }

  FullSearch.css = style
  FullSearch.afterDOMLoaded = script

  return FullSearch
}) satisfies QuartzComponentConstructor
