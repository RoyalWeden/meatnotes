import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/pipelineDashboard.inline"
import style from "./styles/pipelineDashboard.scss"

export default (() => {
  const PipelineDashboard: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    return (
      <div class="pipeline-dashboard" data-base-url={cfg.baseUrl ?? ""}>
        {/* Stats cards */}
        <div class="pd-stats" id="pd-stats"></div>

        {/* Pipeline bar */}
        <div class="pd-pipeline-wrap">
          <div class="pd-pipeline-label">Study Pipeline</div>
          <div class="pd-pipeline" id="pd-pipeline" role="img" aria-label="Study pipeline progress bar"></div>
        </div>

        {/* Study stats */}
        <div class="pd-study-stats" id="pd-study-stats">
          <div class="pd-streak-row" id="pd-streak-row"></div>
          <div class="pd-heatmap-wrap">
            <div class="pd-heatmap-label">Activity</div>
            <div class="pd-heatmap-container">
              <div class="pd-heatmap-days" id="pd-heatmap-days"></div>
              <div class="pd-heatmap-scroll" id="pd-heatmap">
                <div class="pd-heatmap-months" id="pd-heatmap-months"></div>
                <div class="pd-heatmap-grid" id="pd-heatmap-grid"></div>
              </div>
            </div>
            <button class="pd-back-to-today" id="pd-back-to-today" style="display:none">
              <svg id="pd-back-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line id="pd-arrow-line" x1="19" y1="12" x2="5" y2="12"/><polyline id="pd-arrow-head" points="12 19 5 12 12 5"/>
              </svg>
              <span id="pd-back-to-today-text">Today</span>
            </button>
          </div>
        </div>

        {/* Day detail panel (slides in from right) */}
        <div id="pd-day-panel-backdrop" class="pd-day-panel-backdrop"></div>
        <div id="pd-day-panel" class="pd-day-panel">
          <div class="pd-day-panel-header">
            <h3 id="pd-day-panel-title"></h3>
            <button id="pd-day-panel-close" class="pd-day-panel-close pressable" data-tooltip="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div id="pd-day-panel-body" class="pd-day-panel-body"></div>
        </div>

        {/* Recently modified */}
        <div class="pd-section" id="pd-recent">
          <div class="pd-section-title">Recently Modified</div>
          <div class="pd-recent-list" id="pd-recent-list"></div>
        </div>

        {/* Stale studies */}
        <div class="pd-section" id="pd-stale">
          <div class="pd-section-title">Stale Studies</div>
          <div class="pd-stale-list" id="pd-stale-list"></div>
        </div>
      </div>
    )
  }

  PipelineDashboard.css = style
  PipelineDashboard.afterDOMLoaded = script

  return PipelineDashboard
}) satisfies QuartzComponentConstructor
