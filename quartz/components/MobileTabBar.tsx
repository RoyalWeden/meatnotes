// MobileTabBar — iOS-style floating glass bar pinned to the bottom of mobile
// viewports (≤800px). Consolidates the previously-scattered FABs into one
// translucent bar with four buttons:
//
//   ☰ Menu     → toggles the explorer drawer (clicks .mobile-explorer)
//   ⌘K Search  → opens the search modal (clicks .search-button)
//   📅 Today   → navigates to today's daily note (or shows tooltip if missing)
//   ⋯ More     → opens the MobileSettings sheet (clicks .mobile-settings-fab)
//
// Existing component FABs (BackToTop, ShortlinkButton, MobileSettings gear,
// daily-calendar pill) are hidden on mobile via custom.scss when this bar is
// active — their functionality lives inside this bar's More-sheet or the
// individual buttons proxy clicks back to the existing buttons so no logic
// is duplicated.
//
// Auto-hides on scroll-down past 80px; reveals on scroll-up. Sits above the
// iPhone home indicator via env(safe-area-inset-bottom).

import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const MobileTabBar: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <div class="mobile-tab-bar" role="navigation" aria-label="Quick actions">
      <button class="mtb-btn" data-action="menu" aria-label="Toggle navigation menu" data-tooltip="Menu">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="4" x2="20" y1="6" y2="6"/>
          <line x1="4" x2="20" y1="12" y2="12"/>
          <line x1="4" x2="20" y1="18" y2="18"/>
        </svg>
        <span class="mtb-label">Menu</span>
      </button>
      <button class="mtb-btn" data-action="search" aria-label="Open search" data-tooltip="Search">
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" x2="16.65" y1="21" y2="16.65"/>
        </svg>
        <span class="mtb-label">Search</span>
      </button>
      <button class="mtb-btn" data-action="today" aria-label="Today's daily note" data-tooltip="Today">
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
        </svg>
        <span class="mtb-label">Today</span>
      </button>
      <button class="mtb-btn" data-action="more" aria-label="More options" data-tooltip="More">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="5" cy="12" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="19" cy="12" r="1"/>
        </svg>
        <span class="mtb-label">More</span>
      </button>
    </div>
  )
}

MobileTabBar.css = `
.mobile-tab-bar {
  display: none; /* desktop hidden by default */
}

/* Show on:
   - Any viewport ≤800px (phone width — catches Firefox/Chrome RDM which
     doesn't simulate pointer:coarse, and real phones)
   - Touch devices up to 1199px (tablets in portrait, real mobile browsers) */
@media (max-width: 800px),
       (pointer: coarse) and (max-width: 1199px),
       (hover: none) and (max-width: 1199px) {
  .mobile-tab-bar {
    display: flex;
    position: fixed;
    bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    gap: 4px;
    padding: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--light) 76%, transparent);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.12),
      0 2px 6px rgba(0, 0, 0, 0.06),
      inset 0 0 0 0.5px color-mix(in srgb, var(--light) 30%, transparent);
    transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease;
    pointer-events: auto;
  }

  /* Auto-hide on scroll-down (JS toggles .mtb-hidden) */
  .mobile-tab-bar.mtb-hidden {
    transform: translate(-50%, calc(100% + 1.5rem));
    opacity: 0;
    pointer-events: none;
  }

  .mtb-btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: transparent;
    border: none;
    padding: 6px 14px;
    border-radius: 999px;
    color: var(--darkgray);
    cursor: pointer;
    font-family: inherit;
    transition: color 0.12s ease, background-color 0.12s ease, transform 80ms ease;
    min-width: 56px;
  }

  .mtb-btn:hover { color: var(--accent); }
  .mtb-btn:active { transform: scale(0.94); }
  .mtb-btn[aria-current="page"],
  .mtb-btn.mtb-active {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .mtb-label {
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1;
  }

  /* Hide the existing scattered mobile FABs — their jobs are now in the bar.
     The bar's More-sheet (the existing MobileSettings sheet) still opens via
     the .mobile-settings-fab event handler, but the FAB itself is hidden.
     Applies on tablet too (≤1199) since the bar handles their roles. */
  .mobile-settings-fab,
  #back-to-top,
  #shortlink-btn,
  #cal-mobile-btn,
  #daily-prev-btn,
  #daily-next-btn { display: none !important; }
}

/* Bar-clearance bottom padding — only when the bar is showing (touch
   devices under 1199px). Keeps the existing mobile top bar + explorer
   drawer intact. */
@media (max-width: 800px),
       (pointer: coarse) and (max-width: 1199px),
       (hover: none) and (max-width: 1199px) {
  body { padding-bottom: max(72px, calc(env(safe-area-inset-bottom, 0px) + 60px)); }
}
`

