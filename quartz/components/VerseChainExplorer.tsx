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
          <ul id="vc-autocomplete" class="vc-autocomplete" role="listbox" aria-label="Suggestions"></ul>
        </div>

        {/* History chips */}
        <div id="vc-history" class="vc-history" aria-label="Search history"></div>

        {/* Controls row: filter chips + view toggle + verses-only + export */}
        <div class="vc-controls">
          <div class="vc-filters" id="vc-filters" role="group" aria-label="Section filter">
            <button class="vc-filter-chip active" data-filter="all">All</button>
            <button class="vc-filter-chip" data-filter="idiom">Idioms</button>
            <button class="vc-filter-chip" data-filter="capture">Capture</button>
            <button class="vc-filter-chip" data-filter="in-progress">In Progress</button>
            <button class="vc-filter-chip" data-filter="complete">Complete</button>
            <button class="vc-filter-chip" data-filter="daily">Daily</button>
          </div>
          <div class="vc-actions">
            <button id="vc-verses-only" class="vc-action-btn" aria-pressed="false" title="Show verses only">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <button id="vc-view-toggle" class="vc-action-btn vc-desktop-only" aria-label="Toggle graph view" title="Graph view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/>
                <path d="M7 11l10-4M7 13l10 4"/>
              </svg>
            </button>
            <button id="vc-export" class="vc-action-btn" title="Copy as markdown">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Results count */}
        <div id="vc-count" class="vc-count" aria-live="polite"></div>

        {/* Tree view */}
        <div id="vc-tree" class="vc-tree"></div>

        {/* Graph view (desktop only) */}
        <div id="vc-graph" class="vc-graph vc-desktop-only" style="display:none;"></div>
      </div>
    )
  }

  VerseChainExplorer.css = style
  VerseChainExplorer.afterDOMLoaded = script

  return VerseChainExplorer
}) satisfies QuartzComponentConstructor
