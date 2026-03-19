import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import style from "./styles/idiomFlashcard.scss"
import { resolveRelative, FullSlug } from "../util/path"

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val))
    return (val as unknown[]).filter((s): s is string => typeof s === "string")
  if (typeof val === "string" && val.trim())
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  return []
}

const IdiomFlashcard: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
  const meaning = ((fm.description as string | undefined) ?? "").trim()
  const relatedIdioms = toStringArray(fm.related_idioms)
  const relatedVerses = toStringArray(fm.related_verses)

  // Build slug map so related idiom names resolve to links
  const idiomSlugMap = new Map<string, string>()
  for (const f of allFiles) {
    if (f.filePath?.includes("01 — Idioms") && f.slug) {
      const t = (
        (f.frontmatter?.title as string | undefined) ??
        f.slug.split("/").pop() ??
        ""
      ).trim()
      if (t) idiomSlugMap.set(t.toLowerCase(), f.slug)
    }
  }

  const hasChips = relatedIdioms.length > 0 || relatedVerses.length > 0

  // Pre-compute hrefs for related idioms (used by both chips and auto-sections)
  const relatedIdiomsData = relatedIdioms.map((r) => {
    const rSlug = idiomSlugMap.get(r.toLowerCase())
    const href = rSlug ? resolveRelative(fileData.slug!, rSlug as FullSlug) : ""
    return { name: r, href }
  })

  if (!meaning && !hasChips) return null

  return (
    <div class="idiom-flashcard">
      {/* Hidden data bridge — read by afterDOMLoaded to inject auto sections */}
      <div
        class="idiom-auto-sections"
        style="display:none"
        data-related-idioms={relatedIdiomsData.map((d) => `${d.name}\x1e${d.href}`).join("\x1f")}
        data-related-verses={relatedVerses.join("\x1f")}
      />
      {meaning && (
        <div class="idiom-flashcard-meaning">
          <span class="idiom-flashcard-label">Meaning</span>
          <span class="idiom-flashcard-value">{meaning}</span>
        </div>
      )}
      {hasChips && (
        <div class="idiom-flashcard-chips">
          {relatedIdiomsData.map(({ name, href }) => {
            if (href) {
              return (
                <a href={href} class="internal idiom-chip idiom-chip-related idiom-chip-link">
                  {name}
                </a>
              )
            }
            return <span class="idiom-chip idiom-chip-related idiom-chip-disabled">{name}</span>
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
  var SEP = '\\x1f'
  var KV  = '\\x1e'

  function makeCard(title, bodyEl) {
    var card = document.createElement('div')
    card.className = 'idiom-section-card collapsed'

    var heading = document.createElement('div')
    heading.className = 'idiom-section-card-heading'
    heading.setAttribute('role', 'button')
    heading.setAttribute('tabindex', '0')
    heading.setAttribute('aria-expanded', 'false')
    heading.innerHTML =
      '<svg class="idiom-section-chevron" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
      '<span class="idiom-section-card-title">' + title + '</span>'

    card.appendChild(heading)
    card.appendChild(bodyEl)

    function toggle() {
      var collapsed = card.classList.contains('collapsed')
      card.classList.toggle('collapsed', !collapsed)
      heading.setAttribute('aria-expanded', collapsed ? 'true' : 'false')
    }
    heading.addEventListener('click', toggle)
    heading.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
    })
    return card
  }

  function initIdiomSections() {
    var article = document.querySelector('article.idiom')
    if (!article || article.dataset.sectionsWrapped) return
    article.dataset.sectionsWrapped = '1'

    var h2s = Array.from(article.querySelectorAll('h2'))

    h2s.forEach(function (h2) {
      var sectionTitle = h2.textContent.trim()
      var body = document.createElement('div')
      body.className = 'idiom-section-card-body'

      // Collect all siblings until the next h2
      var next = h2.nextSibling
      while (next && !(next.nodeType === 1 && next.tagName === 'H2')) {
        var node = next
        next = next.nextSibling
        body.appendChild(node)
      }

      var card = makeCard(sectionTitle, body)
      h2.parentNode.insertBefore(card, h2)
      h2.remove()
    })

    // ── Auto-inject Related Verses & Related Idioms from frontmatter data ──────
    var dataEl = document.querySelector('.idiom-auto-sections')
    if (!dataEl) return

    var idiomsRaw  = dataEl.dataset.relatedIdioms  || ''
    var versesRaw  = dataEl.dataset.relatedVerses   || ''
    var idiomItems = idiomsRaw ? idiomsRaw.split(SEP) : []
    var verseItems = versesRaw ? versesRaw.split(SEP) : []

    if (verseItems.length > 0) {
      var vBody = document.createElement('div')
      vBody.className = 'idiom-section-card-body'
      var vChips = document.createElement('div')
      vChips.className = 'idiom-flashcard-chips'
      verseItems.forEach(function (v) {
        var span = document.createElement('span')
        span.className = 'idiom-chip idiom-chip-verse'
        span.textContent = v
        vChips.appendChild(span)
      })
      vBody.appendChild(vChips)
      article.appendChild(makeCard('Related Verses', vBody))
    }

    if (idiomItems.length > 0) {
      var iBody = document.createElement('div')
      iBody.className = 'idiom-section-card-body'
      var iChips = document.createElement('div')
      iChips.className = 'idiom-flashcard-chips'
      idiomItems.forEach(function (item) {
        var parts = item.split(KV)
        var name = parts[0]
        var href = parts[1] || ''
        if (href) {
          var a = document.createElement('a')
          a.href = href
          a.className = 'internal idiom-chip idiom-chip-related idiom-chip-link'
          a.textContent = name
          iChips.appendChild(a)
        } else {
          var span = document.createElement('span')
          span.className = 'idiom-chip idiom-chip-related idiom-chip-disabled'
          span.textContent = name
          iChips.appendChild(span)
        }
      })
      iBody.appendChild(iChips)
      article.appendChild(makeCard('Related Idioms', iBody))
    }
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
