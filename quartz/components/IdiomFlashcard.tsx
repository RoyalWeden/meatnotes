import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import style from "./styles/idiomFlashcard.scss"
import { resolveRelative, FullSlug } from "../util/path"

const IdiomFlashcard: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const fm = fileData.frontmatter ?? {}
  const meaning = ((fm.description as string | undefined) ?? "").trim()
  const relatedIdioms: string[] = Array.isArray(fm.related_idioms)
    ? (fm.related_idioms as string[])
    : []
  const relatedVerses: string[] = Array.isArray(fm.related_verses)
    ? (fm.related_verses as string[])
    : []

  // Build slug map so related idiom names resolve to links
  const idiomSlugMap = new Map<string, string>()
  for (const f of allFiles) {
    if (f.filePath?.includes("01 — Idioms") && f.slug) {
      const t = (
        (f.frontmatter?.title as string | undefined) ?? f.slug.split("/").pop() ?? ""
      ).trim()
      if (t) idiomSlugMap.set(t.toLowerCase(), f.slug)
    }
  }

  const hasChips = relatedIdioms.length > 0 || relatedVerses.length > 0

  if (!meaning && !hasChips) return null

  return (
    <div class="idiom-flashcard">
      {meaning && (
        <div class="idiom-flashcard-meaning">
          <span class="idiom-flashcard-label">Meaning</span>
          <span class="idiom-flashcard-value">{meaning}</span>
        </div>
      )}
      {hasChips && (
        <div class="idiom-flashcard-chips">
          {relatedIdioms.map((r) => {
            const rSlug = idiomSlugMap.get(r.toLowerCase())
            if (rSlug) {
              const href = resolveRelative(fileData.slug!, rSlug as FullSlug)
              return (
                <a href={href} class="internal idiom-chip idiom-chip-related idiom-chip-link">
                  {r}
                </a>
              )
            }
            return <span class="idiom-chip idiom-chip-related idiom-chip-disabled">{r}</span>
          })}
          {relatedVerses.map((v) => (
            <span class="idiom-chip idiom-chip-verse">{v}</span>
          ))}
        </div>
      )}
    </div>
  )
}

IdiomFlashcard.css = style as unknown as string

// Wrap each h2 section in a collapsible card on individual idiom pages
IdiomFlashcard.afterDOMLoaded = `
(function () {
  function initIdiomSections() {
    var article = document.querySelector('article.idiom')
    if (!article || article.dataset.sectionsWrapped) return
    article.dataset.sectionsWrapped = '1'

    var h2s = Array.from(article.querySelectorAll('h2'))
    if (h2s.length === 0) return

    h2s.forEach(function (h2) {
      var sectionTitle = h2.textContent.trim()

      var card = document.createElement('div')
      card.className = 'idiom-section-card collapsed'

      var heading = document.createElement('div')
      heading.className = 'idiom-section-card-heading'
      heading.setAttribute('role', 'button')
      heading.setAttribute('tabindex', '0')
      heading.setAttribute('aria-expanded', 'false')
      heading.innerHTML =
        '<svg class="idiom-section-chevron" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
        '<span class="idiom-section-card-title">' + sectionTitle + '</span>'

      var body = document.createElement('div')
      body.className = 'idiom-section-card-body'

      // Collect all siblings until the next h2
      var next = h2.nextSibling
      while (next && !(next.nodeType === 1 && next.tagName === 'H2')) {
        var node = next
        next = next.nextSibling
        body.appendChild(node)
      }

      h2.parentNode.insertBefore(card, h2)
      h2.remove()
      card.appendChild(heading)
      card.appendChild(body)

      function toggle() {
        var collapsed = card.classList.contains('collapsed')
        card.classList.toggle('collapsed', !collapsed)
        heading.setAttribute('aria-expanded', collapsed ? 'true' : 'false')
      }

      heading.addEventListener('click', toggle)
      heading.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
      })
    })
  }

  // ── Back button at bottom of article ──────────────────────────────────────
  function addBackButton() {
    var article = document.querySelector('article.idiom')
    if (!article || article.dataset.backAdded) return
    article.dataset.backAdded = '1'

    // Two levels up: /Complete/01-Idioms/Name → /Complete/Bible-Idioms
    var parts = window.location.pathname.split('/')
    while (parts[parts.length - 1] === '') parts.pop()  // trim trailing slash
    parts.pop()  // remove idiom name
    parts.pop()  // remove 01-...-Idioms folder
    var href = parts.join('/') + '/Bible-Idioms'

    var btn = document.createElement('a')
    btn.href = href
    btn.className = 'idiom-back-btn'
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>' +
      'Back to Bible Idioms'
    article.appendChild(btn)
  }

  // ── Hide mobile ToC on idiom pages ──────────────────────────────────────────
  function hideMobileToc() {
    if (!document.querySelector('article.idiom')) return
    var mobileToc = document.querySelector('.toc.mobile-only')
    if (mobileToc) mobileToc.style.display = 'none'
  }

  function init() {
    initIdiomSections()
    addBackButton()
    hideMobileToc()
  }

  init()
  document.addEventListener('nav', init)
})()
`

export default (() => IdiomFlashcard) satisfies QuartzComponentConstructor
