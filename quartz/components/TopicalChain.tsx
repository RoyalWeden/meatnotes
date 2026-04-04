import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/topicalChain.inline"
import style from "./styles/topicalChain.scss"

export default (() => {
  const TopicalChain: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    return (
      <div class="topical-chain" id="topical-chain" data-base-url={cfg.baseUrl ?? ""}>
        <h3 class="tc-title">Verse Connections</h3>
        <div class="tc-content" id="tc-content"></div>
      </div>
    )
  }

  TopicalChain.css = style
  TopicalChain.afterDOMLoaded = script

  return TopicalChain
}) satisfies QuartzComponentConstructor
