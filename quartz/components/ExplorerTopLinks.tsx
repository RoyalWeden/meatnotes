import { QuartzComponent, QuartzComponentConstructor } from "./types"

const ExplorerTopLinks: QuartzComponent = () => (
  <div class="explorer-top-links">
    <a href="/All-Notes" class="explorer-top-link">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
      All Notes
    </a>
  </div>
)

ExplorerTopLinks.css = `
.explorer-top-links {
  margin-bottom: 0.5rem;
}

/* Hide from mobile top bar — JS injects it into the Explorer drawer instead */
@media (max-width: 800px) {
  .explorer-top-links { display: none !important; }
}

.explorer-top-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--secondary);
  text-decoration: none !important;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--secondary) 30%, transparent);
  background: color-mix(in srgb, var(--secondary) 10%, transparent);
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--secondary);
  }
}

@media (hover: hover) {
  .explorer-top-link:hover {
    background: color-mix(in srgb, var(--secondary) 18%, transparent);
    border-color: color-mix(in srgb, var(--secondary) 50%, transparent);
    color: var(--secondary);
  }
}

/* Mobile drawer version */
.explorer-top-links-mobile {
  padding: 0.5rem 0 0.5rem;
  margin-right: 16px;
  border-bottom: 1px solid var(--lightgray);
  margin-bottom: 0.35rem;
}

.explorer-top-links-mobile .explorer-top-link {
  font-size: 0.9rem;
  box-sizing: border-box;
  width: 100%;
  justify-content: center;
  display: flex;
}
`

ExplorerTopLinks.afterDOMLoaded = `
(function() {
  var MOBILE_BREAKPOINT = 800

  function injectMobileLink() {
    if (window.innerWidth > MOBILE_BREAKPOINT) return
    if (document.querySelector('.explorer-top-links-mobile')) return
    var content = document.querySelector('.explorer-content')
    if (!content) return

    var div = document.createElement('div')
    div.className = 'explorer-top-links-mobile'
    div.innerHTML = '<a href="/All-Notes" class="explorer-top-link">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>' +
        '<rect x="9" y="3" width="6" height="4" rx="1"/>' +
        '<line x1="9" y1="12" x2="15" y2="12"/>' +
        '<line x1="9" y1="16" x2="13" y2="16"/>' +
      '</svg>' +
      'All Notes' +
    '</a>'
    content.insertBefore(div, content.firstChild)
  }

  injectMobileLink()
  document.addEventListener('nav', injectMobileLink)
})()
`

export default (() => ExplorerTopLinks) satisfies QuartzComponentConstructor
