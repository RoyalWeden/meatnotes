import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname

  // The illustration container starts empty; the inline script picks one of
  // the SVGs below at random (or restores the cached pick from sessionStorage)
  // and inserts it on first paint. This keeps the page tiny and ensures each
  // visit gets a stable illustration that doesn't re-shuffle on every reload.
  return (
    <article class="popover-hint empty-state">
      <div id="nf-illustration" class="empty-state-illu" aria-hidden="true"></div>
      <h1 class="empty-state-title">Page not found</h1>
      <p class="empty-state-message">{i18n(cfg.locale).pages.error.notFound}</p>
      <p class="empty-state-submessage">This page may have moved or been renamed.</p>
      <a href={baseDir} class="empty-state-action">{i18n(cfg.locale).pages.error.home}</a>
      <div id="not-found-suggestions"></div>
    </article>
  )
}

NotFound.css = `
/* ── EmptyState base shape ────────────────────────────────────────────────
   Centered SF-Symbols-style icon + one short message + one primary action.
   Used by 404 (and reusable later for empty-folder / no-search-results). */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4rem 1.5rem 3rem;
  max-width: 32rem;
  margin: 0 auto;
}

.empty-state-illu {
  width: 140px;
  height: 140px;
  margin-bottom: 2rem;
  color: var(--gray);
  opacity: 0.95;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-illu svg {
  width: 100%;
  height: 100%;
  /* The illustrations use currentColor for the line work and an
     .illu-accent class for selective accent highlights. */
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.empty-state-illu svg .illu-accent {
  stroke: var(--accent);
}

.empty-state-illu svg .illu-accent-fill {
  fill: var(--accent);
  stroke: none;
}

.empty-state-illu svg .illu-soft {
  stroke: var(--gray);
  opacity: 0.5;
}

.empty-state-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 0.5rem 0;
  color: var(--dark);
}

.empty-state-message {
  font-size: 0.95rem;
  color: var(--darkgray);
  margin: 0 0 0.25rem 0;
  line-height: 1.5;
}

.empty-state-submessage {
  color: var(--gray);
  font-size: 0.85rem;
  margin: 0 0 1.75rem 0;
  line-height: 1.5;
}

.empty-state-action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  font-weight: 500;
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast);
  text-decoration: none !important;
  border: none;
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.empty-state-action:hover {
  opacity: 0.88;
}

.empty-state-action:active {
  transform: scale(0.97);
}

/* "Did you mean…" suggestions list — quiet Apple-typography, hairline rows */
#not-found-suggestions {
  margin-top: 2.5rem;
  width: 100%;
  text-align: left;
}
.nf-loading {
  color: var(--gray);
  font-style: italic;
  font-size: 0.85rem;
  text-align: center;
}
.nf-suggest-label {
  font-size: 0.7rem;
  color: var(--gray);
  margin: 0 0 0.6rem 0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
}
.nf-suggestions {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 0.5px solid color-mix(in srgb, var(--darkgray) 10%, transparent);
}
.nf-suggestions li {
  border-bottom: 0.5px solid color-mix(in srgb, var(--darkgray) 8%, transparent);
}
.nf-suggestions a {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem;
  color: var(--dark) !important;
  text-decoration: none !important;
  font-weight: 500;
  font-size: 0.92rem;
  font-weight: inherit !important;
  transition: background-color 0.12s ease, color 0.12s ease;
}
.nf-suggestions a::before {
  content: '';
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--darkgray) 8%, transparent);
  flex-shrink: 0;
}
.nf-suggestions a:hover {
  background: var(--accent-soft);
  color: var(--accent) !important;
}

/* ── Mobile fallback nav sheet (shown when Menu tapped on 404) ──────────── */
.menu-fallback-sheet {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 950;
  background: color-mix(in srgb, var(--light) 94%, transparent);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.12), inset 0 0 0 0.5px color-mix(in srgb, var(--darkgray) 14%, transparent);
  padding: 0 24px max(32px, env(safe-area-inset-bottom, 0px));
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.menu-fallback-sheet.open { transform: translateY(0); }
.menu-fallback-sheet::before {
  content: '';
  display: block;
  width: 36px; height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--darkgray) 22%, transparent);
  margin: 12px auto 20px;
}
.menu-fallback-sheet .mfs-title {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--gray); margin: 0 0 12px;
}
.menu-fallback-sheet ul { list-style: none; padding: 0; margin: 0; }
.menu-fallback-sheet li {
  border-bottom: 0.5px solid color-mix(in srgb, var(--darkgray) 8%, transparent);
}
.menu-fallback-sheet li:last-child { border-bottom: none; }
.menu-fallback-sheet a {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.8rem 0.25rem;
  color: var(--dark) !important; text-decoration: none !important;
  font-size: 0.95rem; font-weight: 500;
  transition: color 0.12s ease;
}
.menu-fallback-sheet a:hover { color: var(--accent) !important; }
`

