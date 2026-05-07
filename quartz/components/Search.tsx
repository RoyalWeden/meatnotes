import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/search.scss"
// @ts-ignore
import script from "./scripts/search.inline"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

export interface SearchOptions {
  enablePreview: boolean
}

const defaultOptions: SearchOptions = {
  enablePreview: true,
}

export default ((userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts }
    const searchPlaceholder = i18n(cfg.locale).components.search.searchBarPlaceholder
    return (
      <div class={classNames(displayClass, "search")}>
        <button class="search-button" data-tooltip="Open search">
          <svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7">
            <title>Search</title>
            <g class="search-path" fill="none">
              <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
              <circle cx="8" cy="8" r="7" />
            </g>
          </svg>
          <p>{i18n(cfg.locale).components.search.title}</p>
          <kbd class="search-open-hint"></kbd>
        </button>
        <div class="search-container">
          <div class="search-space">
            <div class="search-input-wrap">
              <input
                autocomplete="off"
                class="search-bar"
                name="search"
                type="text"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
              />
              <button class="search-filter-toggle" aria-label="Toggle filters" data-tooltip="Toggle filters">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
                  <path d="M1.5 3.5a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 0 1h-12a.5.5 0 0 1-.5-.5zm2 4a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1h-8a.5.5 0 0 1-.5-.5zm2 4a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </button>
            </div>
            <div class="search-filter-btns" role="group" aria-label="Search filter">
              <button class="filter-btn active" data-filter="all" data-tooltip="Search all fields">All</button>
              <button class="filter-btn" data-filter="title" data-tooltip="Search titles only">Title</button>
              <button class="filter-btn" data-filter="content" data-tooltip="Search content only">Content</button>
              <button class="filter-btn" data-filter="tags" data-tooltip="Search tags only">Tags</button>
              <button class="phrase-btn" id="search-phrase-btn" aria-pressed="false" data-tooltip="Toggle exact phrase matching">Phrase</button>
            </div>
            <div class="search-scope-row" role="group" aria-label="Scope filter">
              <span class="scope-label">In:</span>
              <button class="scope-btn active" data-scope="all" data-tooltip="Search all sections">All</button>
              <button class="scope-btn" data-scope="idioms" data-tooltip="Search idioms only">Idioms</button>
              <button class="scope-btn" data-scope="capture" data-tooltip="Search capture notes">Capture</button>
              <button class="scope-btn" data-scope="progress" data-tooltip="Search in-progress notes">In Progress</button>
              <button class="scope-btn" data-scope="complete" data-tooltip="Search completed notes">Complete</button>
            </div>
            <div class="search-layout" data-preview={opts.enablePreview}></div>
          </div>
        </div>
      </div>
    )
  }

  Search.afterDOMLoaded = script
  Search.css = style

  return Search
}) satisfies QuartzComponentConstructor
