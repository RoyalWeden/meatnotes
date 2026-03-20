import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/fullSearch.inline"
import style from "./styles/fullSearch.scss"

export default (() => {
  const FullSearch: QuartzComponent = (_props: QuartzComponentProps) => {
    return (
      <div class="full-search">
        {/* Page title + description — scrolls away, above the sticky bar */}
        <div class="fs-page-header">
          <h1>Search</h1>
          <p>
            Search all notes by title, content, or tags. Filter by section, drill into folders,
            or use natural language dates like <strong>"last week"</strong>, <strong>"march 30"</strong>,
            or <strong>"3 days ago"</strong>. Supports boolean operators (<strong>AND / OR / NOT</strong>)
            and exact phrases with <strong>"quotes"</strong>.
          </p>
        </div>
        {/* Sticky search controls */}
        <div class="fs-sticky-bar" id="fs-sticky-bar">
          {/* Input row: chip + text */}
          <div class="fs-input-wrap" id="fs-input-wrap">
            <svg class="fs-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7" aria-hidden="true">
              <g fill="none">
                <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
                <circle cx="8" cy="8" r="7" />
              </g>
            </svg>
            <input
              type="text"
              id="full-search-input"
              class="full-search-input"
              placeholder="Search all notes…"
              autocomplete="off"
            />
          </div>
          {/* Filter buttons row */}
          <div class="fs-filter-row" role="group" aria-label="Search filter">
            <button class="fs-filter-btn active" data-filter="all">All</button>
            <button class="fs-filter-btn" data-filter="title">Title</button>
            <button class="fs-filter-btn" data-filter="content">Content</button>
            <button class="fs-filter-btn" data-filter="tags">Tags</button>
            <button class="fs-phrase-btn" id="fs-phrase-btn" aria-pressed="false">Phrase</button>
            <div class="fs-filter-spacer"></div>
            <select id="fs-sort" class="fs-sort-select">
              <option value="relevance">Relevance</option>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
          {/* Scope pills row */}
          <div class="fs-scope-row" id="fs-scope-row" role="group" aria-label="Scope filter">
            <span class="fs-scope-label">In:</span>
            <button class="fs-scope-btn active" data-scope="all">All</button>
            <button class="fs-scope-btn" data-scope="idioms">Idioms</button>
            <button class="fs-scope-btn" data-scope="capture">Capture</button>
            <button class="fs-scope-btn" data-scope="progress">In Progress</button>
            <button class="fs-scope-btn" data-scope="complete">Complete</button>
          </div>
        </div>
        {/* Count + results */}
        <div id="fs-count" class="fs-count"></div>
        <div id="full-search-results" class="full-search-results"></div>
      </div>
    )
  }

  FullSearch.css = style
  FullSearch.afterDOMLoaded = script

  return FullSearch
}) satisfies QuartzComponentConstructor
