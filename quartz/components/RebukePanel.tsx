import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import style from "./styles/rebukePanel.scss"

const RebukePanel: QuartzComponent = () => {
  return (
    <div class="rebuke-panel-wrapper">
      <div class="rebuke-info-box">
        <span class="rebuke-info-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
        </span>
        <span class="rebuke-info-text">
          Select a platform tab, then hit <strong>Copy</strong> on a rebuke to paste it directly into your social post.
        </span>
      </div>
      <div id="rebuke-tab-root" />
    </div>
  )
}

RebukePanel.css = style as unknown as string

RebukePanel.afterDOMLoaded = `
(function () {
  var PLATFORM_ICONS = {
    'General': '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
    'Facebook': '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    'Instagram': '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    'Threads': '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.068V12c0-3.514.857-6.367 2.549-8.479C5.893 1.258 8.596.03 12.063 0h.015c2.813.025 5.117.75 6.854 2.158 1.64 1.334 2.755 3.2 3.315 5.552l-2.413.643c-.444-1.85-1.264-3.255-2.441-4.175C16.168 3.238 14.336 2.624 12.074 2.6c-2.714.031-4.836.899-6.313 2.582C4.32 6.888 3.5 9.224 3.5 12.068c0 2.835.813 5.164 2.417 6.924 1.494 1.64 3.687 2.5 6.27 2.5h.007c2.584 0 4.776-.86 6.27-2.5.978-1.072 1.634-2.5 1.97-4.257a7.85 7.85 0 0 1-4.476.93c-3.168-.288-5.278-2.254-5.278-5.003v-.006c0-2.843 2.226-5.003 5.184-5.003 1.35 0 2.577.463 3.459 1.305.942.9 1.422 2.144 1.396 3.607v.004c-.01 1.258-.38 2.38-1.073 3.235.16.31.25.655.25 1.02 0 1.277-1.033 2.314-2.307 2.314-1.277 0-2.314-1.037-2.314-2.314 0-.376.093-.73.258-1.04-.455-.613-.702-1.39-.702-2.226 0-2.144 1.503-3.604 3.657-3.604.913 0 1.736.276 2.37.775a3.09 3.09 0 0 0-.22-1.143c-.521-1.353-1.758-2.13-3.493-2.13-2.186 0-3.684 1.583-3.684 3.503v.006c0 1.977 1.416 3.168 3.779 3.387 1.98.18 3.994-.666 5.133-2.15-.345 1.826-1.04 3.27-2.07 4.396C17.01 23.14 14.77 24 12.186 24z"/></svg>',
    'Twitter': '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    'TikTok': '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.77a8.16 8.16 0 0 0 4.77 1.52V6.82a4.85 4.85 0 0 1-1.01-.13z"/></svg>',
    'YouTube Live': '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>'
  }

  function initRebukePanel(articleEl, rootEl) {
    var article = articleEl || document.querySelector('article.rebuke')
    var root = rootEl || document.getElementById('rebuke-tab-root')
    if (!article || !root || root.dataset.rebukeInit) return
    root.dataset.rebukeInit = '1'

    // ── Parse the article DOM ─────────────────────────────────────────────────
    var sections = []   // { name, limit, blocks }
    var children = Array.from(article.childNodes)

    var generalBlocks = []
    var inSocialMedia = false
    var currentSection = null

    for (var i = 0; i < children.length; i++) {
      var node = children[i]
      if (node.nodeType !== 1) continue  // skip text nodes
      var el = node
      var tag = el.tagName

      if (tag === 'H1') {
        var h1Text = el.textContent.trim().toLowerCase()
        if (h1Text === 'social media') {
          inSocialMedia = true
          if (currentSection) sections.push(currentSection)
          currentSection = null
        }
        el.remove()
        continue
      }

      var isCodeBlock = (tag === 'FIGURE' || tag === 'PRE')

      if (!inSocialMedia) {
        // Before Social Media: collect code blocks as General
        if (isCodeBlock) {
          var codeNode = el.querySelector('code') || el
          generalBlocks.push(codeNode.textContent.replace(/^\\s+|\\s+$/g, ''))
          el.remove()
        }
        continue
      }

      // Inside Social Media section
      if (tag === 'H2') {
        if (currentSection) sections.push(currentSection)
        // H2 textContent may include anchor SVG — grab only direct text nodes
        var h2Name = ''
        el.childNodes.forEach(function(cn) { if (cn.nodeType === 3) h2Name += cn.nodeValue })
        currentSection = { name: (h2Name.trim() || el.textContent.trim()), limit: 0, blocks: [] }
        el.remove()
        continue
      }

      if (tag === 'P' && currentSection === null) {
        // The "each according to character limits" line
        el.remove()
        continue
      }

      if (tag === 'P' && currentSection) {
        // Could be the "X characters each" limit label
        var emEl = el.querySelector('em')
        if (emEl) {
          var m = emEl.textContent.trim().match(/^([\\d,]+)\\s+characters?/i)
          if (m) {
            currentSection.limit = parseInt(m[1].replace(/,/g, ''), 10)
            el.remove()
            continue
          }
        }
        el.remove()
        continue
      }

      if (isCodeBlock && currentSection) {
        var codeNode2 = el.querySelector('code') || el
        currentSection.blocks.push(codeNode2.textContent.replace(/^\\s+|\\s+$/g, ''))
        el.remove()
        continue
      }
    }

    if (currentSection) sections.push(currentSection)

    // Remove any remaining h1 (the "Rebuke" heading — page title already shows it)
    Array.from(article.querySelectorAll('h1')).forEach(function (h) { h.remove() })

    // Build sections array — General first, then platforms (only if non-empty)
    var allSections = []
    if (generalBlocks.length > 0) {
      allSections.push({ name: 'General', limit: 0, blocks: generalBlocks })
    }
    sections.forEach(function (s) {
      if (s.blocks.length > 0) allSections.push(s)
    })

    if (allSections.length === 0) return

    // ── Build Tab Strip ───────────────────────────────────────────────────────
    var tabStrip = document.createElement('div')
    tabStrip.className = 'rebuke-tab-strip'

    var panels = []
    var tabs = []

    allSections.forEach(function (section, idx) {
      var icon = PLATFORM_ICONS[section.name] || PLATFORM_ICONS['General']

      // Tab button
      var tab = document.createElement('button')
      tab.className = 'rebuke-tab' + (idx === 0 ? ' rebuke-tab-active' : '')
      tab.setAttribute('type', 'button')
      tab.setAttribute('aria-selected', idx === 0 ? 'true' : 'false')
      tab.innerHTML = icon + '<span>' + section.name + '</span>'
      tabStrip.appendChild(tab)
      tabs.push(tab)

      // Panel
      var panel = document.createElement('div')
      panel.className = 'rebuke-tab-panel' + (idx === 0 ? ' rebuke-tab-panel-active' : '')

      section.blocks.forEach(function (text, bIdx) {
        var card = document.createElement('div')
        card.className = 'rebuke-card'

        // ── Card header: number + copy button ───────────────────────────────
        var copyBtn = document.createElement('button')
        copyBtn.className = 'rebuke-copy-btn'
        copyBtn.setAttribute('type', 'button')
        copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>'
        copyBtn.addEventListener('click', function () {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
              copyBtn.classList.add('rebuke-copied')
              copyBtn.querySelector('span').textContent = 'Copied!'
              setTimeout(function () {
                copyBtn.classList.remove('rebuke-copied')
                copyBtn.querySelector('span').textContent = 'Copy'
              }, 2000)
            })
          } else {
            var ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
            copyBtn.classList.add('rebuke-copied')
            copyBtn.querySelector('span').textContent = 'Copied!'
            setTimeout(function () {
              copyBtn.classList.remove('rebuke-copied')
              copyBtn.querySelector('span').textContent = 'Copy'
            }, 2000)
          }
        })

        var cardHeader = document.createElement('div')
        cardHeader.className = 'rebuke-card-header'
        var cardNum = document.createElement('span')
        cardNum.className = 'rebuke-card-num'
        cardNum.textContent = '#' + (bIdx + 1)
        cardHeader.appendChild(cardNum)
        cardHeader.appendChild(copyBtn)
        card.appendChild(cardHeader)

        // ── Card body: rebuke text ───────────────────────────────────────────
        var textEl = document.createElement('div')
        textEl.className = 'rebuke-card-text'
        textEl.textContent = text
        card.appendChild(textEl)

        // ── Card footer: char counter (only when limit is known) ─────────────
        if (section.limit > 0) {
          var charCount = text.length
          var pct = Math.min(charCount / section.limit, 1)
          var barClass = pct < 0.8 ? 'rebuke-bar-ok' : pct < 0.95 ? 'rebuke-bar-warn' : 'rebuke-bar-over'

          var footer = document.createElement('div')
          footer.className = 'rebuke-card-footer'

          var barWrap = document.createElement('div')
          barWrap.className = 'rebuke-progress-wrap'
          var bar = document.createElement('div')
          bar.className = 'rebuke-progress-bar ' + barClass
          bar.style.width = Math.round(pct * 100) + '%'
          barWrap.appendChild(bar)

          var countLabel = document.createElement('span')
          countLabel.className = 'rebuke-char-count'
          countLabel.textContent = charCount.toLocaleString() + ' / ' + section.limit.toLocaleString() + ' chars'

          footer.appendChild(barWrap)
          footer.appendChild(countLabel)
          card.appendChild(footer)
        }

        panel.appendChild(card)
      })

      panels.push(panel)
    })

    // Tab switching
    tabs.forEach(function (tab, idx) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t, i) {
          t.classList.toggle('rebuke-tab-active', i === idx)
          t.setAttribute('aria-selected', i === idx ? 'true' : 'false')
          panels[i].classList.toggle('rebuke-tab-panel-active', i === idx)
        })
      })
    })

    // Inject into root
    root.innerHTML = ''
    root.appendChild(tabStrip)
    panels.forEach(function (p) { root.appendChild(p) })
  }

  window.__initRebukePanel = initRebukePanel

  initRebukePanel(null, null)
  document.addEventListener('nav', function () {
    var root = document.getElementById('rebuke-tab-root')
    if (root) delete root.dataset.rebukeInit
    initRebukePanel(null, null)
  })
})()
`

export default (() => RebukePanel) satisfies QuartzComponentConstructor
