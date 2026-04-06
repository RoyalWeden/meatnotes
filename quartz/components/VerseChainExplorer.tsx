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

        {/* Controls row: filter chips + context slider + export */}
        <div class="vc-controls">
          <div class="vc-filters" id="vc-filters" role="group" aria-label="Section filter">
            <button class="vc-filter-chip pressable active" data-filter="all" data-tooltip="Show all sections">All</button>
            <button class="vc-filter-chip pressable" data-filter="idiom" data-tooltip="Bible idiom notes">Idioms</button>
            <button class="vc-filter-chip pressable" data-filter="capture" data-tooltip="Quick captures">Capture</button>
            <button class="vc-filter-chip pressable" data-filter="in-progress" data-tooltip="In-progress studies">In Progress</button>
            <button class="vc-filter-chip pressable" data-filter="complete" data-tooltip="Completed studies">Complete</button>
            <button class="vc-filter-chip pressable" data-filter="daily" data-tooltip="Daily journal notes">Daily</button>
          </div>
          <div class="vc-actions">
            <div class="vc-global-context" id="vc-global-context" data-tooltip="Verse context — how many surrounding verses to show">
              <span class="vc-context-label">Context</span>
              <div class="vc-context-step pressables" id="vc-context-steps">
                <button class="vc-context-step pressable active" data-ctx="0" data-tooltip="Verse text only">0</button>
                <button class="vc-context-step pressable" data-ctx="1" data-tooltip="Show ±1 surrounding verse">&plusmn;1</button>
                <button class="vc-context-step pressable" data-ctx="2" data-tooltip="Show ±2 surrounding verses">&plusmn;2</button>
                <button class="vc-context-step pressable" data-ctx="3" data-tooltip="Show ±3 surrounding verses">&plusmn;3</button>
                <button class="vc-context-step pressable" data-ctx="5" data-tooltip="Show ±5 surrounding verses">&plusmn;5</button>
                <button class="vc-context-step pressable" data-ctx="-1" data-tooltip="Show full chapter">Ch</button>
              </div>
            </div>
            <button id="vc-export" class="vc-action-btn pressable" data-tooltip="Copy as Markdown">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
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
