import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/topicalChain.inline"
import style from "./styles/topicalChain.scss"

export default (() => {
  const TopicalChain: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    return (
      <details class="right-rail-section topical-chain" id="topical-chain" data-base-url={cfg.baseUrl ?? ""} open>
        <summary>
          <h3>Verse Connections</h3>
          <svg class="rrs-fold" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </summary>
        <div class="tc-content rrs-content" id="tc-content"></div>
      </details>
    )
  }

  TopicalChain.css = style
  TopicalChain.afterDOMLoaded = script

  return TopicalChain
}) satisfies QuartzComponentConstructor
