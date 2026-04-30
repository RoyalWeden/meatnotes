import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const DailyCalendar: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <>
      <div id="daily-calendar">
        <div id="cal-nav">
          <button id="cal-prev" class="pressable" data-tooltip="Previous month">←</button>
          <span id="cal-title"></span>
          <button id="cal-next" class="pressable" data-tooltip="Next month">→</button>
        </div>
        <div id="cal-grid"></div>
      </div>
      <button id="cal-mobile-btn" class="pressable" aria-label="Open daily notes calendar" data-tooltip="Daily notes calendar">
        <span id="cal-btn-icon">📅</span>
        <span id="cal-btn-label">Daily Notes</span>
      </button>
      <div id="cal-mobile-overlay">
        <div id="cal-mobile-inner">
          <div id="cal-nav-mobile">
            <button id="cal-prev-mobile" data-tooltip="Previous month">←</button>
            <span id="cal-title-mobile"></span>
            <button id="cal-next-mobile" data-tooltip="Next month">→</button>
          </div>
          <div id="cal-grid-mobile"></div>
          <button id="cal-mobile-close" data-tooltip="Close calendar">Close</button>
        </div>
      </div>
    </>
  )
}

DailyCalendar.css = `
/* Apple Calendar.app vocabulary:
   - day numbers stay neutral; days with notes get a small accent dot below
   - today is a hairline accent ring (no fill), like iOS Calendar
   - active day fills as an accent disc (the "selected today" pattern)
   - month-nav chevrons are quiet hairline buttons
   - month picker uses the same chip language as the rest of the site */
#daily-calendar { padding: 0.5rem 0; font-size: 0.85rem; }
#cal-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--dark);
}
#cal-nav button {
  background: transparent;
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  border-radius: 999px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--gray);
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
#cal-nav button:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
#cal-title {
  cursor: pointer;
  text-decoration: none;
  transition: color 0.12s ease;
}
#cal-title:hover { color: var(--accent); }
#cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}
.cal-header {
  font-weight: 600;
  font-size: 0.62rem;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 0 2px 0;
}
.cal-day {
  position: relative;
  padding: 0;
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--dark);
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.12s ease, color 0.12s ease;
}
/* Days with notes: neutral number color + small accent dot below.
   The link is the full-cell hit area but stays calm visually. */
.cal-day.has-note { cursor: pointer; }
.cal-day.has-note a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 26px;
  color: var(--dark);
  font-weight: 500;
  text-decoration: none;
  padding: 0;
  position: relative;
}
.cal-day.has-note a::after {
  content: "";
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.85;
}
.cal-day.has-note:hover { background: color-mix(in srgb, var(--darkgray) 6%, transparent); }
.cal-day.empty { color: var(--gray); opacity: 0.45; }
/* Today: hairline accent ring around the date — Calendar.app's "today" mark. */
.cal-day.today {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--accent);
}
/* Active (selected) day: filled accent disc. Overrides the today ring. */
.cal-day.active a,
.cal-day.active.today a {
  background: var(--accent);
  color: var(--accent-contrast) !important;
  border-radius: 999px;
  padding: 0;
  font-weight: 600;
}
.cal-day.active a::after,
.cal-day.active.today a::after {
  background: var(--accent-contrast);
  opacity: 0.9;
}
.cal-day.active.today { box-shadow: none; }

#cal-picker {
  background: color-mix(in srgb, var(--light) 92%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  border-radius: 12px;
  padding: 0.6rem;
  margin-top: 0.5rem;
}
.cal-picker-year {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.cal-picker-year button {
  background: transparent;
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  border-radius: 999px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--gray);
  transition: color 0.12s ease, background-color 0.12s ease;
}
.cal-picker-year button:hover { color: var(--accent); background: var(--accent-soft); }
.cal-picker-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.cal-picker-month {
  background: transparent;
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 12%, transparent);
  border-radius: 8px;
  padding: 0.3rem 0;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--darkgray);
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.cal-picker-month:hover { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
.cal-picker-month.active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: transparent;
}

/* Mobile calendar pill — iOS glass chip matching the other FABs.
   Sits to the left of MobileSettings/BackToTop/Shortlink in the FAB row,
   above the safe-area inset. */
#cal-mobile-btn {
  display: none;
  position: fixed;
  bottom: max(1.25rem, env(safe-area-inset-bottom, 0px));
  right: calc(max(1.25rem, env(safe-area-inset-right, 0px)) + 10.5rem);
  height: auto;
  width: auto;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  background: color-mix(in srgb, var(--light) 78%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  z-index: 999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  gap: 0.45rem;
  align-items: center;
  color: var(--accent);
  transition: background-color 0.15s ease, transform 0.12s ease;
}
#cal-mobile-btn:hover { background: color-mix(in srgb, var(--light) 95%, transparent); }
#cal-mobile-btn:active { transform: scale(0.96); }
#cal-btn-icon { font-size: 1rem; line-height: 1; }
#cal-btn-label { font-size: 0.82rem; letter-spacing: 0.01em; }

/* Mobile overlay — iOS sheet-modal vocabulary */
#cal-mobile-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
  align-items: center;
  justify-content: center;
}
#cal-mobile-overlay.open {
  display: flex;
}
#cal-mobile-inner {
  background: color-mix(in srgb, var(--light) 92%, transparent);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border-radius: 16px;
  padding: 1.5rem;
  width: 90vw;
  max-width: 360px;
  position: relative;
  box-shadow:
    0 24px 64px -16px rgba(0, 0, 0, 0.28),
    inset 0 0 0 0.5px color-mix(in srgb, var(--darkgray) 14%, transparent);
}
#cal-mobile-close {
  display: block;
  width: 100%;
  background: transparent;
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  border-radius: 999px;
  padding: 0.5rem;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  color: var(--accent);
  margin-top: 1rem;
  text-align: center;
  transition: background-color 0.12s ease;
}
#cal-mobile-close:hover { background: var(--accent-soft); }
#cal-nav-mobile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.85rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
#cal-nav-mobile button {
  background: transparent;
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--gray);
  transition: color 0.12s ease, background-color 0.12s ease, border-color 0.12s ease;
}
#cal-nav-mobile button:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
#cal-grid-mobile {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}
#cal-grid-mobile .cal-day {
  padding: 0;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Mobile inherits the Apple-Calendar dot pattern from the desktop styles
   above — has-note shows a dot below, today gets the accent ring, active
   day fills as an accent disc. We just need to keep day numbers neutral
   here (override the old "secondary + bold" link styling on mobile). */
#cal-grid-mobile .cal-day.has-note a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 36px;
  color: var(--dark);
  font-weight: 500;
  text-decoration: none;
  position: relative;
}
#cal-grid-mobile .cal-day.has-note a::after {
  content: "";
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.85;
}
@media (max-width: 768px) {
  #cal-mobile-btn {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  #cal-mobile-inner {
    width: 95vw;
    padding: 1.5rem 1rem;
  }

  #cal-grid-mobile .cal-day {
    padding: 8px 4px;
    font-size: 1rem;
  }

  #cal-grid-mobile .cal-header {
    font-size: 0.85rem;
    padding: 4px 2px;
  }

  #cal-nav-mobile {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  #cal-nav-mobile button {
    padding: 0.3rem 0.75rem;
    font-size: 1rem;
  }
}
`