NotFound.afterDOMLoaded = `
(function() {
  /* ── Illustration library ────────────────────────────────────────────────
     Eight Apple-restrained line-art illustrations. Each is its own short
     story for the moment of "page not found": lost compass, paper plane
     drifting, dim lighthouse, open book missing pages, empty mailbox,
     telescope on tripod, broken bridge, treasure map with mystery pin.
     Stroke is currentColor (so they respect dark mode); selective accent
     highlights use the .illu-accent / .illu-accent-fill classes. */
  var ILLUSTRATIONS = [
    /* Compass — needle slightly off-bearing */
    '<svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="48"/><circle class="illu-soft" cx="70" cy="70" r="38" stroke-dasharray="2 4"/><path class="illu-accent" d="M70 36 L78 70 L70 78 L62 70 Z" stroke-linejoin="round"/><path d="M70 78 L78 70 L70 104 L62 70 Z"/><circle class="illu-accent-fill" cx="70" cy="70" r="3"/><text x="70" y="32" font-size="9" fill="currentColor" stroke="none" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-weight="600">N</text></svg>',

    /* Paper plane drifting with a dotted trail */
    '<svg viewBox="0 0 140 140"><path d="M28 88 L106 36 L82 96 L70 76 L28 88 Z" stroke-linejoin="round"/><path d="M70 76 L82 96" /><path class="illu-soft" d="M28 88 Q40 96 50 92 Q60 88 64 78" stroke-dasharray="3 5"/><circle class="illu-accent-fill" cx="106" cy="36" r="2.5"/></svg>',

    /* Lighthouse with a dim beam */
    '<svg viewBox="0 0 140 140"><path d="M58 110 L60 60 L80 60 L82 110 Z" stroke-linejoin="round"/><rect x="58" y="56" width="24" height="6" rx="1.5"/><rect x="62" y="40" width="16" height="16" rx="2"/><circle class="illu-accent-fill" cx="70" cy="48" r="3"/><path class="illu-accent illu-soft" d="M70 48 L36 30" stroke-dasharray="2 5"/><path class="illu-accent illu-soft" d="M70 48 L104 30" stroke-dasharray="2 5"/><line x1="40" y1="110" x2="100" y2="110" class="illu-soft"/></svg>',

    /* Open book with one page floating away */
    '<svg viewBox="0 0 140 140"><path d="M28 50 Q70 42 70 56 Q70 42 112 50 L112 100 Q70 92 70 106 Q70 92 28 100 Z"/><line x1="70" y1="56" x2="70" y2="106" class="illu-soft"/><path class="illu-soft" d="M40 64 L60 64 M40 76 L60 76 M80 64 L100 64 M80 76 L100 76" stroke-dasharray="1 3"/><path class="illu-accent" d="M88 24 L108 28 L106 44 L86 40 Z" stroke-linejoin="round"/></svg>',

    /* Empty mailbox with the flag down and door ajar */
    '<svg viewBox="0 0 140 140"><path d="M40 110 L40 64 Q40 50 56 50 L92 50 Q108 50 108 64 L108 110 Z" stroke-linejoin="round"/><path class="illu-soft" d="M56 50 Q56 64 56 76 Q56 64 70 64 L92 64"/><line x1="64" y1="110" x2="64" y2="124"/><line x1="84" y1="110" x2="84" y2="124"/><path class="illu-accent" d="M108 60 L108 72 L120 72 L116 66 L120 60 Z" stroke-linejoin="round"/><circle class="illu-soft" cx="74" cy="86" r="2"/></svg>',

    /* Telescope on a tripod, pointed at the sky */
    '<svg viewBox="0 0 140 140"><path d="M44 90 L78 38 L92 46 L58 98 Z" stroke-linejoin="round"/><circle cx="84" cy="42" r="6"/><line x1="60" y1="74" x2="76" y2="84"/><path d="M58 98 L40 122 M58 98 L70 122 M58 98 L78 122"/><circle class="illu-accent-fill" cx="100" cy="28" r="2"/><circle class="illu-accent-fill" cx="116" cy="50" r="1.5"/><circle class="illu-accent-fill" cx="108" cy="68" r="1.5"/></svg>',

    /* Broken bridge — two pillars with a dotted gap */
    '<svg viewBox="0 0 140 140"><path d="M16 84 L52 84 L52 118 L16 118 Z M88 84 L124 84 L124 118 L88 118 Z" stroke-linejoin="round"/><line x1="52" y1="84" x2="58" y2="84"/><line x1="82" y1="84" x2="88" y2="84"/><path class="illu-soft" d="M58 84 L82 84" stroke-dasharray="3 5"/><path class="illu-accent" d="M64 60 L70 70 L76 60" stroke-linejoin="round"/><line x1="70" y1="70" x2="70" y2="78" class="illu-accent"/></svg>',

    /* Folded treasure map with a mystery pin */
    '<svg viewBox="0 0 140 140"><path d="M30 36 L60 30 L90 38 L116 32 L116 104 L86 110 L60 102 L30 108 Z" stroke-linejoin="round"/><line x1="60" y1="30" x2="60" y2="102" class="illu-soft" stroke-dasharray="2 4"/><line x1="90" y1="38" x2="90" y2="110" class="illu-soft" stroke-dasharray="2 4"/><path class="illu-soft" d="M40 60 Q56 64 70 56 T100 70" stroke-dasharray="3 3"/><circle class="illu-accent-fill" cx="78" cy="62" r="4"/><path class="illu-accent" d="M78 56 Q72 60 72 66 Q72 72 78 76 Q84 72 84 66 Q84 60 78 56 Z" stroke-linejoin="round"/></svg>',
  ]

  function chooseIllustration() {
    var key = 'nf-illu-index'
    var raw = window.sessionStorage ? window.sessionStorage.getItem(key) : null
    var idx = raw !== null ? parseInt(raw, 10) : NaN
    if (!(idx >= 0 && idx < ILLUSTRATIONS.length)) {
      idx = Math.floor(Math.random() * ILLUSTRATIONS.length)
      try { if (window.sessionStorage) window.sessionStorage.setItem(key, String(idx)) } catch (e) {}
    }
    return ILLUSTRATIONS[idx]
  }

  function mountIllustration() {
    var el = document.getElementById('nf-illustration')
    if (!el) return
    if (el.dataset.illuMounted) return
    el.innerHTML = chooseIllustration()
    el.dataset.illuMounted = '1'
  }

  mountIllustration()
  document.addEventListener('nav', mountIllustration)

  /* ── Menu fallback sheet (for MobileTabBar on 404) ─────────────────────── */
  if (!document.querySelector('.menu-fallback-sheet')) {
    var sheet = document.createElement('div')
    sheet.className = 'menu-fallback-sheet'
    sheet.innerHTML = '<p class="mfs-title">Navigation</p><ul>' +
      '<li><a href="/">🏠 Home</a></li>' +
      '<li><a href="/Daily">📅 Daily Notes</a></li>' +
      '<li><a href="/Graph">🕸 Graph View</a></li>' +
      '<li><a href="/tags">🏷 Tags</a></li>' +
      '</ul>'
    document.body.appendChild(sheet)
  }
  // Wire backdrop click to close the fallback sheet
  function closeFallbackSheet() {
    var fs = document.querySelector('.menu-fallback-sheet')
    var bd = document.querySelector('.menu-backdrop')
    if (fs) fs.classList.remove('open')
    if (bd) {
      bd.classList.remove('open')
      document.documentElement.classList.remove('mobile-no-scroll')
    }
  }
  document.addEventListener('click', function(e) {
    var bd = document.querySelector('.menu-backdrop')
    if (bd && e.target === bd) closeFallbackSheet()
  })

  /* ── "Did you mean…" smart suggestions (preserved from original) ─────── */
  var container = document.getElementById('not-found-suggestions')
  if (!container) return

  var STOPWORDS = new Set(['the','a','an','and','or','of','in','to','for','with','on','at','by','from','is','it','as','be','this','that','was','are','but','not','all','are','been','have','has'])

  var raw = decodeURIComponent(window.location.pathname)
  var words = raw
    .split('/')
    .join('-')
    .split('-')
    .map(function(w) { return w.toLowerCase().replace(/[^a-z0-9]/g, '') })
    .filter(function(w) { return w.length > 2 && !/^\\d+$/.test(w) && !STOPWORDS.has(w) })

  if (words.length === 0) return

  container.innerHTML = '<p class="nf-loading">Looking for related pages…</p>'

  fetch('/static/contentIndex.json')
    .then(function(r) { return r.json() })
    .then(function(index) {
      var scores = []

      for (var slug in index) {
        if (slug === '404' || slug === 'index') continue
        var entry = index[slug]
        var title = (entry.title || '').toLowerCase()
        var slugLower = slug.toLowerCase()
        var score = 0

        for (var i = 0; i < words.length; i++) {
          var w = words[i]
          if (title.indexOf(w) !== -1) score += 3
          if (slugLower.indexOf(w) !== -1) score += 2

          var titleWords = title.split(/[\\s\\-_\\/]+/)
          for (var j = 0; j < titleWords.length; j++) {
            if (titleWords[j] === w) { score += 2; break }
          }
        }

        if (score > 0) scores.push({ slug: slug, title: entry.title || slug, score: score })
      }

      scores.sort(function(a, b) { return b.score - a.score })
      var top = scores.slice(0, 5)

      if (top.length === 0) {
        container.innerHTML = ''
        return
      }

      var html = '<p class="nf-suggest-label">Did you mean…</p><ul class="nf-suggestions">'
      for (var k = 0; k < top.length; k++) {
        var s = top[k]
        var href = '/' + s.slug
        html += '<li><a href="' + href + '">' + s.title + '</a></li>'
      }
      html += '</ul>'
      container.innerHTML = html
    })
    .catch(function() { container.innerHTML = '' })
})()
`

export default (() => NotFound) satisfies QuartzComponentConstructor
