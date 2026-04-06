import { QuartzComponent, QuartzComponentConstructor } from "./types"

const ExplorerTopLinks: QuartzComponent = () => (
  <div class="explorer-top-links">
    <a href="/All-Notes" class="explorer-top-link" data-tooltip="Browse all study notes">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
      All Notes
    </a>
    <a href="/Books-and-PDFs" class="explorer-top-link" data-tooltip="Browse books and PDFs">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      Books & PDFs
    </a>
    <a href="/Verse-Chain" class="explorer-top-link" data-tooltip="Explore verse chains and connections">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      Verse Chain
    </a>
    <a href="/Dashboard" class="explorer-top-link" data-tooltip="View study dashboard">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="1"/>
        <rect x="14" y="3" width="7" height="5" rx="1"/>
        <rect x="14" y="12" width="7" height="9" rx="1"/>
        <rect x="3" y="16" width="7" height="5" rx="1"/>
      </svg>
      Dashboard
    </a>
  </div>
)

ExplorerTopLinks.css = `
.explorer-top-links {
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
    div.innerHTML = '<a href="/All-Notes" class="explorer-top-link" data-tooltip="Browse all study notes">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>' +
        '<rect x="9" y="3" width="6" height="4" rx="1"/>' +
        '<line x1="9" y1="12" x2="15" y2="12"/>' +
        '<line x1="9" y1="16" x2="13" y2="16"/>' +
      '</svg>' +
      'All Notes' +
    '</a>' +
    '<a href="/Books-and-PDFs" class="explorer-top-link" data-tooltip="Browse books and PDFs" style="margin-top:0.35rem">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
        '<polyline points="14 2 14 8 20 8"/>' +
        '<line x1="16" y1="13" x2="8" y2="13"/>' +
        '<line x1="16" y1="17" x2="8" y2="17"/>' +
      '</svg>' +
      'Books \\x26 PDFs' +
    '</a>' +
    '<a href="/Verse-Chain" class="explorer-top-link" data-tooltip="Explore verse chains and connections" style="margin-top:0.35rem">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
        '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' +
      '</svg>' +
      'Verse Chain' +
    '</a>' +
    '<a href="/Dashboard" class="explorer-top-link" data-tooltip="View study dashboard" style="margin-top:0.35rem">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="7" height="9" rx="1"/>' +
        '<rect x="14" y="3" width="7" height="5" rx="1"/>' +
        '<rect x="14" y="12" width="7" height="9" rx="1"/>' +
        '<rect x="3" y="16" width="7" height="5" rx="1"/>' +
      '</svg>' +
      'Dashboard' +
    '</a>'
    content.insertBefore(div, content.firstChild)
  }

  injectMobileLink()
  document.addEventListener('nav', injectMobileLink)
})()
`

export default (() => ExplorerTopLinks) satisfies QuartzComponentConstructor