DailyCalendar.afterDOMLoaded = `
// Compact search bar on scroll: shrinks when scrolling down, restores on scroll up
(function() {
  let lastY = window.scrollY
  let ticking = false
  function updateCompact() {
    const y = window.scrollY
    if (y < 10) {
      document.documentElement.classList.remove('search-compact')
    } else if (y > lastY) {
      document.documentElement.classList.add('search-compact')
    } else {
      document.documentElement.classList.remove('search-compact')
    }
    lastY = y
    ticking = false
  }
  window.addEventListener('scroll', function() {
    if (!ticking) { requestAnimationFrame(updateCompact); ticking = true }
  }, { passive: true })
  document.addEventListener('nav', function() {
    lastY = window.scrollY
    document.documentElement.classList.remove('search-compact')
  })
})()

;(function() {
  if (!window._calState) {
    window._calState = { date: new Date(), dates: null }
  }

  async function calLoadNotes() {
    if (window._calState.dates) return window._calState.dates
    try {
      const res = await fetch('/static/contentIndex.json')
      const data = await res.json()
      const dates = Object.keys(data)
        .filter(k => /^Daily\\/\\d{4}-\\d{2}-\\d{2}$/.test(k))
        .map(k => k.replace('Daily/', ''))
        .sort()
      window._calState.dates = dates
      return dates
    } catch(e) { return [] }
  }

  function calShowPicker(dates) {
    const existing = document.getElementById('cal-picker')
    if (existing) { existing.remove(); return }
    const calNav = document.getElementById('cal-nav')
    if (!calNav) return

    let pickerYear = window._calState.date.getFullYear()
    const picker = document.createElement('div')
    picker.id = 'cal-picker'

    const yearRow = document.createElement('div')
    yearRow.className = 'cal-picker-year'
    const prevBtn = document.createElement('button')
    prevBtn.textContent = '←'
    const yearSpan = document.createElement('span')
    yearSpan.textContent = String(pickerYear)
    const nextBtn = document.createElement('button')
    nextBtn.textContent = '→'
    prevBtn.onclick = function() { pickerYear--; yearSpan.textContent = String(pickerYear) }
    nextBtn.onclick = function() { pickerYear++; yearSpan.textContent = String(pickerYear) }
    yearRow.appendChild(prevBtn)
    yearRow.appendChild(yearSpan)
    yearRow.appendChild(nextBtn)
    picker.appendChild(yearRow)

    const monthGrid = document.createElement('div')
    monthGrid.className = 'cal-picker-months'
    ;['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach(function(m, i) {
      const btn = document.createElement('button')
      btn.textContent = m
      btn.className = 'cal-picker-month'
      if (i === window._calState.date.getMonth() && pickerYear === window._calState.date.getFullYear()) {
        btn.classList.add('active')
      }
      btn.onclick = function() {
        window._calState.date = new Date(pickerYear, i, 1)
        picker.remove()
        calRender(dates)
      }
      monthGrid.appendChild(btn)
    })
    picker.appendChild(monthGrid)
    calNav.insertAdjacentElement('afterend', picker)
  }

  function calRender(dates) {
    const year = window._calState.date.getFullYear()
    const month = window._calState.date.getMonth()
    const currentPath = window.location.pathname

    const titleEl = document.getElementById('cal-title')
    if (titleEl) {
      titleEl.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
      titleEl.onclick = function() { calShowPicker(dates) }
    }

    const grid = document.getElementById('cal-grid')
    if (!grid) return
    grid.innerHTML = ''

    ;['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d) {
      const el = document.createElement('div')
      el.className = 'cal-header'
      el.textContent = d
      grid.appendChild(el)
    })

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div')
      el.className = 'cal-day empty'
      grid.appendChild(el)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      const dateStr = year + '-' + mm + '-' + dd
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
      const isActive = currentPath.endsWith('/Daily/' + dateStr)

      const el = document.createElement('div')
      el.className = 'cal-day' + (isToday ? ' today' : '') + (isActive ? ' active' : '')
      // Format tooltip date
      var tipDate = new Date(year, month, d)
      var tipStr = tipDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      if (dates.includes(dateStr)) {
        el.classList.add('has-note')
        el.innerHTML = '<a href="/Daily/' + dateStr + '">' + d + '</a>'
        el.setAttribute('data-tooltip', tipStr + '\\nHas daily note')
        el.onclick = function() {
          window.location.href = '/Daily/' + dateStr
        }
      } else {
        el.textContent = String(d)
        el.setAttribute('data-tooltip', tipStr)
      }
      grid.appendChild(el)
    }
  }

  function calInit() {
    const pageMatch = window.location.pathname.match(/\\/Daily\\/(\\d{4})-(\\d{2})-\\d{2}/)
    if (pageMatch) {
      window._calState.date = new Date(parseInt(pageMatch[1]), parseInt(pageMatch[2]) - 1, 1)
    }
    calLoadNotes().then(function(dates) { calRender(dates) })
  }

  const prevBtn = document.getElementById('cal-prev')
  const nextBtn = document.getElementById('cal-next')
  if (prevBtn) {
    prevBtn.onclick = function() {
      window._calState.date = new Date(window._calState.date.getFullYear(), window._calState.date.getMonth() - 1, 1)
      calRender(window._calState.dates || [])
    }
  }
  if (nextBtn) {
    nextBtn.onclick = function() {
      window._calState.date = new Date(window._calState.date.getFullYear(), window._calState.date.getMonth() + 1, 1)
      calRender(window._calState.dates || [])
    }
  }

  calInit()
  document.addEventListener('nav', calInit)

  // Mobile overlay logic
  function calRenderMobile(dates) {
    const year = window._calState.date.getFullYear()
    const month = window._calState.date.getMonth()
    const currentPath = window.location.pathname

    const titleEl = document.getElementById('cal-title-mobile')
    if (titleEl) titleEl.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

    const grid = document.getElementById('cal-grid-mobile')
    if (!grid) return
    grid.innerHTML = ''

    ;['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d) {
      const el = document.createElement('div')
      el.className = 'cal-header'
      el.textContent = d
      grid.appendChild(el)
    })

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div')
      el.className = 'cal-day empty'
      grid.appendChild(el)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      const dateStr = year + '-' + mm + '-' + dd
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
      const isActive = currentPath.endsWith('/Daily/' + dateStr)
      const el = document.createElement('div')
      el.className = 'cal-day' + (isToday ? ' today' : '') + (isActive ? ' active' : '')
      if (dates.includes(dateStr)) {
        el.classList.add('has-note')
        el.innerHTML = '<a href="/Daily/' + dateStr + '">' + d + '</a>'
        el.onclick = function() {
          window.location.href = '/Daily/' + dateStr
          if (overlay) overlay.classList.remove('open')
        }
      } else {
        el.textContent = String(d)
      }
      grid.appendChild(el)
    }
  }

  function setupMobile() {
    const btn = document.getElementById('cal-mobile-btn')
    const overlay = document.getElementById('cal-mobile-overlay')
    const closeBtn = document.getElementById('cal-mobile-close')
    const prevBtn = document.getElementById('cal-prev-mobile')
    const nextBtn = document.getElementById('cal-next-mobile')

    if (btn) btn.onclick = function() {
      if (overlay) overlay.classList.add('open')
      calRenderMobile(window._calState.dates || [])
    }
    if (closeBtn) closeBtn.onclick = function() {
      if (overlay) overlay.classList.remove('open')
    }
    if (overlay) overlay.onclick = function(e) {
      if (e.target === overlay) overlay.classList.remove('open')
    }
    if (prevBtn) prevBtn.onclick = function() {
      window._calState.date = new Date(window._calState.date.getFullYear(), window._calState.date.getMonth() - 1, 1)
      calRenderMobile(window._calState.dates || [])
    }
    if (nextBtn) nextBtn.onclick = function() {
      window._calState.date = new Date(window._calState.date.getFullYear(), window._calState.date.getMonth() + 1, 1)
      calRenderMobile(window._calState.dates || [])
    }
  }

  setupMobile()
  document.addEventListener('nav', setupMobile)

  function injectIntoDrawer() {
    if (window.innerWidth > 768) return
    const explorerContent = document.getElementById('explorer-98')
      || document.querySelector('.explorer-content')
    if (!explorerContent) return

    const existing = document.getElementById('mobile-drawer-header')
    if (existing) existing.remove()

    const header = document.createElement('div')
    header.id = 'mobile-drawer-header'

    const titleEl = document.createElement('a')
    titleEl.href = '/'
    titleEl.className = 'mobile-drawer-title'
    titleEl.textContent = 'Bible Notes'
    header.appendChild(titleEl)

    explorerContent.insertBefore(header, explorerContent.firstChild)
  }

  function setupHamburgerInjection() {
    const mobileBtn = document.querySelector('.explorer-toggle.mobile-explorer')
    if (!mobileBtn) return
    mobileBtn.addEventListener('click', function() {
      setTimeout(injectIntoDrawer, 50)
    })
  }

  setupHamburgerInjection()
  document.addEventListener('nav', setupHamburgerInjection)
})()
`

export default (() => DailyCalendar) satisfies QuartzComponentConstructor