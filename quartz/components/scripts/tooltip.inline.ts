// Global tooltip system — provides window.__tooltip API for all components
// Usage: add data-tooltip="Text here" to any element, or call window.__tooltip.show(el, text)

declare global {
  interface Window {
    __tooltip: {
      show: (anchor: HTMLElement, text: string, html?: string) => void
      hide: () => void
    }
  }
}

let tooltipEl: HTMLDivElement | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let currentAnchor: HTMLElement | null = null
let isRich = false
const DELAY_MS = 300
const HIDE_DELAY_MS = 150 // delay before hiding rich tooltips (allows mouse to travel)

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div")
    tooltipEl.id = "global-tooltip"
    tooltipEl.setAttribute("role", "tooltip")
    document.body.appendChild(tooltipEl)

    // Keep rich tooltip alive when mouse enters it
    tooltipEl.addEventListener("mouseenter", () => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    })

    // Hide when mouse leaves the tooltip (unless going back to anchor)
    tooltipEl.addEventListener("mouseleave", (e) => {
      const related = e.relatedTarget as HTMLElement | null
      if (related && currentAnchor && (related === currentAnchor || currentAnchor.contains(related))) return
      scheduleHide()
    })
  }
  return tooltipEl
}

function positionTooltip(anchor: HTMLElement, tip: HTMLDivElement) {
  const rect = anchor.getBoundingClientRect()
  const tipRect = tip.getBoundingClientRect()
  const gap = 8

  // Default: above
  let top = rect.top - tipRect.height - gap
  let placeBelow = false

  // Flip below if too close to top
  if (top < 8) {
    top = rect.bottom + gap
    placeBelow = true
  }

  // Horizontal: centered on anchor
  let left = rect.left + rect.width / 2 - tipRect.width / 2

  // Clamp to viewport
  const vw = window.innerWidth
  if (left < 8) left = 8
  if (left + tipRect.width > vw - 8) left = vw - tipRect.width - 8

  tip.style.top = `${top}px`
  tip.style.left = `${left}px`
  tip.classList.toggle("below", placeBelow)
}

function show(anchor: HTMLElement, text: string, html?: string) {
  if (currentAnchor === anchor) return
  hideNow()
  currentAnchor = anchor
  isRich = !!html

  showTimer = setTimeout(() => {
    const tip = getTooltip()
    if (html) {
      tip.innerHTML = html
      tip.classList.add("rich")
    } else {
      tip.textContent = text
      tip.classList.remove("rich")
    }
    tip.style.top = "-9999px"
    tip.style.left = "-9999px"
    tip.classList.remove("visible", "below")

    // Force layout to get dimensions
    requestAnimationFrame(() => {
      positionTooltip(anchor, tip)
      requestAnimationFrame(() => {
        tip.classList.add("visible")
      })
    })
  }, DELAY_MS)
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  if (isRich) {
    // Delay hide for rich tooltips so user can move mouse to tooltip
    hideTimer = setTimeout(hideNow, HIDE_DELAY_MS)
  } else {
    hideNow()
  }
}

function hideNow() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  currentAnchor = null
  isRich = false
  if (tooltipEl) {
    tooltipEl.classList.remove("visible")
  }
}

// Keep backwards compatible
function hide() {
  scheduleHide()
}

// Expose global API
window.__tooltip = { show, hide }

// Auto-attach to [data-tooltip] elements via event delegation
document.addEventListener("mouseover", (e) => {
  const target = (e.target as HTMLElement).closest?.("[data-tooltip]") as HTMLElement | null
  if (target) {
    const text = target.getAttribute("data-tooltip")
    if (text) show(target, text)
  }
})

document.addEventListener("mouseout", (e) => {
  const target = (e.target as HTMLElement).closest?.("[data-tooltip]") as HTMLElement | null
  if (!target) return
  const related = (e as MouseEvent).relatedTarget as HTMLElement | null
  // Don't hide if moving into the tooltip itself
  if (related && tooltipEl && (related === tooltipEl || tooltipEl.contains(related))) return
  scheduleHide()
})

// Hide on scroll or resize
document.addEventListener("scroll", hideNow, { passive: true, capture: true })
window.addEventListener("resize", hideNow, { passive: true })
