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
      class="pressable"
      aria-label="Copy short link"
      data-tooltip="Copy short link"
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
/* iOS-style glass FAB matching BackToTop + MobileSettings vocabulary.
   Stacks left of BackToTop so the three FABs sit in a clean horizontal row
   on mobile (right→left: MobileSettings · BackToTop · Shortlink). */
#shortlink-btn {
  position: fixed;
  bottom: max(1.25rem, env(safe-area-inset-bottom, 0px));
  right: max(1.25rem, env(safe-area-inset-right, 0px));
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--light) 78%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: var(--accent);
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  cursor: pointer;
  opacity: 1;
  pointer-events: all;
  transition: opacity 0.2s ease, background-color 0.15s ease, transform 0.15s ease;
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
}
/* Desktop: shortlink sits left of MobileSettings FAB (which doesn't render on
   desktop); stick to bottom-right with a small offset. */
@media (min-width: 801px) {
  #shortlink-btn { right: 3.75rem; }
}
/* Mobile: stack three FABs from right edge (MobileSettings → BackToTop → Shortlink). */
@media (max-width: 800px) {
  #shortlink-btn {
    right: calc(max(1.25rem, env(safe-area-inset-right, 0px)) + 7rem);
  }
}
#shortlink-btn:hover {
  background: color-mix(in srgb, var(--light) 95%, transparent);
}
#shortlink-btn:active {
  transform: scale(0.94);
}
#shortlink-btn.copied {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: transparent;
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
  background: color-mix(in srgb, var(--darkgray) 92%, transparent);
  color: var(--light);
  font-size: 0.7rem;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
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
