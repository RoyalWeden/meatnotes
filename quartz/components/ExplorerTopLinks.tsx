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
    <a href="/Bible-Reader" class="explorer-top-link" data-tooltip="Read Bible chapters with study notes">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
      Bible Reader
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
/* Compact icon-row layout (Phase 17b): five small icon-only chips in a
   wrapping flex row instead of a vertical stack of button-sized pills.
   Frees ~140px of sidebar vertical space; tooltips show full label on hover. */
.explorer-top-links {
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0;
}

/* Hide from mobile top bar — JS injects it into the Explorer drawer instead */
@media (max-width: 800px) {
  .explorer-top-links { display: none !important; }
}

.explorer-top-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: 0; /* hide the text label; icon + tooltip carry the affordance */
  font-weight: 500;
  color: var(--accent);
  text-decoration: none !important;
  padding: 0;
  border-radius: 8px;
  border: 0.5px solid color-mix(in srgb, var(--accent) 22%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease, transform 100ms ease;

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--accent);
  }
}

@media (hover: hover) {
  .explorer-top-link:hover {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }
}

.explorer-top-link:active {
  transform: scale(0.94);
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
    '<a href="/Bible-Reader" class="explorer-top-link" data-tooltip="Read Bible chapters with study notes" style="margin-top:0.35rem">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>' +
        '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' +
      '</svg>' +
      'Bible Reader' +
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
