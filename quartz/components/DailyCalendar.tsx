import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const DailyCalendar: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <>
      <div id="daily-calendar">
        <div id="cal-nav">
          <button id="cal-prev">←</button>
          <span id="cal-title"></span>
          <button id="cal-next">→</button>
        </div>
        <div id="cal-grid"></div>
      </div>
      <button id="cal-mobile-btn" aria-label="Open calendar">📅</button>
      <div id="cal-mobile-overlay">
        <div id="cal-mobile-inner">
          <div id="cal-nav-mobile">
            <button id="cal-prev-mobile">←</button>
            <span id="cal-title-mobile"></span>
            <button id="cal-next-mobile">→</button>
          </div>
          <div id="cal-grid-mobile"></div>
          <button id="cal-mobile-close">Close</button>
        </div>
      </div>
    </>
  )
}

DailyCalendar.css = `
#daily-calendar { padding: 0.5rem; font-size: 0.85rem; }
#cal-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-weight: bold; }
#cal-nav button { background: none; border: 1px solid var(--gray); border-radius: 4px; padding: 0.1rem 0.5rem; cursor: pointer; color: var(--dark); }
#cal-nav button:hover { background: var(--highlight); }
#cal-title { cursor: pointer; text-decoration: underline dotted; }
#cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.cal-header { font-weight: bold; font-size: 0.7rem; color: var(--gray); padding: 2px; }
.cal-day {
  padding: 0;
  border-radius: 3px;
  font-size: 0.8rem;
  color: var(--dark);
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cal-day.has-note {
  cursor: pointer;
}
.cal-day.has-note a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 20px;
  color: var(--secondary);
  font-weight: bold;
  text-decoration: none;
  padding: 3px 2px;
}
.cal-day.has-note:hover {
  background: var(--highlight);
}
.cal-day.empty { color: var(--lightgray); }
.cal-day.today { background: var(--highlight); border: 1px solid var(--secondary); }
.cal-day.active a { background: var(--secondary); color: var(--light) !important; border-radius: 3px; padding: 1px 3px; }
#cal-picker { background: var(--light); border: 1px solid var(--lightgray); border-radius: 6px; padding: 0.5rem; margin-top: 0.5rem; }
.cal-picker-year { display: flex; justify-content: space-between; align-items: center; font-weight: bold; margin-bottom: 0.5rem; }
.cal-picker-year button { background: none; border: 1px solid var(--gray); border-radius: 4px; padding: 0.1rem 0.4rem; cursor: pointer; color: var(--dark); }
.cal-picker-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.cal-picker-month { background: none; border: 1px solid var(--lightgray); border-radius: 4px; padding: 0.2rem; cursor: pointer; font-size: 0.8rem; color: var(--dark); }
.cal-picker-month:hover { background: var(--highlight); }
.cal-picker-month.active { background: var(--secondary); color: var(--light); border-color: var(--secondary); }

/* Mobile calendar button */
#cal-mobile-btn {
  display: none;
  position: fixed;
  bottom: 5rem;
  right: 1.5rem;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: none;
  background: var(--secondary);
  font-size: 1.4rem;
  cursor: pointer;
  z-index: 999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* Mobile overlay */
#cal-mobile-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9999;
  align-items: center;
  justify-content: center;
}
#cal-mobile-overlay.open {
  display: flex;
}
#cal-mobile-inner {
  background: var(--light);
  border-radius: 12px;
  padding: 1.5rem;
  width: 90vw;
  max-width: 360px;
  position: relative;
}
#cal-mobile-close {
  display: block;
  width: 100%;
  background: none;
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  padding: 0.4rem;
  font-size: 1rem;
  cursor: pointer;
  color: var(--dark);
  margin-top: 1rem;
  text-align: center;
}
#cal-nav-mobile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-weight: bold;
}
#cal-nav-mobile button {
  background: none;
  border: 1px solid var(--gray);
  border-radius: 4px;
  padding: 0.1rem 0.5rem;
  cursor: pointer;
  color: var(--dark);
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
#cal-grid-mobile .cal-day.has-note a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 36px;
  color: var(--secondary);
  font-weight: bold;
  text-decoration: none;
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
(function() {
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
      if (dates.includes(dateStr)) {
        el.classList.add('has-note')
        el.innerHTML = '<a href="/Daily/' + dateStr + '">' + d + '</a>'
        el.onclick = function() {
          window.location.href = '/Daily/' + dateStr
        }
      } else {
        el.textContent = String(d)
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

    const darkmodeBtn = document.querySelector('.darkmode button')
    if (darkmodeBtn) {
      const dmClone = darkmodeBtn.cloneNode(true)
      dmClone.addEventListener('click', function() { darkmodeBtn.click() })
      const dmWrapper = document.createElement('div')
      dmWrapper.className = 'mobile-drawer-darkmode'
      dmWrapper.appendChild(dmClone)
      header.appendChild(dmWrapper)
    }

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