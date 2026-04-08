import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/bibleReader.inline"
import style from "./styles/bibleReader.scss"

export default (() => {
  const BibleReader: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    return (
      <div class="bible-reader" data-base-url={cfg.baseUrl ?? ""}>
        {/* Search bar */}
        <div class="br-search-wrap">
          <svg class="br-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            id="br-input"
            class="br-input"
            placeholder="Search a verse, chapter, or range... e.g. John 3, Psalm 23:1-6"
            autocomplete="off"
            aria-label="Search verse or chapter"
          />
          <button id="br-input-clear" class="br-input-clear" aria-label="Clear">&times;</button>
          <ul id="br-autocomplete" class="br-autocomplete" role="listbox" aria-label="Suggestions"></ul>
        </div>

        {/* Navigation bar */}
        <div class="br-nav" id="br-nav" style="display:none">
          <button id="br-prev" class="br-nav-btn pressable" data-tooltip="Previous chapter" aria-label="Previous chapter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button id="br-book-picker-btn" class="br-nav-title pressable" data-tooltip="Pick book &amp; chapter"></button>
          <button id="br-next" class="br-nav-btn pressable" data-tooltip="Next chapter" aria-label="Next chapter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>

        {/* Main content: two-panel layout */}
        <div class="br-content" id="br-content" style="display:none">
          {/* Left: Verse text */}
          <div class="br-text-panel" id="br-text-panel">
            <div class="br-text-body" id="br-text-body"></div>
          </div>

          {/* Right: Notes sidebar */}
          <div class="br-notes-panel" id="br-notes-panel">
            <div class="br-notes-header">
              <span class="br-notes-title">Notes</span>
              <span class="br-notes-count" id="br-notes-count"></span>
            </div>
            <div class="br-notes-body" id="br-notes-body"></div>
          </div>
        </div>

        {/* Onboarding */}
        <div id="br-onboarding" class="br-onboarding">
          <div class="br-onboarding-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <div class="br-onboarding-text">Search any verse or chapter to start reading</div>
          <div class="br-onboarding-examples">
            Try: <button class="br-example-link" data-ref="John 3">John 3</button>
            {" "}&middot;{" "}
            <button class="br-example-link" data-ref="Psalm 23">Psalm 23</button>
            {" "}&middot;{" "}
            <button class="br-example-link" data-ref="Isaiah 53">Isaiah 53</button>
            {" "}&middot;{" "}
            <button class="br-example-link" data-ref="Romans 8">Romans 8</button>
          </div>
        </div>

        {/* Book/Chapter picker sheet */}
        <div id="br-picker-backdrop" class="br-picker-backdrop"></div>
        <div id="br-picker" class="br-picker">
          <div class="br-picker-header">
            <span class="br-picker-title">Select Book &amp; Chapter</span>
            <button id="br-picker-close" class="br-picker-close pressable" aria-label="Close">&times;</button>
          </div>
          <div class="br-picker-body" id="br-picker-body"></div>
        </div>

        {/* Mobile notes toggle */}
        <button id="br-mobile-notes-toggle" class="br-mobile-notes-toggle" style="display:none" aria-label="Show notes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span id="br-mobile-notes-badge"></span>
        </button>

        {/* Mobile notes bottom sheet */}
        <div id="br-mobile-sheet-backdrop" class="br-mobile-sheet-backdrop"></div>
        <div id="br-mobile-sheet" class="br-mobile-sheet">
          <div class="br-mobile-sheet-handle"></div>
          <div class="br-mobile-sheet-header">
            <span>Notes</span>
            <span id="br-mobile-sheet-count"></span>
            <button id="br-mobile-sheet-close" class="br-picker-close pressable" aria-label="Close">&times;</button>
          </div>
          <div class="br-mobile-sheet-body" id="br-mobile-sheet-body"></div>
        </div>

        {/* Note preview popover */}
        <div id="br-note-preview" class="br-note-preview"></div>
      </div>
    )
  }

  BibleReader.css = style
  BibleReader.afterDOMLoaded = script

  return BibleReader
}) satisfies QuartzComponentConstructor
