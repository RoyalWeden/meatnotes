import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface FooterOptions {
  links: Record<string, string>
}

const CustomFooter: QuartzComponent = (_props: QuartzComponentProps) => {
  const links = (CustomFooter as any)._links ?? {}
  return (
    <footer>
      <div class="footer-links">
        {Object.entries(links).map(([text, link]) => (
          <a href={link as string} target="_blank" rel="noopener" data-tooltip={`Opens ${text}`}>{text}</a>
        ))}
      </div>
      <div class="footer-build">
        <span id="build-time-display" data-tooltip="">checking...</span>
        <span class="footer-version-sep">·</span>
        <span id="site-version-display" class="footer-version"></span>
      </div>
    </footer>
  )
}

CustomFooter.css = `
footer {
  /* No border-top here — renderPage emits a structural <hr> between content
     and .page-footer (styled as the 0.5px hairline in base.scss); a footer
     border-top on top of that produced two visible rails on note pages. */
  padding: 1.25rem 0 2rem 0;
  margin-top: 1rem;
  font-size: 0.78rem;
  color: var(--gray);
}
.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  margin-bottom: 0.5rem;
}
.footer-links a {
  color: var(--gray);
  font-weight: inherit;
  text-decoration: none;
  transition: color 0.15s ease;
}
.footer-links a:hover {
  color: var(--darkgray);
}
.footer-build {
  font-size: 0.72rem;
  color: var(--gray);
  display: flex;
  align-items: center;
  gap: 0;
  opacity: 0.75;
}
.footer-version-sep {
  margin: 0 0.4rem;
  opacity: 0.4;
}
.footer-version {
  font-size: 0.72rem;
  color: var(--gray);
  opacity: 0.7;
}
#build-time-display {
  cursor: help;
  position: relative;
}
/* Hide footer only on full-page webapp surfaces — content pages (incl. home) show it. */
body[data-slug="Bible-Reader"] footer,
body[data-slug="Verse-Chain"] footer,
body[data-slug="Dashboard"] footer,
body[data-slug="Search"] footer,
body[data-slug="Graph"] footer {
  display: none;
}
`

CustomFooter.afterDOMLoaded = `
(function() {
  function relativeTime(date) {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffWeeks = Math.floor(diffDays / 7)
    const diffMonths = Math.floor(diffDays / 30)
    const diffYears = Math.floor(diffDays / 365)
    if (diffMins < 1) return "just now"
    if (diffMins < 60) return diffMins + "m ago"
    if (diffHours < 24) return diffHours + "h ago"
    if (diffDays < 7) return diffDays + "d ago"
    if (diffWeeks < 5) return diffWeeks + "w ago"
    if (diffMonths < 12) return diffMonths + "mo ago"
    return diffYears + "y ago"
  }

  function exactTime(date) {
    return date.toLocaleString("en-AU", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  }

  function updateBuildTime() {
    const el = document.getElementById('build-time-display')
    if (!el || !window._buildTime) return
    const date = new Date(window._buildTime)
    el.textContent = "last updated " + relativeTime(date)
    el.setAttribute("data-tooltip", exactTime(date))
  }

  function updateSiteVersion() {
    const el = document.getElementById('site-version-display')
    if (!el || !window._siteVersion) return
    el.textContent = "v" + window._siteVersion
  }

  async function loadBuildTime() {
    if (window._buildTime) { updateBuildTime(); updateSiteVersion(); return }
    try {
      const res = await fetch('/buildTime.json')
      const data = await res.json()
      window._buildTime = data.builtAt
      window._siteVersion = data.version || ""
      updateBuildTime()
      updateSiteVersion()
      setInterval(updateBuildTime, 60000)
    } catch(e) {
      const el = document.getElementById('build-time-display')
      if (el) el.textContent = ""
    }
  }

  loadBuildTime()
  document.addEventListener('nav', updateBuildTime)
})()
`

export default ((opts?: FooterOptions) => {
  if (opts?.links) (CustomFooter as any)._links = opts.links
  return CustomFooter
}) satisfies QuartzComponentConstructor