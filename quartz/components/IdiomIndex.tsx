import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import listPageStyle from "./styles/listPage.scss"
// @ts-ignore
import idiomStyle from "./styles/idiomIndex.scss"
import { resolveRelative, FullSlug } from "../util/path"

// ── Icons ─────────────────────────────────────────────────────────────────────

// Quote icon (Lucide) — perfect visual for idioms/phrases
const QuoteIcon = () => (
  <svg
    class="card-icon idiom-quote-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────

const IdiomIndex: QuartzComponent = ({ allFiles, fileData }: QuartzComponentProps) => {
  // Build slug map so flip-card backs + accordion can link to related idioms
  const idiomSlugMap = new Map<string, string>()
  for (const f of allFiles) {
    if (f.filePath?.includes("01 — Idioms") && f.slug) {
      const t = (
        (f.frontmatter?.title as string | undefined) ?? f.slug.split("/").pop() ?? ""
      ).trim()
      if (t) idiomSlugMap.set(t.toLowerCase(), f.slug)
    }
  }

  const idiomFiles = allFiles
    .filter((f) => f.filePath?.includes("01 — Idioms"))
    .map((f) => {
      const rawTitle =
        (f.frontmatter?.title as string | undefined) ?? f.slug?.split("/").pop() ?? ""
      const title = decodeURIComponent(rawTitle).trim()
      const meaning = ((f.frontmatter?.description as string | undefined) ?? "").trim()
      const relatedIdioms: string[] = Array.isArray(f.frontmatter?.related_idioms)
        ? (f.frontmatter!.related_idioms as string[])
        : []
      const relatedVerses: string[] = Array.isArray(f.frontmatter?.related_verses)
        ? (f.frontmatter!.related_verses as string[])
        : []
      return { title, meaning, slug: f.slug!, relatedIdioms, relatedVerses }
    })
    .filter((f) => f.title.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title))

  const byLetter = new Map<string, typeof idiomFiles>()
  for (const idiom of idiomFiles) {
    const letter = idiom.title[0].toUpperCase()
    if (!byLetter.has(letter)) byLetter.set(letter, [])
    byLetter.get(letter)!.push(idiom)
  }

  const activeLetters = Array.from(byLetter.keys()).sort()
  const totalIdioms = idiomFiles.length

  return (
    <div id="idiom-index">
      {/* A-Z navigation — compact wrap, active letters only */}
      <nav class="idiom-alpha-nav" aria-label="Jump to letter">
        {activeLetters.map((letter) => (
          <a href={`#idiom-section-${letter}`} class="idiom-alpha-btn">
            {letter}
          </a>
        ))}
      </nav>

      {/* Count + view toggle row */}
      <div class="idiom-section-controls">
        <p class="idiom-total-count folder-item-count">
          {totalIdioms} idiom{totalIdioms === 1 ? "" : "s"}
        </p>
        <div class="view-toggle">
          {/* Compact grid (3×3 dots) */}
          <button class="view-btn" data-view-target="cards-sm" title="Compact grid">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
            >
              <rect x="1" y="1" width="3" height="3" rx=".6" />
              <rect x="5.5" y="1" width="3" height="3" rx=".6" />
              <rect x="10" y="1" width="3" height="3" rx=".6" />
              <rect x="1" y="5.5" width="3" height="3" rx=".6" />
              <rect x="5.5" y="5.5" width="3" height="3" rx=".6" />
              <rect x="10" y="5.5" width="3" height="3" rx=".6" />
              <rect x="1" y="10" width="3" height="3" rx=".6" />
              <rect x="5.5" y="10" width="3" height="3" rx=".6" />
              <rect x="10" y="10" width="3" height="3" rx=".6" />
            </svg>
          </button>
          {/* Spacious grid (2×2 dots) */}
          <button class="view-btn" data-view-target="cards-lg" title="Spacious grid">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
            >
              <rect x="1" y="1" width="5" height="5" rx=".8" />
              <rect x="8" y="1" width="5" height="5" rx=".8" />
              <rect x="1" y="8" width="5" height="5" rx=".8" />
              <rect x="8" y="8" width="5" height="5" rx=".8" />
            </svg>
          </button>
          {/* List / accordion */}
          <button class="view-btn" data-view-target="list" title="List view">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="3" y="4" width="18" height="2.5" rx="1.25" />
              <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" />
              <rect x="3" y="17.5" width="18" height="2.5" rx="1.25" />
            </svg>
          </button>
        </div>
      </div>

      {/* Letter sections */}
      {Array.from(byLetter.entries()).map(([letter, idioms]) => (
        <div
          class="idiom-letter-section notes-section-group collapsed"
          id={`idiom-section-${letter}`}
        >
          {/* Section heading — entire row is the collapse toggle */}
          <div
            class="notes-section-heading idiom-letter-heading"
            role="button"
            tabindex="0"
            aria-expanded="false"
          >
            <svg
              class="idiom-chevron"
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span class="idiom-letter-label">{letter}</span>
            <span class="notes-section-count">{idioms.length}</span>
          </div>

          {/* Collapsed preview chips */}
          <div class="idiom-letter-preview">
            {idioms.slice(0, 3).map((idiom) => (
              <span class="idiom-preview-chip">{idiom.title}</span>
            ))}
            {idioms.length > 3 && (
              <span class="idiom-preview-chip">+{idioms.length - 3} more</span>
            )}
          </div>

          {/* Cards + accordion list */}
          <div class="page-listing">
            {/* Cards view — flip cards (compact + spacious share this) */}
            <div class="view-cards">
              <div class="cards-grid">
                {idioms.map((idiom) => {
                  const href = resolveRelative(fileData.slug!, idiom.slug as FullSlug)
                  return (
                    <div class="card-item idiom-flip-card" data-href={href}>
                      <div class="flip-inner">
                        {/* Front face: quote icon + title */}
                        <div class="flip-front">
                          <div class="flip-front-icon">
                            <QuoteIcon />
                          </div>
                          <div class="flip-title">{idiom.title}</div>
                        </div>

                        {/* Back face: small name + meaning + chips */}
                        <div class="flip-back">
                          <div class="flip-back-name">{idiom.title}</div>
                          <div class="flip-back-scroll">
                            {idiom.meaning ? (
                              <div class="flip-back-meaning">{idiom.meaning}</div>
                            ) : (
                              <div class="flip-back-empty">— no meaning yet —</div>
                            )}
                            {(idiom.relatedIdioms.length > 0 ||
                              idiom.relatedVerses.length > 0) && (
                              <div class="flip-back-chips">
                                {idiom.relatedIdioms.map((name) => {
                                  const rSlug = idiomSlugMap.get(name.toLowerCase())
                                  if (rSlug) {
                                    const rHref = resolveRelative(
                                      fileData.slug!,
                                      rSlug as FullSlug,
                                    )
                                    return (
                                      <a
                                        href={rHref}
                                        class="internal idiom-chip idiom-chip-related idiom-chip-link"
                                      >
                                        {name}
                                      </a>
                                    )
                                  }
                                  return (
                                    <span class="idiom-chip idiom-chip-disabled">{name}</span>
                                  )
                                })}
                                {idiom.relatedVerses.map((v) => (
                                  <span class="idiom-chip idiom-chip-verse">{v}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Accordion list view — hover expands, click navigates */}
            <div class="view-list">
              <ul class="idiom-accordion">
                {idioms.map((idiom) => {
                  const href = resolveRelative(fileData.slug!, idiom.slug as FullSlug)
                  return (
                    <li class="idiom-accordion-item">
                      {/* Header: click navigates; hover expands body via CSS */}
                      <a
                        href={href}
                        class="idiom-accordion-header"
                        data-no-popover
                      >
                        <span class="idiom-acc-icon">
                          <QuoteIcon />
                        </span>
                        <span class="idiom-acc-title">{idiom.title}</span>
                        <svg
                          class="idiom-acc-chevron"
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </a>

                      {/* Expanded body: meaning + verses + related idioms */}
                      <div class="idiom-accordion-body">
                        <div class="idiom-acc-section acc-meaning">
                          <span class="idiom-acc-label">Meaning</span>
                          <span class="idiom-acc-text">
                            {idiom.meaning || "— no meaning yet —"}
                          </span>
                        </div>
                        {idiom.relatedVerses.length > 0 && (
                          <div class="idiom-acc-section acc-verses">
                            <span class="idiom-acc-label">Verses</span>
                            <div class="idiom-acc-chips">
                              {idiom.relatedVerses.map((v) => (
                                <span class="idiom-chip idiom-chip-verse">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {idiom.relatedIdioms.length > 0 && (
                          <div class="idiom-acc-section acc-related">
                            <span class="idiom-acc-label">Related</span>
                            <div class="idiom-acc-chips">
                              {idiom.relatedIdioms.map((name) => {
                                const rSlug = idiomSlugMap.get(name.toLowerCase())
                                if (rSlug) {
                                  const rHref = resolveRelative(
                                    fileData.slug!,
                                    rSlug as FullSlug,
                                  )
                                  return (
                                    <a
                                      href={rHref}
                                      class="internal idiom-chip idiom-chip-related idiom-chip-link"
                                    >
                                      {name}
                                    </a>
                                  )
                                }
                                return (
                                  <span class="idiom-chip idiom-chip-disabled">{name}</span>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

IdiomIndex.css = (listPageStyle as unknown as string) + "\n" + (idiomStyle as unknown as string)

IdiomIndex.afterDOMLoaded = `
(function () {
  // ── View toggle ──────────────────────────────────────────────────────────────
  function syncViewButtons(v) {
    document.querySelectorAll('#idiom-index .view-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.viewTarget === v)
    })
  }

  function initView() {
    var saved
    try { saved = localStorage.getItem('folder-view') } catch (e) {}
    var v = saved || 'cards-sm'
    var container = document.getElementById('idiom-index')
    if (!container) return

    container.querySelectorAll('.page-listing').forEach(function (el) {
      el.setAttribute('data-view', v)
    })
    syncViewButtons(v)

    container.querySelectorAll('.view-btn').forEach(function (btn) {
      if (btn.dataset.vlistening) return
      btn.dataset.vlistening = '1'
      btn.addEventListener('click', function () {
        var t = this.dataset.viewTarget
        if (!t) return
        try { localStorage.setItem('folder-view', t) } catch (e) {}
        container.querySelectorAll('.page-listing').forEach(function (el) {
          el.setAttribute('data-view', t)
        })
        syncViewButtons(t)
      })
    })
  }

  // ── Collapsible letter sections ──────────────────────────────────────────────
  function initCollapse() {
    var container = document.getElementById('idiom-index')
    if (!container) return

    container.querySelectorAll('.idiom-letter-section').forEach(function (section) {
      var heading = section.querySelector('.idiom-letter-heading')
      if (!heading || heading.dataset.clistening) return
      heading.dataset.clistening = '1'

      function toggle() {
        var isCollapsed = section.classList.contains('collapsed')
        section.classList.toggle('collapsed', !isCollapsed)
        heading.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false')
      }

      heading.addEventListener('click', toggle)
      heading.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
      })
    })
  }

  // ── Card flip navigation ─────────────────────────────────────────────────────
  // Desktop: CSS hover flips; click navigates.
  // Mobile: tap once to flip (if card wide enough), tap again to navigate.
  function initCardFlip() {
    var container = document.getElementById('idiom-index')
    if (!container) return
    var isTouch = window.matchMedia('(pointer: coarse)').matches

    container.querySelectorAll('.idiom-flip-card').forEach(function (card) {
      if (card.dataset.fliplistening) return
      card.dataset.fliplistening = '1'
      var href = card.dataset.href
      if (!href) return

      if (isTouch) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('a')) return
          var wide = card.offsetWidth >= 110
          if (!wide) { window.location.href = href; return }
          if (card.classList.contains('flipped')) {
            window.location.href = href
          } else {
            card.classList.add('flipped')
            e.preventDefault()
          }
        })
      } else {
        card.addEventListener('click', function (e) {
          if (e.target.closest('a')) return
          window.location.href = href
        })
      }
    })

    if (isTouch) {
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.idiom-flip-card')) {
          document.querySelectorAll('.idiom-flip-card.flipped').forEach(function (c) {
            c.classList.remove('flipped')
          })
        }
      })
    }
  }

  // ── Collapsible intro ────────────────────────────────────────────────────────
  function initIntroCollapse() {
    var idiomIndex = document.getElementById('idiom-index')
    if (!idiomIndex) return
    var articleEl = document.querySelector('article.popover-hint')
    if (!articleEl || articleEl.dataset.introWrapped) return
    articleEl.dataset.introWrapped = '1'

    var wrapper = document.createElement('div')
    wrapper.className = 'idiom-intro-section collapsed'
    var heading = document.createElement('div')
    heading.className = 'idiom-intro-heading'
    heading.innerHTML =
      '<button class="section-collapse-btn" aria-expanded="false" aria-label="Toggle intro">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button><span>About Bible Idioms &amp; Navigation Tips</span>'
    var body = document.createElement('div')
    body.className = 'idiom-intro-body'

    while (articleEl.firstChild) { body.appendChild(articleEl.firstChild) }
    articleEl.appendChild(wrapper)
    wrapper.appendChild(heading)
    wrapper.appendChild(body)

    var btn = heading.querySelector('.section-collapse-btn')
    function toggle() {
      var isCollapsed = wrapper.classList.contains('collapsed')
      wrapper.classList.toggle('collapsed', !isCollapsed)
      btn.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false')
    }
    btn.addEventListener('click', toggle)
    heading.addEventListener('click', function (e) {
      if (e.target.closest('.section-collapse-btn')) return
      toggle()
    })
  }

  function init() {
    initView()
    initCollapse()
    initCardFlip()
    initIntroCollapse()
  }

  init()
  document.addEventListener('nav', init)
})()
`

export default (() => IdiomIndex) satisfies QuartzComponentConstructor
