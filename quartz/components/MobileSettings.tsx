// @ts-ignore
import script from "./scripts/mobileSettings.inline"
import styles from "./styles/mobileSettings.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const MobileSettings: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <div class="mobile-settings">
      {/* Gear FAB — visible only on mobile */}
      <button class="mobile-settings-fab" aria-label="Settings" data-tooltip="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Bottom sheet backdrop + container */}
      <div class="mobile-settings-backdrop" aria-hidden="true" />
      <div class="mobile-settings-sheet" role="dialog" aria-label="Settings">
        <div class="mobile-settings-handle" />
        <div class="mobile-settings-content">
          <h3 class="mobile-settings-title">Appearance</h3>
          <div class="theme-toggle" role="radiogroup" aria-label="Theme">
            <button class="theme-toggle-btn" data-theme="light" aria-label="Light mode">
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
              <span>Light</span>
            </button>
            <button class="theme-toggle-btn" data-theme="dark" aria-label="Dark mode">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </button>
            <button class="theme-toggle-btn" data-theme="system" aria-label="System theme">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>System</span>
            </button>
            <div class="theme-toggle-pill" aria-hidden="true" />
          </div>

          {/* Accent color — same palette as desktop, larger swatches for touch */}
          <h3 class="mobile-settings-title mobile-settings-title-accent">Accent</h3>
          <div class="accent-picker accent-picker-mobile" role="radiogroup" aria-label="Accent color">
            <button class="accent-swatch" data-set-accent="blue"     aria-label="Blue"></button>
            <button class="accent-swatch" data-set-accent="purple"   aria-label="Purple"></button>
            <button class="accent-swatch" data-set-accent="pink"     aria-label="Pink"></button>
            <button class="accent-swatch" data-set-accent="red"      aria-label="Red"></button>
            <button class="accent-swatch" data-set-accent="orange"   aria-label="Orange"></button>
            <button class="accent-swatch" data-set-accent="yellow"   aria-label="Yellow"></button>
            <button class="accent-swatch" data-set-accent="green"    aria-label="Green"></button>
            <button class="accent-swatch" data-set-accent="graphite" aria-label="Graphite"></button>
          </div>
        </div>
      </div>
    </div>
  )
}

MobileSettings.css = styles
MobileSettings.afterDOMLoaded = script

export default (() => MobileSettings) satisfies QuartzComponentConstructor
