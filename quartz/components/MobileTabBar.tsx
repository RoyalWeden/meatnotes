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
      <button class="mtb-btn" data-action="prev" aria-label="Previous daily note" data-tooltip="Prev">
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span class="mtb-label">Prev</span>
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
      <button class="mtb-btn" data-action="next" aria-label="Next daily note" data-tooltip="Next">
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span class="mtb-label">Next</span>
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

  /* Scroll-shrink: labels fade out and bar gets tighter on scroll-down */
  .mobile-tab-bar.mtb-shrunk {
    padding: 4px 6px;
  }

  .mobile-tab-bar.mtb-shrunk .mtb-label {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    margin-top: 0;
  }

  .mtb-label {
    transition: opacity 200ms ease, max-height 200ms ease;
    overflow: hidden;
    max-height: 1em;
    margin-top: 0;
  }

  /* Daily-note adaptive: show Prev/Next, hide Today */
  .mtb-btn[data-action="prev"],
  .mtb-btn[data-action="next"] {
    display: none;
  }

  .mobile-tab-bar.mtb-daily .mtb-btn[data-action="today"] {
    display: none;
  }

  .mobile-tab-bar.mtb-daily .mtb-btn[data-action="prev"],
  .mobile-tab-bar.mtb-daily .mtb-btn[data-action="next"] {
    display: inline-flex;
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
    if (slug.indexOf('Daily/') === 0) return './' + target
    var depth = slug.split('/').length - 1
    var up = depth > 0 ? new Array(depth + 1).join('../') : './'
    return up + 'Daily/' + target
  }

  function offsetDateSlug(dateSlug, days) {
    var parts = dateSlug.split('-')
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    d.setDate(d.getDate() + days)
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  function findBtn(action) {
    return document.querySelector('.mobile-tab-bar .mtb-btn[data-action="' + action + '"]')
  }

  function haptic() {
    try { navigator.vibrate && navigator.vibrate(5) } catch(e) {}
  }

  function getMenuBackdrop() {
    var bd = document.querySelector('.menu-backdrop')
    if (!bd) {
      bd = document.createElement('div')
      bd.className = 'menu-backdrop'
      document.body.appendChild(bd)
    }
    return bd
  }

  function closeExplorer(explorer, backdrop) {
    explorer.classList.add('collapsed')
    explorer.setAttribute('aria-expanded', 'false')
    document.documentElement.classList.remove('mobile-no-scroll')
    if (backdrop) backdrop.classList.remove('open')
    explorer.dataset.expanded = ''
  }

  function openExplorer(explorer, backdrop) {
    explorer.classList.remove('collapsed')
    explorer.setAttribute('aria-expanded', 'true')
    document.documentElement.classList.add('mobile-no-scroll')
    if (backdrop) backdrop.classList.add('open')
    haptic()
  }

  function setupExplorerDrag(explorer) {
    var content = explorer.querySelector('.explorer-content')
    if (!content || content.dataset.dragInit) return
    content.dataset.dragInit = '1'

    var startY = 0
    var currentY = 0
    var dragging = false
    var isExpanded = false

    content.addEventListener('touchstart', function(e) {
      // Only initiate drag from the top handle area (::before is not touchable,
      // so we use the top 40px of the content element)
      var rect = content.getBoundingClientRect()
      if (e.touches[0].clientY - rect.top > 48) return
      startY = e.touches[0].clientY
      currentY = startY
      dragging = true
      content.style.transition = 'none'
    }, { passive: true })

    content.addEventListener('touchmove', function(e) {
      if (!dragging) return
      currentY = e.touches[0].clientY
      var dy = currentY - startY
      if (dy > 0 && !isExpanded) content.style.transform = 'translateY(' + Math.max(0, dy) + 'px)'
      if (dy < 0 && !isExpanded) content.style.transform = 'translateY(' + dy + 'px)'
    }, { passive: true })

    content.addEventListener('touchend', function() {
      if (!dragging) return
      dragging = false
      content.style.transition = ''
      content.style.transform = ''
      var dy = currentY - startY
      if (dy < -60 && !isExpanded) {
        isExpanded = true
        explorer.dataset.expanded = '1'
        content.style.height = 'calc(100svh - env(safe-area-inset-top, 44px) - 8px)'
        content.style.maxHeight = 'calc(100svh - env(safe-area-inset-top, 44px) - 8px)'
      } else if (dy > 80) {
        if (isExpanded) {
          isExpanded = false
          explorer.dataset.expanded = ''
          content.style.height = ''
          content.style.maxHeight = ''
        } else {
          var bd = document.querySelector('.menu-backdrop')
          closeExplorer(explorer, bd)
        }
      }
    })
  }

  function trigger(el) {
    if (!el) return
    el.click()
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  }

  function refreshDailyState(bar) {
    var currentSlug = (document.body.getAttribute('data-slug') || '')
    var isDaily = currentSlug.indexOf('Daily/') === 0
    if (isDaily) {
      bar.classList.add('mtb-daily')
      var dateStr = currentSlug.replace('Daily/', '')
      var prevBtn = findBtn('prev')
      var nextBtn = findBtn('next')
      if (prevBtn) prevBtn.dataset.targetDate = offsetDateSlug(dateStr, -1)
      if (nextBtn) nextBtn.dataset.targetDate = offsetDateSlug(dateStr, 1)
    } else {
      bar.classList.remove('mtb-daily')
    }

    var todayBtn = findBtn('today')
    if (todayBtn) {
      if (currentSlug === 'Daily/' + todaySlug()) todayBtn.classList.add('mtb-active')
      else todayBtn.classList.remove('mtb-active')
    }
  }

  function init() {
    var bar = document.querySelector('.mobile-tab-bar')
    if (!bar) return

    // Reparent to <body> root so position:fixed resolves against viewport
    if (bar.parentElement !== document.body) {
      document.body.appendChild(bar)
    }

    // On SPA nav: bar already initialized — just refresh state
    if (bar.dataset.mtbInit) {
      refreshDailyState(bar)
      return
    }
    bar.dataset.mtbInit = '1'

    // ── Menu: open explorer as bottom sheet ────────────────────────────────
    var menu = findBtn('menu')
    if (menu) menu.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      if (window.matchMedia('(max-width: 800px)').matches) {
        var explorer = document.querySelector('.explorer')
        var bd = getMenuBackdrop()
        if (!explorer) {
          // 404 or page without explorer — open fallback nav sheet
          var fallback = document.querySelector('.menu-fallback-sheet')
          if (!fallback) return
          fallback.classList.add('open')
          bd.classList.add('open')
          document.documentElement.classList.add('mobile-no-scroll')
          haptic()
          return
        }
        if (!explorer.classList.contains('collapsed')) {
          closeExplorer(explorer, bd)
        } else {
          openExplorer(explorer, bd)
          setupExplorerDrag(explorer)
        }
        bd.onclick = function() { closeExplorer(explorer, bd) }
      } else {
        trigger(document.querySelector('.sidebar-toggle-left'))
      }
    })

    // ── Search: open search container directly as bottom sheet ─────────────
    var search = findBtn('search')
    if (search) search.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      haptic()
      var container = document.querySelector('.search-container')
      if (!container) return
      if (container.classList.contains('active')) return
      // Reparent to <body>: escapes both the display:none parent (.sidebar.left
      // hides all non-explorer children on mobile) and the .center stacking
      // context created by the SPA opacity/transform transition animation.
      if (container.parentElement !== document.body) {
        document.body.appendChild(container)
      }
      container.classList.add('active')
      document.documentElement.classList.add('mobile-no-scroll')
      var input = container.querySelector('.search-bar')
      if (input) setTimeout(function () { input.focus() }, 40)
    })

    // ── More: open settings sheet ──────────────────────────────────────────
    var more = findBtn('more')
    if (more) more.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      haptic()
      var fab = document.querySelector('.mobile-settings-fab')
      if (fab) { fab.click(); return }
      var sheet = document.querySelector('.mobile-settings-sheet')
      var backdrop = document.querySelector('.mobile-settings-backdrop')
      if (sheet && !sheet.classList.contains('open')) {
        sheet.classList.add('open')
        if (backdrop) backdrop.classList.add('open')
        document.body.style.overflow = 'hidden'
      }
    })

    // ── Today ──────────────────────────────────────────────────────────────
    var today = findBtn('today')
    if (today) today.addEventListener('click', function (e) {
      e.preventDefault()
      var slug = todaySlug()
      var currentSlug = (document.body.getAttribute('data-slug') || '')
      if (currentSlug === 'Daily/' + slug) return
      window.location.href = relUrlForDaily(currentSlug, slug)
    })

    // ── Prev/Next daily notes ──────────────────────────────────────────────
    var prevBtn = findBtn('prev')
    if (prevBtn) prevBtn.addEventListener('click', function (e) {
      e.preventDefault()
      haptic()
      var target = prevBtn.dataset.targetDate
      if (!target) return
      var currentSlug = (document.body.getAttribute('data-slug') || '')
      window.location.href = relUrlForDaily(currentSlug, target)
    })

    var nextBtn = findBtn('next')
    if (nextBtn) nextBtn.addEventListener('click', function (e) {
      e.preventDefault()
      haptic()
      var target = nextBtn.dataset.targetDate
      if (!target) return
      var currentSlug = (document.body.getAttribute('data-slug') || '')
      window.location.href = relUrlForDaily(currentSlug, target)
    })

    // ── Scroll shrink: labels fade, bar gets tighter ───────────────────────
    var lastY = window.scrollY
    var ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(function () {
        var y = window.scrollY
        var dy = y - lastY
        if (y > 60 && dy > 4) bar.classList.add('mtb-shrunk')
        else if (dy < -4) bar.classList.remove('mtb-shrunk')
        lastY = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    if (typeof window.addCleanup === 'function') {
      window.addCleanup(function () { window.removeEventListener('scroll', onScroll) })
    }

    refreshDailyState(bar)
  }

  init()
  document.addEventListener('nav', init)
})()
`

export default (() => MobileTabBar) satisfies QuartzComponentConstructor
