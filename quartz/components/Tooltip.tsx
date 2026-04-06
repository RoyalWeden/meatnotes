// Global tooltip provider — no visible output, just registers the tooltip script + styles
// @ts-ignore
import tooltipScript from "./scripts/tooltip.inline"
import tooltipStyle from "./styles/tooltip.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Tooltip: QuartzComponent = (_props: QuartzComponentProps) => {
  return <></>
}

Tooltip.afterDOMLoaded = tooltipScript
Tooltip.css = tooltipStyle

export default (() => Tooltip) satisfies QuartzComponentConstructor
