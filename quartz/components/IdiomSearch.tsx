import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/idiom-search.scss"
// @ts-ignore
import script from "./scripts/idiom-search.inline"
import { classNames } from "../util/lang"

export default (() => {
  const IdiomSearch: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "idiom-search")}>
        <button class="idiom-search-button" aria-label="Browse Hebrew Idioms">
          <svg
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <title>Idioms</title>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span class="idiom-btn-label">Idioms</span>
        </button>
        <div class="idiom-modal">
          <div class="idiom-modal-box">
            <div class="idiom-modal-header">
              <h2 class="idiom-modal-title">Hebrew Idioms</h2>
              <input
                class="idiom-filter"
                type="text"
                placeholder="Filter idioms..."
                autocomplete="off"
              />
            </div>
            <div class="idiom-grid"></div>
          </div>
        </div>
      </div>
    )
  }

  IdiomSearch.afterDOMLoaded = script
  IdiomSearch.css = style

  return IdiomSearch
}) satisfies QuartzComponentConstructor
