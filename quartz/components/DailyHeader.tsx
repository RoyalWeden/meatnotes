import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"

// Small Calendar.app-style header rendered just below the H1 on daily-note
// pages: a Today button + a 7-day Mon-Sun week strip with the current day
// filled in --accent. Days that have a note get a dot (mirrors DailyCalendar).
//
// Mount via quartz.layout.ts's beforeBody, between ArticleTitle and ContentMeta:
//
//   Component.ConditionalRender({
//     component: Component.DailyHeader(),
//     condition: (page) => /^Daily\/\d{4}-\d{2}-\d{2}$/.test(page.fileData.slug ?? ""),
//   }),

const DAILY_RE = /^Daily\/(\d{4})-(\d{2})-(\d{2})$/

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Sunday-anchored week containing `d` (Sun..Sat).
// JS getDay(): 0=Sun, 1=Mon, ... 6=Sat — Sunday is already 0 so the offset
// from Sunday is just `dayIdx`.
function startOfSundayWeek(d: Date): Date {
  const offsetFromSunday = d.getDay()
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  sunday.setDate(sunday.getDate() - offsetFromSunday)
  return sunday
}

const DailyHeader: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  const m = slug.match(DAILY_RE)
  if (!m) return null

  const [, yr, mo, dy] = m
  const pageDate = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(dy))

  // Build a set of all daily-note dates so we know which cells have notes.
  const dailyDates = new Set<string>()
  for (const f of allFiles) {
    const s = f.slug ?? ""
    const dm = s.match(DAILY_RE)
    if (dm) dailyDates.add(`${dm[1]}-${dm[2]}-${dm[3]}`)
  }

  // Sun-Sat week containing the page's date.
  const sunday = startOfSundayWeek(pageDate)
  const weekCells: { date: Date; ymd: string; label: string; weekday: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    weekCells.push({
      date: d,
      ymd: ymd(d),
      label: String(d.getDate()),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1).toUpperCase(),
    })
  }

  const pageYmd = ymd(pageDate)

  // The current slug in pathToRoot form so the inline Today script can resolve
  // /Daily/<today> correctly regardless of host base path.
  const currentSlug = (fileData.slug ?? "") as FullSlug

  return (
    <div class="daily-header" data-current-slug={currentSlug}>
      <div class="daily-week-strip" role="navigation" aria-label="This week">
        {weekCells.map((c) => {
          const isCurrent = c.ymd === pageYmd
          const hasNote = dailyDates.has(c.ymd)
          const cls = [
            "daily-week-cell",
            isCurrent ? "current" : "",
            hasNote ? "has-note" : "",
          ]
            .filter(Boolean)
            .join(" ")
          // Build a proper relative URL via Quartz's resolveRelative — using
          // a literal "../<ymd>" mis-resolves on URLs without a trailing slash
          // (e.g. /Daily/2024-08-18) because the browser treats the date as a
          // resource inside /Daily/, sending "../foo" to /foo (root) instead
          // of /Daily/foo. resolveRelative handles this correctly.
          const targetSlug = `Daily/${c.ymd}` as FullSlug
          const href = resolveRelative(currentSlug, targetSlug)
          return (
            <a class={cls} href={href} data-tooltip={c.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}>
              <span class="daily-week-weekday">{c.weekday}</span>
              <span class="daily-week-day">{c.label}</span>
            </a>
          )
        })}
      </div>
      <button
        class="daily-today-btn"
        id="daily-today-btn"
        data-tooltip="Jump to today's daily note"
        aria-label="Today"
      >
        Today
      </button>
    </div>
  )
}

DailyHeader.css = `
/* Sun-Sat week strip + Today action. Centered on desktop; full-width on
   mobile. Today sits below the strip, centered, as a small text-link chip
   matching Apple Calendar's toolbar "Today" affordance. */
.daily-header {
  margin: 0 0 1.5rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

/* Today — small accent text-link chip, sits centered just below the strip. */
.daily-today-btn {
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--accent);
  background: transparent;
  border: none;
  padding: 0.25rem 0.7rem;
  cursor: pointer;
  border-radius: 999px;
  transition: background-color 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}
.daily-today-btn:hover {
  background: var(--accent-soft);
}
.daily-today-btn.no-note {
  opacity: 0.45;
  color: var(--gray);
  cursor: default;
  background: transparent !important;
}

/* Week strip — 7 small cells, Sun..Sat. Centered on desktop with a sensible
   max-width; fills the column on mobile. Current day fills with accent;
   has-note cells show a small dot. Calendar.app vocabulary. */
.daily-week-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  width: 100%;
  max-width: 26rem;
  margin: 0 auto;
}

.daily-week-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 0 8px 0;
  text-decoration: none !important;
  color: var(--dark);
  background: transparent !important;
  border-radius: 12px;
  position: relative;
  transition: background-color 0.12s ease, color 0.12s ease;
  min-height: 44px;
}

.daily-week-cell:hover {
  background: color-mix(in srgb, var(--darkgray) 6%, transparent) !important;
}

.daily-week-weekday {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--gray);
  text-transform: uppercase;
  line-height: 1;
  margin-bottom: 4px;
}

.daily-week-day {
  font-size: 0.92rem;
  font-weight: 500;
  line-height: 1;
}

/* Has-note dot below the day number. */
.daily-week-cell.has-note::after {
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

/* Current day — filled accent disc treatment, contrast text. */
.daily-week-cell.current {
  background: var(--accent) !important;
}
.daily-week-cell.current:hover {
  background: var(--accent) !important;
  opacity: 0.92;
}
.daily-week-cell.current .daily-week-weekday,
.daily-week-cell.current .daily-week-day {
  color: var(--accent-contrast);
}
.daily-week-cell.current.has-note::after {
  background: var(--accent-contrast);
}
`

DailyHeader.afterDOMLoaded = `
(function() {
  function pad(n) { return String(n).padStart(2, '0') }
  function todaySlug() {
    var d = new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  // Build a relative URL from the current slug to /Daily/<targetYmd>.
  // Mirrors Quartz's resolveRelative server-side: count slashes in the
  // current slug, walk that many levels up with "../", then append the
  // target. This works whether the site is hosted at root or a subpath.
  function relUrlForDaily(currentSlug, targetYmd) {
    var depth = (currentSlug || '').split('/').length - 1
    var up = depth > 0 ? new Array(depth + 1).join('../') : './'
    return up + 'Daily/' + targetYmd
  }

  function setupTodayBtn() {
    var btn = document.getElementById('daily-today-btn')
    if (!btn) return
    var header = document.querySelector('.daily-header')
    var currentSlug = header && header.getAttribute('data-current-slug') || ''
    var slug = todaySlug()

    btn.addEventListener('click', function(e) {
      e.preventDefault()
      // If we're already on today's note, no-op.
      if (currentSlug === 'Daily/' + slug) {
        btn.classList.add('no-note')
        return
      }
      window.location.href = relUrlForDaily(currentSlug, slug)
    })

    // Lightly indicate whether today already has a note (gray it if not).
    fetch('/static/contentIndex.json')
      .then(function(r) { return r.json() })
      .then(function(data) {
        var exists = Object.prototype.hasOwnProperty.call(data, 'Daily/' + slug)
        if (!exists) {
          btn.classList.add('no-note')
          btn.setAttribute('data-tooltip', "Today's note doesn't exist yet")
        }
      })
      .catch(function() { /* leave as-is */ })
  }

  setupTodayBtn()
  document.addEventListener('nav', setupTodayBtn)
})()
`

export default (() => DailyHeader) satisfies QuartzComponentConstructor
