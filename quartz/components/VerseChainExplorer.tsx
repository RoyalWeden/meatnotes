import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/verseChainExplorer.inline"
import style from "./styles/verseChainExplorer.scss"

export default (() => {
  const VerseChainExplorer: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    return (
      <div class="verse-chain" data-base-url={cfg.baseUrl ?? ""}>
        {/* Spotlight-style search */}
        <div class="vc-search-wrap">
          <input
            type="text"
            id="vc-input"
            class="vc-input"
            placeholder="Search a verse… e.g. John 3:16"
            autocomplete="off"
            aria-label="Search verse"
          />
          <button id="vc-input-clear" class="vc-input-clear" data-tooltip="Clear search" aria-label="Clear">&times;</button>
          <ul id="vc-autocomplete" class="vc-autocomplete" role="listbox" aria-label="Suggestions"></ul>
        </div>

        {/* History chips */}
        <div id="vc-history" class="vc-history" aria-label="Search history"></div>

        {/* Controls row: filter dropdown + context dropdown */}
        <div class="vc-controls">
          <select id="vc-filter-select" class="vc-dropdown" aria-label="Section filter">
            <option value="all">All Sections</option>
            <option value="idiom">Idioms</option>
            <option value="capture">Capture</option>
            <option value="in-progress">In Progress</option>
            <option value="complete">Complete</option>
            <option value="daily">Daily</option>
          </select>
          <div class="vc-global-context">
            <span class="vc-context-label">Context</span>
            <select id="vc-context-select" class="vc-dropdown" aria-label="Verse context">
              <option value="0">Exact</option>
              <option value="1">&plusmn;1</option>
              <option value="2">&plusmn;2</option>
              <option value="3">&plusmn;3</option>
              <option value="5">&plusmn;5</option>
              <option value="-1">Chapter</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div id="vc-count" class="vc-count" aria-live="polite"></div>

        {/* Breadcrumb trail (sticky, shows chain path) */}
        <div id="vc-breadcrumbs" class="vc-breadcrumbs" style="display:none"></div>

        {/* Horizontal flow container (desktop) / vertical stack (mobile) */}
        <div id="vc-flow" class="vc-flow">
          {/* SVG overlay for connecting lines */}
          <svg id="vc-lines" class="vc-lines"></svg>
          {/* Columns get appended here dynamically */}
        </div>

        {/* Note preview popup (desktop hover) */}
        <div id="vc-note-preview" class="vc-note-preview"></div>
      </div>
    )
  }

  VerseChainExplorer.css = style
  VerseChainExplorer.afterDOMLoaded = script

  return VerseChainExplorer
}) satisfies QuartzComponentConstructor
