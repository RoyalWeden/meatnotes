import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname

  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>{i18n(cfg.locale).pages.error.notFound}</p>
      <p class="nf-subtitle">This page may have moved or been renamed.</p>
      <a href={baseDir}>{i18n(cfg.locale).pages.error.home}</a>
      <div id="not-found-suggestions"></div>
    </article>
  )
}

NotFound.css = `
.nf-subtitle {
  color: var(--gray);
  font-size: 0.9rem;
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}
#not-found-suggestions {
  margin-top: 2rem;
}
.nf-loading {
  color: var(--gray);
  font-style: italic;
  font-size: 0.9rem;
}
.nf-suggest-label {
  font-size: 0.85rem;
  color: var(--gray);
  margin-bottom: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.nf-suggestions {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.nf-suggestions li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.nf-suggestions li::before {
  content: '→';
  color: var(--gray);
  font-size: 0.85rem;
  flex-shrink: 0;
}
.nf-suggestions a {
  color: var(--secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
}
.nf-suggestions a:hover {
  text-decoration: underline;
}
`

NotFound.afterDOMLoaded = `
(function() {
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

  container.innerHTML = '<p class="nf-loading">Looking for related pages\u2026</p>'

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

          // Title substring match
          if (title.indexOf(w) !== -1) score += 3

          // Slug substring match
          if (slugLower.indexOf(w) !== -1) score += 2

          // Exact title-word match (bonus)
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

      var html = '<p class="nf-suggest-label">Did you mean\u2026</p><ul class="nf-suggestions">'
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
