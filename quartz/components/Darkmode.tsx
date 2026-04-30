// @ts-ignore
import darkmodeScript from "./scripts/darkmode.inline"
import styles from "./styles/darkmode.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const Darkmode: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class="theme-float">
    <div class={classNames(displayClass, "theme-toggle")} role="radiogroup" aria-label="Theme">
      <button
        class="theme-toggle-btn"
        data-theme="light"
        aria-label="Light mode"
        data-tooltip="Light mode"
      >
        {/* Sun icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>
      <button
        class="theme-toggle-btn"
        data-theme="dark"
        aria-label="Dark mode"
        data-tooltip="Dark mode"
      >
        {/* Moon icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
      <button
        class="theme-toggle-btn"
        data-theme="system"
        aria-label="System theme"
        data-tooltip="Match system"
      >
        {/* Monitor icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>
      <div class="theme-toggle-pill" aria-hidden="true" />
    </div>
    {/* macOS accent palette — wired up by AccentPicker.afterDOMLoaded.
        Click handler delegates from <html>, so this markup just needs the
        data-set-accent attributes; visual state is synced by AccentPicker. */}
    <div class="accent-picker" role="radiogroup" aria-label="Accent color">
      <button class="accent-swatch" data-set-accent="blue"     aria-label="Blue"     data-tooltip="Blue"></button>
      <button class="accent-swatch" data-set-accent="purple"   aria-label="Purple"   data-tooltip="Purple"></button>
      <button class="accent-swatch" data-set-accent="pink"     aria-label="Pink"     data-tooltip="Pink"></button>
      <button class="accent-swatch" data-set-accent="red"      aria-label="Red"      data-tooltip="Red"></button>
      <button class="accent-swatch" data-set-accent="orange"   aria-label="Orange"   data-tooltip="Orange"></button>
      <button class="accent-swatch" data-set-accent="yellow"   aria-label="Yellow"   data-tooltip="Yellow"></button>
      <button class="accent-swatch" data-set-accent="green"    aria-label="Green"    data-tooltip="Green"></button>
      <button class="accent-swatch" data-set-accent="graphite" aria-label="Graphite" data-tooltip="Graphite"></button>
    </div>
    </div>
  )
}

Darkmode.beforeDOMLoaded = darkmodeScript
Darkmode.css = styles

export default (() => Darkmode) satisfies QuartzComponentConstructor
