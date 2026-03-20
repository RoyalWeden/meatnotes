import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import style from "./styles/idiomFlashcard.scss"
import { resolveRelative, FullSlug } from "../util/path"

const booksMap: Record<string, string> = {
  gen: "Genesis", genesis: "Genesis",
  exo: "Exodus", exod: "Exodus", exodus: "Exodus",
  lev: "Leviticus", leviticus: "Leviticus",
  num: "Numbers", numbers: "Numbers",
  deu: "Deuteronomy", deut: "Deuteronomy", deuteronomy: "Deuteronomy",
  josh: "Joshua", joshua: "Joshua",
  judg: "Judges", judges: "Judges",
  ruth: "Ruth",
  "1sam": "1+Samuel", "1 sam": "1+Samuel", "1 samuel": "1+Samuel",
  "2sam": "2+Samuel", "2 sam": "2+Samuel", "2 samuel": "2+Samuel",
  "1kings": "1+Kings", "1 kings": "1+Kings",
  "2kings": "2+Kings", "2 kings": "2+Kings",
  "1chron": "1+Chronicles", "1 chron": "1+Chronicles", "1 chronicles": "1+Chronicles",
  "2chron": "2+Chronicles", "2 chron": "2+Chronicles", "2 chronicles": "2+Chronicles",
  ezra: "Ezra", neh: "Nehemiah", nehemiah: "Nehemiah",
  job: "Job",
  ps: "Psalms", psa: "Psalms", psalm: "Psalms", psalms: "Psalms",
  pro: "Proverbs", prov: "Proverbs", proverbs: "Proverbs",
  ecc: "Ecclesiastes", eccl: "Ecclesiastes", ecclesiastes: "Ecclesiastes",
  song: "Song+of+Solomon", sos: "Song+of+Solomon", "song of solomon": "Song+of+Solomon",
  isa: "Isaiah", isaiah: "Isaiah",
  jer: "Jeremiah", jeremiah: "Jeremiah",
  lam: "Lamentations", lamentations: "Lamentations",
  eze: "Ezekiel", ezek: "Ezekiel", ezekiel: "Ezekiel",
  dan: "Daniel", daniel: "Daniel",
  hos: "Hosea", hosea: "Hosea",
  joel: "Joel", amos: "Amos",
  obad: "Obadiah", obadiah: "Obadiah",
  jon: "Jonah", jonah: "Jonah",
  mic: "Micah", micah: "Micah",
  nah: "Nahum", nahum: "Nahum",
  hab: "Habakkuk", habakkuk: "Habakkuk",
  zeph: "Zephaniah", zephaniah: "Zephaniah",
  hag: "Haggai", haggai: "Haggai",
  zech: "Zechariah", zechariah: "Zechariah",
  mal: "Malachi", malachi: "Malachi",
  mat: "Matthew", matt: "Matthew", matthew: "Matthew",
  mark: "Mark", luke: "Luke", john: "John",
  acts: "Acts",
  rom: "Romans", romans: "Romans",
  "1cor": "1+Corinthians", "1 cor": "1+Corinthians", "1 corinthians": "1+Corinthians",
  "2cor": "2+Corinthians", "2 cor": "2+Corinthians", "2 corinthians": "2+Corinthians",
  gal: "Galatians", galatians: "Galatians",
  eph: "Ephesians", ephesians: "Ephesians",
  phil: "Philippians", philippians: "Philippians",
  col: "Colossians", colossians: "Colossians",
  "1thess": "1+Thessalonians", "1 thess": "1+Thessalonians", "1 thessalonians": "1+Thessalonians",
  "2thess": "2+Thessalonians", "2 thess": "2+Thessalonians", "2 thessalonians": "2+Thessalonians",
  "1tim": "1+Timothy", "1 tim": "1+Timothy", "1 timothy": "1+Timothy",
  "2tim": "2+Timothy", "2 tim": "2+Timothy", "2 timothy": "2+Timothy",
  tit: "Titus", titus: "Titus",
  phlm: "Philemon", philemon: "Philemon",
  heb: "Hebrews", hebrews: "Hebrews",
  jas: "James", james: "James",
  "1pet": "1+Peter", "1 pet": "1+Peter", "1 peter": "1+Peter",
  "2pet": "2+Peter", "2 pet": "2+Peter", "2 peter": "2+Peter",
  "1john": "1+John", "1 john": "1+John",
  "2john": "2+John", "2 john": "2+John",
  "3john": "3+John", "3 john": "3+John",
  jude: "Jude",
  rev: "Revelation", revelation: "Revelation",
}

