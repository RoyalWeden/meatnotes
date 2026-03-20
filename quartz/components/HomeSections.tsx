import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative, FullSlug } from "../util/path"
import style from "./styles/homeSections.scss"
import { classNames } from "../util/lang"

const sections = [
  {
    emoji: "📥",
    label: "Capture",
    folderPrefix: "00-—-Capture",
    description: "Raw topics and sources being gathered",
  },
  {
    emoji: "📖",
    label: "In Progress",
    folderPrefix: "10-—-In-Progress",
    description: "Studies currently being developed",
  },
  {
    emoji: "✅",
    label: "Complete",
    folderPrefix: "20-—-Complete",
    description: "Finished, teachable study notes",
  },
  {
    emoji: "✉️",
    label: "Copy-Paste Rebukes",
    folderPrefix: "Copy-Paste-Rebukes",
    description: "Ready-to-use scripture rebukes by topic",
  },
]

const HomeSections: QuartzComponent = ({ allFiles, fileData, displayClass }: QuartzComponentProps) => {
  let total = 0
  const counts = sections.map(({ folderPrefix }) => {
    const count = allFiles.filter((f) => f.slug?.startsWith(folderPrefix + "/")).length
    total += count
    return count
  })

  return (
    <div class={classNames(displayClass, "home-sections")}>
      <p class="site-description">
        Working study notes from{" "}
        <a href="https://straitisthegate.net" target="_blank" rel="noopener" class="site-ref-link">
          Straitisthegate.net
        </a>{" "}
        — organized by topic and study status.
      </p>
      <h2>Sections</h2>
      <table class="sections-table">
        <thead>
          <tr>
            <th></th>
            <th>Section</th>
            <th class="count-col">Notes</th>
            <th class="desc-col">What's in it</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(({ emoji, label, folderPrefix, description }, i) => (
            <tr>
              <td>{emoji}</td>
              <td>
                <a href={resolveRelative(fileData.slug!, folderPrefix as FullSlug)} class="internal">
                  {label}
                </a>
              </td>
              <td class="count-col">{counts[i]}</td>
              <td class="desc-col">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="sections-total">
        {total} notes total &nbsp;·&nbsp;{" "}
        <a href="/All-Notes" class="internal">Browse all notes →</a>
      </p>
      <p class="today-link-wrap">
        <a id="today-daily-link" href="#" class="internal">📅 Today's Daily Note</a>
        <span id="today-tooltip" class="today-tooltip">No daily note for today yet</span>
        <span id="today-popup" class="today-popup" aria-hidden="true">
          No daily note has been created for today yet.
          <button id="today-popup-dismiss" class="today-popup-dismiss">Dismiss</button>
        </span>
      </p>
    </div>
  )
}

HomeSections.css = style

HomeSections.afterDOMLoaded = `
(function() {
  var isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches

  function todaySlug() {
    var d = new Date()
    var pad = function(n) { return String(n).padStart(2, '0') }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  function updateTodayLink() {
    var el = document.getElementById('today-daily-link')
    if (!el) return
    var slug = todaySlug()
    el.href = '/Daily/' + slug

    // Check if today's note exists in contentIndex
    fetch('/static/contentIndex.json')
      .then(function(r) { return r.json() })
      .then(function(data) {
        var exists = Object.prototype.hasOwnProperty.call(data, 'Daily/' + slug)
        setupTodayButton(el, exists)
      })
      .catch(function() {
        // If fetch fails, assume note doesn't exist
        setupTodayButton(el, false)
      })
  }

  function setupTodayButton(el, exists) {
    var tooltip = document.getElementById('today-tooltip')
    var popup = document.getElementById('today-popup')
    var dismiss = document.getElementById('today-popup-dismiss')

    if (exists) {
      el.removeAttribute('aria-disabled')
      el.removeAttribute('data-today-check')
      el.classList.remove('today-no-note')
      if (tooltip) tooltip.style.display = 'none'
      if (popup) popup.classList.remove('today-popup-visible')
      return
    }

    if (!isTouch) {
      // Desktop: disable the link and show tooltip on hover
      el.setAttribute('aria-disabled', 'true')
      el.classList.add('today-no-note')
      if (tooltip) tooltip.style.display = 'block'
      el.addEventListener('click', function(e) { e.preventDefault() })
    } else {
      // Mobile: intercept click and show popup instead of navigating
      el.setAttribute('data-today-check', '1')
    }
  }

  function initClickInterception() {
    document.addEventListener('click', function(e) {
      var el = document.getElementById('today-daily-link')
      if (!el || !el.getAttribute('data-today-check')) return
      if (!e.composedPath().includes(el)) return

      // Only intercept if note doesn't exist (we set data-today-check only then)
      e.preventDefault()
      var popup = document.getElementById('today-popup')
      if (popup) {
        popup.classList.add('today-popup-visible')
        popup.setAttribute('aria-hidden', 'false')
      }
    })

    document.addEventListener('click', function(e) {
      var dismiss = document.getElementById('today-popup-dismiss')
      var popup = document.getElementById('today-popup')
      if (dismiss && e.composedPath().includes(dismiss)) {
        if (popup) {
          popup.classList.remove('today-popup-visible')
          popup.setAttribute('aria-hidden', 'true')
        }
      }
    })
  }

  initClickInterception()
  updateTodayLink()
  document.addEventListener('nav', updateTodayLink)
})()
`

export default (() => HomeSections) satisfies QuartzComponentConstructor
