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
          <a href={link as string} target="_blank" rel="noopener">{text}</a>
        ))}
      </div>
      <div class="footer-build">
        <span id="build-time-display" data-tooltip="">checking...</span>
      </div>
    </footer>
  )
}

CustomFooter.css = `
footer {
  padding: 1.5rem 0 1rem 0;
  margin-top: 2rem;
  border-top: 1px solid var(--lightgray);
  font-size: 0.85rem;
  color: var(--gray);
}
.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
}
.footer-links a {
  color: var(--secondary);
  text-decoration: none;
}
.footer-links a:hover {
  text-decoration: underline;
}
.footer-build {
  font-size: 0.8rem;
  color: var(--gray);
}
#build-time-display {
  cursor: help;
  border-bottom: 1px dotted var(--gray);
  position: relative;
}
#build-time-display::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--light);
  color: var(--dark);
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  font-family: inherit;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 100;
}
#build-time-display:hover::after {
  opacity: 1;
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

  async function loadBuildTime() {
    if (window._buildTime) { updateBuildTime(); return }
    try {
      const res = await fetch('/buildTime.json')
      const data = await res.json()
      window._buildTime = data.builtAt
      updateBuildTime()
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