MobileTabBar.afterDOMLoaded = `
(function () {
  function pad(n) { return String(n).padStart(2, '0') }
  function todaySlug() {
    var d = new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  function relUrlForDaily(currentSlug, target) {
    var slug = currentSlug || ''
    // If we're already inside the Daily/ folder, navigate to a sibling.
    // Without this guard, /Daily/2026-05-03 + '../Daily/X' resolves to
    // /Daily/Daily/X (the first '../' walks from the file to /Daily/, then
    // 'Daily/X' appends another Daily — that was the bug).
    if (slug.indexOf('Daily/') === 0) return './' + target
    var depth = slug.split('/').length - 1
    var up = depth > 0 ? new Array(depth + 1).join('../') : './'
    return up + 'Daily/' + target
  }

  function findBtn(action) {
    return document.querySelector('.mobile-tab-bar .mtb-btn[data-action="' + action + '"]')
  }

  function init() {
    var bar = document.querySelector('.mobile-tab-bar')
    if (!bar) return

    // CRITICAL: move the bar to <body> root so position:fixed resolves
    // against the viewport. The bar is server-rendered inside .page-footer
    // which is inside .center > #quartz-body > .page — any ancestor with
    // backdrop-filter / transform / will-change / filter creates a new
    // containing block and breaks position:fixed. Reparenting to <body>
    // sidesteps the problem entirely.
    //
    // Quartz SPA only replaces #quartz-body, not afterBody components, so
    // the bar stays at body root across navigations — we never remove it.
    if (bar.parentElement !== document.body) {
      document.body.appendChild(bar)
    }

    // On SPA nav the bar is already initialized — just refresh today state.
    if (bar.dataset.mtbInit) {
      var todayBtn = findBtn('today')
      if (todayBtn) {
        var currentSlug = (document.body.getAttribute('data-slug') || '')
        if (currentSlug === 'Daily/' + todaySlug()) todayBtn.classList.add('mtb-active')
        else todayBtn.classList.remove('mtb-active')
      }
      return
    }

    if (bar.dataset.mtbInit) return
    bar.dataset.mtbInit = '1'

    // Robust click trigger: .click() works on display:none in modern browsers,
    // but a synthetic click event with bubbles:true is more reliable across
    // edge cases (delegated handlers, event phases). Fire both for safety.
    function trigger(el) {
      if (!el) return
      el.click()
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    }

    // ── Click handlers — proxy back to existing components so nothing dupes ──
    var menu = findBtn('menu')
    if (menu) menu.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      // Phone (≤800px): the explorer flips into a fixed-position slide-in
      // drawer. Toggle .explorer.collapsed → .explorer-content slides in.
      // Tablet (800–1199px): the explorer is the always-visible left
      // column. The "Menu" action there means "show/hide the rail" via
      // SidebarCollapse — proxy a click on its .sidebar-toggle-left chip.
      if (window.matchMedia('(max-width: 800px)').matches) {
        var explorer = document.querySelector('.explorer')
        if (!explorer) return
        var nowCollapsed = explorer.classList.toggle('collapsed')
        explorer.setAttribute('aria-expanded', String(!nowCollapsed))
        if (nowCollapsed) document.documentElement.classList.remove('mobile-no-scroll')
        else document.documentElement.classList.add('mobile-no-scroll')
      } else {
        trigger(document.querySelector('.sidebar-toggle-left'))
      }
    })

    var search = findBtn('search')
    if (search) search.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      // Try the explicit search button first.
      var sb = document.querySelector('.search > .search-button')
      if (sb) { trigger(sb); return }
      // Fallback: directly open the search-container by adding .active
      // and focusing the input. The search modal is shared across instances.
      var container = document.querySelector('.search > .search-container')
      var input = document.querySelector('.search-bar')
      if (container) container.classList.add('active')
      if (input) setTimeout(function () { input.focus() }, 30)
    })

    var more = findBtn('more')
    if (more) more.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      // Try the proxy click first.
      var fab = document.querySelector('.mobile-settings-fab')
      if (fab) trigger(fab)
      // Direct fallback: toggle the sheet open class. mobileSettings.inline.ts
      // listens for clicks on .mobile-settings-backdrop to close, so just
      // adding .open is enough to surface the sheet.
      var sheet = document.querySelector('.mobile-settings-sheet')
      var backdrop = document.querySelector('.mobile-settings-backdrop')
      if (sheet && !sheet.classList.contains('open')) {
        sheet.classList.add('open')
        if (backdrop) backdrop.classList.add('open')
        document.body.style.overflow = 'hidden'
      }
    })

    var today = findBtn('today')
    if (today) today.addEventListener('click', function (e) {
      e.preventDefault()
      var slug = todaySlug()
      var currentSlug = (document.body.getAttribute('data-slug') || '')
      if (currentSlug === 'Daily/' + slug) return // already there
      window.location.href = relUrlForDaily(currentSlug, slug)
    })

    // Mark today-icon active when actually on today's daily note.
    if (today) {
      var slug = (document.body.getAttribute('data-slug') || '')
      if (slug === 'Daily/' + todaySlug()) today.classList.add('mtb-active')
      else today.classList.remove('mtb-active')
    }

    // ── Auto-hide on scroll-down, reveal on scroll-up ──
    var lastY = window.scrollY
    var ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(function () {
        var y = window.scrollY
        var dy = y - lastY
        // Threshold: only react past 80px and only on >8px deltas
        if (y > 80 && dy > 8) bar.classList.add('mtb-hidden')
        else if (dy < -8) bar.classList.remove('mtb-hidden')
        lastY = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    if (typeof window.addCleanup === 'function') {
      window.addCleanup(function () { window.removeEventListener('scroll', onScroll) })
    }
  }

  init()
  document.addEventListener('nav', init)
})()
`

export default (() => MobileTabBar) satisfies QuartzComponentConstructor
