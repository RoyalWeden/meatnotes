import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { computeShortlinkId } from "../util/shortlink"
import { simplifySlug } from "../util/path"

const ShortlinkButton: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  const slug = simplifySlug(fileData.slug!)
  if (slug === "404") return null

  const manualId = fileData.frontmatter?.shortlink as string | undefined
  const id = computeShortlinkId(slug, manualId)
  const base = cfg.baseUrl ?? "example.com"
  const shortUrl = `https://${base}/s/${id}`

  return (
    <button
      id="shortlink-btn"
      aria-label="Copy short link"
      title="Copy short link to this page"
      data-shortlink={shortUrl}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
  )
}

ShortlinkButton.css = `
#shortlink-btn {
  position: fixed;
  bottom: 2rem;
  right: 5rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--secondary);
  color: var(--light);
  border: none;
  cursor: pointer;
  opacity: 1;
  pointer-events: all;
  transition: opacity 0.2s ease, background-color 0.15s ease, transform 0.15s ease;
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
#shortlink-btn:hover {
  opacity: 0.85;
  transform: scale(1.05);
}
#shortlink-btn:active {
  transform: scale(0.95);
}
#shortlink-btn.copied {
  background: var(--tertiary);
}
body.pdf-viewer-open #shortlink-btn {
  opacity: 0;
  pointer-events: none;
}
#shortlink-btn .shortlink-tooltip {
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--darkgray);
  color: var(--light);
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}
#shortlink-btn.copied .shortlink-tooltip {
  opacity: 1;
}
`

ShortlinkButton.afterDOMLoaded = `
(function() {
  function setup() {
    var btn = document.getElementById('shortlink-btn')
    if (!btn || btn.dataset.shortlinkSetup) return
    btn.dataset.shortlinkSetup = '1'

    // Add tooltip element
    var tip = document.createElement('span')
    tip.className = 'shortlink-tooltip'
    tip.textContent = 'Copied!'
    btn.appendChild(tip)

    btn.onclick = function() {
      var url = btn.dataset.shortlink
      if (!url) return

      function onCopied() {
        btn.classList.add('copied')
        setTimeout(function() { btn.classList.remove('copied') }, 1500)
      }

      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(onCopied).catch(function() {
          fallbackCopy(url)
          onCopied()
        })
      } else {
        fallbackCopy(url)
        onCopied()
      }
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch(e) {}
    document.body.removeChild(ta)
  }

  document.addEventListener('nav', setup)
  setup()
})()
`

export default (() => ShortlinkButton) satisfies QuartzComponentConstructor
