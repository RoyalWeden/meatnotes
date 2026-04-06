// Sidebar collapse system — collapsible left (with icon rail) and right sidebars
// State persisted in localStorage grouped by page type

const DESKTOP_BREAKPOINT = 1200

function getPageType(): string {
  const slug = document.body.getAttribute("data-slug") || ""
  if (slug === "index") return "home"
  if (slug === "Dashboard") return "dashboard"
  if (slug === "Verse-Chain") return "verse-chain"
  if (slug === "Books-and-PDFs") return "books"
  if (slug === "All-Notes") return "all-notes"
  if (slug === "Search") return "search"
  if (slug.startsWith("Daily/")) return "daily"
  return "note"
}

function getStorageKey(side: "left" | "right"): string {
  return `sidebar-${side}-${getPageType()}`
}

function isDesktop(): boolean {
  return window.innerWidth >= DESKTOP_BREAKPOINT
}

function setSidebarState(side: "left" | "right", collapsed: boolean): void {
  const attr = `data-sidebar-${side}`
  if (collapsed) {
    document.body.setAttribute(attr, "collapsed")
  } else {
    document.body.removeAttribute(attr)
  }
  try {
    localStorage.setItem(getStorageKey(side), collapsed ? "collapsed" : "expanded")
  } catch {}
  updateToggleUI(side)
}

function getSidebarState(side: "left" | "right"): boolean {
  try {
    return localStorage.getItem(getStorageKey(side)) === "collapsed"
  } catch {
    return false
  }
}

function toggleSidebar(side: "left" | "right"): void {
  const attr = `data-sidebar-${side}`
  const isCollapsed = document.body.getAttribute(attr) === "collapsed"
  setSidebarState(side, !isCollapsed)
}

// Update toggle button arrow direction and tooltip based on current state
function updateToggleUI(side: "left" | "right"): void {
  const selector = side === "left" ? ".sidebar-toggle-left" : ".sidebar-toggle-right"
  const btn = document.querySelector(selector) as HTMLElement | null
  if (!btn) return

  const attr = `data-sidebar-${side}`
  const isCollapsed = document.body.getAttribute(attr) === "collapsed"
  const polyline = btn.querySelector("polyline")

  if (side === "left") {
    // Collapsed: arrow points RIGHT (expand), Expanded: arrow points LEFT (collapse)
    if (polyline) polyline.setAttribute("points", isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6")
    btn.setAttribute("data-tooltip", isCollapsed ? "Expand sidebar [" : "Collapse sidebar [")
    btn.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar")
  } else {
    // Collapsed: arrow points LEFT (expand), Expanded: arrow points RIGHT (collapse)
    if (polyline) polyline.setAttribute("points", isCollapsed ? "15 18 9 12 15 6" : "9 18 15 12 9 6")
    btn.setAttribute("data-tooltip", isCollapsed ? "Expand sidebar ]" : "Collapse sidebar ]")
    btn.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar")
  }
}

document.addEventListener("nav", () => {
  if (!isDesktop()) return

  // Restore saved state
  const leftCollapsed = getSidebarState("left")
  const rightCollapsed = getSidebarState("right")
  setSidebarState("left", leftCollapsed)
  setSidebarState("right", rightCollapsed)

  // Auto-collapse right sidebar on Verse-Chain
  const slug = document.body.getAttribute("data-slug")
  if (slug === "Verse-Chain") {
    setSidebarState("right", true)
  }

  // Update UI for both toggles
  updateToggleUI("left")
  updateToggleUI("right")

  // ── Toggle buttons ──
  const leftToggle = document.querySelector(".sidebar-toggle-left") as HTMLElement | null
  const rightToggle = document.querySelector(".sidebar-toggle-right") as HTMLElement | null

  function onLeftToggle(e: Event) { e.preventDefault(); toggleSidebar("left") }
  function onRightToggle(e: Event) { e.preventDefault(); toggleSidebar("right") }

  if (leftToggle) {
    leftToggle.addEventListener("pointerdown", onLeftToggle)
    window.addCleanup(() => leftToggle.removeEventListener("pointerdown", onLeftToggle))
  }

  if (rightToggle) {
    rightToggle.addEventListener("pointerdown", onRightToggle)
    window.addCleanup(() => rightToggle.removeEventListener("pointerdown", onRightToggle))
  }

  // ── Keyboard shortcuts ──
  function onKeyDown(e: KeyboardEvent) {
    // Skip if typing in an input
    const tag = (e.target as HTMLElement).tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
    if ((e.target as HTMLElement).isContentEditable) return

    if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      toggleSidebar("left")
    } else if (e.key === "]" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      toggleSidebar("right")
    }
  }

  document.addEventListener("keydown", onKeyDown)
  window.addCleanup(() => document.removeEventListener("keydown", onKeyDown))
})
