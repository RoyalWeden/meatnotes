import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const DailyNoteNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  if (!/^Daily\/\d{4}-\d{2}-\d{2}$/.test(slug)) return null

  return (
    <div id="daily-note-nav">
      <a id="daily-prev" href="#">← prev</a>
      <span id="daily-current"></span>
      <a id="daily-next" href="#">next →</a>
    </div>
  )
}

DailyNoteNav.css = `
#daily-note-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  margin-top: 2rem;
  border-top: 1px solid var(--lightgray);
  font-size: 0.9rem;
}
#daily-note-nav a {
  color: var(--secondary);
  text-decoration: none;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--lightgray);
  border-radius: 4px;
}
#daily-note-nav a:hover { background: var(--highlight); }
#daily-note-nav a.hidden { visibility: hidden; }
#daily-current { color: var(--gray); font-size: 0.8rem; }
`

DailyNoteNav.afterDOMLoaded = `
(function() {
  async function initDailyNav() {
    const nav = document.getElementById('daily-note-nav')
    if (!nav) return

    const match = window.location.pathname.match(/\\/Daily\\/(\\d{4}-\\d{2}-\\d{2})/)
    if (!match) return
    const dateStr = match[1]

    let dates = window._calState && window._calState.dates
    if (!dates) {
      try {
        const res = await fetch('/static/contentIndex.json')
        const data = await res.json()
        dates = Object.keys(data)
          .filter(function(k) { return /^Daily\\/\\d{4}-\\d{2}-\\d{2}$/.test(k) })
          .map(function(k) { return k.replace('Daily/', '') })
          .sort()
        if (window._calState) window._calState.dates = dates
      } catch(e) { return }
    }

    const idx = dates.indexOf(dateStr)
    const prevEl = document.getElementById('daily-prev')
    const nextEl = document.getElementById('daily-next')
    const currentEl = document.getElementById('daily-current')

    if (currentEl) currentEl.textContent = dateStr
    if (prevEl) {
      if (idx > 0) {
        prevEl.href = '/Daily/' + dates[idx - 1]
        prevEl.textContent = '← ' + dates[idx - 1]
        prevEl.classList.remove('hidden')
      } else {
        prevEl.classList.add('hidden')
      }
    }
    if (nextEl) {
      if (idx < dates.length - 1) {
        nextEl.href = '/Daily/' + dates[idx + 1]
        nextEl.textContent = dates[idx + 1] + ' →'
        nextEl.classList.remove('hidden')
      } else {
        nextEl.classList.add('hidden')
      }
    }
  }

  initDailyNav()
  document.addEventListener('nav', initDailyNav)
})()
`

export default (() => DailyNoteNav) satisfies QuartzComponentConstructor