function verseToUrl(verse: string): string {
  const trimmed = verse.trim()
  // Try "Book Chapter:Verse" first
  const verseMatch = trimmed.match(/^(.+?)\s+(\d+):(\d+(?:-\d+)?)/)
  if (verseMatch) {
    const bgBook = booksMap[verseMatch[1].toLowerCase().trim()]
    if (!bgBook) return ""
    return `https://www.biblegateway.com/passage/?search=${bgBook}+${verseMatch[2]}%3A${verseMatch[3]}&version=KJV`
  }
  // Fall back to "Book Chapter" or "Book Chapter-Chapter" (whole chapter / chapter range)
  const chapterMatch = trimmed.match(/^(.+?)\s+(\d+(?:-\d+)?)$/)
  if (chapterMatch) {
    const bgBook = booksMap[chapterMatch[1].toLowerCase().trim()]
    if (!bgBook) return ""
    return `https://www.biblegateway.com/passage/?search=${bgBook}+${chapterMatch[2]}&version=KJV`
  }
  return ""
}

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

  // Add reverse-referenced idioms: any idiom that lists this page as related
  const currentTitle = ((fm.title as string | undefined) ?? fileData.slug?.split("/").pop() ?? "")
    .trim()
    .toLowerCase()
  const reverseRefs: string[] = []
  for (const f of allFiles) {
    if (f.filePath?.includes("01 — Idioms") && f.slug !== fileData.slug) {
      const fRelated = toStringArray(f.frontmatter?.related_idioms)
      if (fRelated.some((r) => r.toLowerCase() === currentTitle)) {
        const fTitle = (
          (f.frontmatter?.title as string | undefined) ??
          f.slug?.split("/").pop() ??
          ""
        ).trim()
        if (fTitle && !relatedIdioms.some((r) => r.toLowerCase() === fTitle.toLowerCase())) {
          reverseRefs.push(fTitle)
        }
      }
    }
  }
  const allRelatedIdioms = [...relatedIdioms, ...reverseRefs]

  const hasChips = allRelatedIdioms.length > 0 || relatedVerses.length > 0

  // Pre-compute hrefs + metadata for related idioms (used by chips and auto-sections)
  const relatedIdiomsData = allRelatedIdioms.map((r) => {
    const rSlug = idiomSlugMap.get(r.toLowerCase())
    const href = rSlug ? resolveRelative(fileData.slug!, rSlug as FullSlug) : ""
    const rFile = rSlug ? allFiles.find((f) => f.slug === rSlug) : undefined
    const rFm = (rFile?.frontmatter ?? {}) as Record<string, unknown>
    const rMeaning = ((rFm.description as string | undefined) ?? "").trim()
    const rVerses = toStringArray(rFm.related_verses).join("|")
    return { name: r, href, meaning: rMeaning, verses: rVerses }
  })

  if (!meaning && !hasChips) return null

  return (
    <div class="idiom-flashcard">
      {/* Hidden data bridge — read by afterDOMLoaded to inject auto sections */}
      <div
        class="idiom-auto-sections"
        style="display:none"
        data-related-idioms={relatedIdiomsData
          .map((d) => `${d.name}\x1e${d.href}\x1e${d.meaning}\x1e${d.verses}`)
          .join("\x1f")}
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
          {relatedIdiomsData.map(({ name, href, meaning, verses }) => {
            if (href) {
              return (
                <a
                  href={href}
                  class="internal idiom-chip idiom-chip-related idiom-chip-link"
                  data-no-popover="true"
                  data-meaning={meaning}
                  data-verses={verses}
                >
                  {name}
                </a>
              )
            }
            return <span class="idiom-chip idiom-chip-related idiom-chip-disabled">{name}</span>
          })}
          {relatedVerses.map((v) => {
            const url = verseToUrl(v)
            return url ? (
              <a
                href={url}
                class="idiom-chip idiom-chip-verse idiom-chip-verse-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {v}
              </a>
            ) : (
              <span class="idiom-chip idiom-chip-verse">{v}</span>
            )
          })}
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

  var BOOKS = {
    gen:'Genesis',genesis:'Genesis',exo:'Exodus',exod:'Exodus',exodus:'Exodus',
    lev:'Leviticus',leviticus:'Leviticus',num:'Numbers',numbers:'Numbers',
    deu:'Deuteronomy',deut:'Deuteronomy',deuteronomy:'Deuteronomy',
    josh:'Joshua',joshua:'Joshua',judg:'Judges',judges:'Judges',ruth:'Ruth',
    '1sam':'1+Samuel','1 sam':'1+Samuel','1 samuel':'1+Samuel',
    '2sam':'2+Samuel','2 sam':'2+Samuel','2 samuel':'2+Samuel',
    '1kings':'1+Kings','1 kings':'1+Kings','2kings':'2+Kings','2 kings':'2+Kings',
    '1chron':'1+Chronicles','1 chron':'1+Chronicles','1 chronicles':'1+Chronicles',
    '2chron':'2+Chronicles','2 chron':'2+Chronicles','2 chronicles':'2+Chronicles',
    ezra:'Ezra',neh:'Nehemiah',nehemiah:'Nehemiah',job:'Job',
    ps:'Psalms',psa:'Psalms',psalm:'Psalms',psalms:'Psalms',
    pro:'Proverbs',prov:'Proverbs',proverbs:'Proverbs',
    ecc:'Ecclesiastes',eccl:'Ecclesiastes',ecclesiastes:'Ecclesiastes',
    song:'Song+of+Solomon',sos:'Song+of+Solomon','song of solomon':'Song+of+Solomon',
    isa:'Isaiah',isaiah:'Isaiah',jer:'Jeremiah',jeremiah:'Jeremiah',
    lam:'Lamentations',lamentations:'Lamentations',
    eze:'Ezekiel',ezek:'Ezekiel',ezekiel:'Ezekiel',
    dan:'Daniel',daniel:'Daniel',hos:'Hosea',hosea:'Hosea',
    joel:'Joel',amos:'Amos',obad:'Obadiah',obadiah:'Obadiah',
    jon:'Jonah',jonah:'Jonah',mic:'Micah',micah:'Micah',
    nah:'Nahum',nahum:'Nahum',hab:'Habakkuk',habakkuk:'Habakkuk',
    zeph:'Zephaniah',zephaniah:'Zephaniah',hag:'Haggai',haggai:'Haggai',
    zech:'Zechariah',zechariah:'Zechariah',mal:'Malachi',malachi:'Malachi',
    mat:'Matthew',matt:'Matthew',matthew:'Matthew',mark:'Mark',luke:'Luke',john:'John',
    acts:'Acts',rom:'Romans',romans:'Romans',
    '1cor':'1+Corinthians','1 cor':'1+Corinthians','1 corinthians':'1+Corinthians',
    '2cor':'2+Corinthians','2 cor':'2+Corinthians','2 corinthians':'2+Corinthians',
    gal:'Galatians',galatians:'Galatians',eph:'Ephesians',ephesians:'Ephesians',
    phil:'Philippians',philippians:'Philippians',col:'Colossians',colossians:'Colossians',
    '1thess':'1+Thessalonians','1 thess':'1+Thessalonians','1 thessalonians':'1+Thessalonians',
    '2thess':'2+Thessalonians','2 thess':'2+Thessalonians','2 thessalonians':'2+Thessalonians',
    '1tim':'1+Timothy','1 tim':'1+Timothy','1 timothy':'1+Timothy',
    '2tim':'2+Timothy','2 tim':'2+Timothy','2 timothy':'2+Timothy',
    tit:'Titus',titus:'Titus',phlm:'Philemon',philemon:'Philemon',
    heb:'Hebrews',hebrews:'Hebrews',jas:'James',james:'James',
    '1pet':'1+Peter','1 pet':'1+Peter','1 peter':'1+Peter',
    '2pet':'2+Peter','2 pet':'2+Peter','2 peter':'2+Peter',
    '1john':'1+John','1 john':'1+John','2john':'2+John','2 john':'2+John',
    '3john':'3+John','3 john':'3+John',
    jude:'Jude',rev:'Revelation',revelation:'Revelation'
  }

  function verseToUrl(v) {
    var trimmed = v.trim()
    // Try "Book Chapter:Verse" first
    var vm = trimmed.match(/^(.+?)\\s+(\\d+):(\\d+(?:-\\d+)?)/)
    if (vm) {
      var bgBook = BOOKS[vm[1].toLowerCase().trim()]
      if (!bgBook) return ''
      return 'https://www.biblegateway.com/passage/?search=' + bgBook + '+' + vm[2] + '%3A' + vm[3] + '&version=KJV'
    }
    // Fall back to "Book Chapter" or "Book Chapter-Chapter"
    var cm = trimmed.match(/^(.+?)\\s+(\\d+(?:-\\d+)?)$/)
    if (cm) {
      var bgBook2 = BOOKS[cm[1].toLowerCase().trim()]
      if (!bgBook2) return ''
      return 'https://www.biblegateway.com/passage/?search=' + bgBook2 + '+' + cm[2] + '&version=KJV'
    }
    return ''
  }

  function makeVerseChip(v) {
    var url = verseToUrl(v)
    if (url) {
      var a = document.createElement('a')
      a.href = url
      a.className = 'idiom-chip idiom-chip-verse idiom-chip-verse-link'
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = v
      return a
    }
    var span = document.createElement('span')
    span.className = 'idiom-chip idiom-chip-verse'
    span.textContent = v
    return span
  }

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

    // ── Remove duplicate h1 (page header already shows the title) ────────────
    var h1 = article.querySelector('h1')
    if (h1) h1.remove()

    // ── Hide empty section cards ──────────────────────────────────────────────
    Array.from(article.querySelectorAll('.idiom-section-card')).forEach(function (card) {
      var titleEl = card.querySelector('.idiom-section-card-title')
      var bodyEl  = card.querySelector('.idiom-section-card-body')
      if (!titleEl || !bodyEl) return
      var title = titleEl.textContent.trim().toLowerCase()
      // Match "related strong's definitions" (handles smart apostrophe) and "related idioms"
      if (!title.includes('strong') && title !== 'related idioms') return
      var bodyText = bodyEl.textContent.trim()
      if (!bodyText || bodyText.toLowerCase() === 'n/a' || bodyText.toLowerCase() === 'none') {
        card.remove()
      }
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
        vChips.appendChild(makeVerseChip(v))
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
        var name    = parts[0]
        var href    = parts[1] || ''
        var meaning = parts[2] || ''
        var verses  = parts[3] || ''
        if (href) {
          var a = document.createElement('a')
          a.href = href
          a.className = 'internal idiom-chip idiom-chip-related idiom-chip-link'
          a.setAttribute('data-no-popover', 'true')
          a.setAttribute('data-meaning', meaning)
          a.setAttribute('data-verses', verses)
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

  // ── Custom hover tooltip for linked related-idiom chips (desktop only) ───────
  function initChipTooltips() {
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (document.body.dataset.chipTipInit) return
    document.body.dataset.chipTipInit = '1'

    var tip = document.getElementById('idiom-chip-tip')
    if (!tip) {
      tip = document.createElement('div')
      tip.id = 'idiom-chip-tip'
      document.body.appendChild(tip)
    }

    function showTip(chip) {
      var name      = chip.textContent.trim()
      var meaning   = chip.getAttribute('data-meaning') || ''
      var versesStr = chip.getAttribute('data-verses')  || ''

      var html = '<div class="ict-name">' + name + '</div>'
      if (meaning) html += '<div class="ict-meaning">' + meaning + '</div>'
      if (versesStr) {
        var chips = versesStr.split('|').filter(Boolean).map(function (v) {
          var vt = v.trim()
          var url = verseToUrl(vt)
          return url
            ? '<a href="' + url + '" class="idiom-chip idiom-chip-verse idiom-chip-verse-link" target="_blank" rel="noopener noreferrer">' + vt + '</a>'
            : '<span class="idiom-chip idiom-chip-verse">' + vt + '</span>'
        }).join('')
        html += '<div class="ict-verses">' + chips + '</div>'
      }
      html += '<div class="ict-cta">Click to Open</div>'

      tip.innerHTML = html
      tip.style.visibility = 'hidden'
      tip.style.display    = 'block'

      var rect = chip.getBoundingClientRect()
      var tipW = tip.offsetWidth
      var tipH = tip.offsetHeight
      var x = rect.left + rect.width / 2 - tipW / 2 + window.scrollX
      var y = rect.top - tipH - 10 + window.scrollY
      if (x < 8) x = 8
      if (x + tipW > window.innerWidth - 8) x = window.innerWidth - tipW - 8
      if (y - window.scrollY < 8) y = rect.bottom + 10 + window.scrollY

      tip.style.left       = x + 'px'
      tip.style.top        = y + 'px'
      tip.style.visibility = 'visible'
      tip.style.opacity    = '1'
    }

    function hideTip() {
      tip.style.opacity = '0'
      setTimeout(function () { tip.style.display = 'none' }, 150)
    }

    document.addEventListener('mouseover', function (e) {
      var chip = e.target.closest && e.target.closest('.idiom-chip-link[data-no-popover]')
      if (chip) showTip(chip)
    })
    document.addEventListener('mouseout', function (e) {
      var chip = e.target.closest && e.target.closest('.idiom-chip-link[data-no-popover]')
      if (chip) hideTip()
    })
  }

  function init() {
    initIdiomSections()
    addBackButton()
    hideMobileToc()
    initChipTooltips()
  }

  init()
  document.addEventListener('nav', init)
})()
`

export default (() => IdiomFlashcard) satisfies QuartzComponentConstructor
