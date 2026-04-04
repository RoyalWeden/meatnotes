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
            <div class="pd-heatmap-label">Activity (past year)</div>
            <div class="pd-heatmap" id="pd-heatmap"></div>
          </div>
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
