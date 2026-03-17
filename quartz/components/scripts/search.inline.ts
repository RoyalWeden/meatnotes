import FlexSearch, { DefaultDocumentSearchResults } from "flexsearch"
import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, normalizeRelativeURLs, resolveRelative } from "../../util/path"

interface Item {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  [key: string]: any
}

// Can be expanded with things like "term" in the future
type SearchType = "basic" | "tags"
let searchType: SearchType = "basic"
let currentSearchTerm: string = ""
const encoder = (str: string): string[] => {
  const tokens: string[] = []
  let bufferStart = -1
  let bufferEnd = -1
  const lower = str.toLowerCase()

  let i = 0
  for (const char of lower) {
    const code = char.codePointAt(0)!

    const isCJK =
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x20000 && code <= 0x2a6df)

    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13

    if (isCJK) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd))
        bufferStart = -1
      }
      tokens.push(char)
    } else if (isWhitespace) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd))
        bufferStart = -1
      }
    } else {
      if (bufferStart === -1) bufferStart = i
      bufferEnd = i + char.length
    }

    i += char.length
  }

  if (bufferStart !== -1) {
    tokens.push(lower.slice(bufferStart))
  }

  return tokens
}

let index = new FlexSearch.Document<Item>({
  encode: encoder,
  document: {
    id: "id",
    tag: "tags",
    index: [
      {
        field: "title",
        tokenize: "forward",
      },
      {
        field: "content",
        tokenize: "forward",
      },
      {
        field: "tags",
        tokenize: "forward",
      },
    ],
  },
})

const p = new DOMParser()
const fetchContentCache: Map<FullSlug, Element[]> = new Map()
const contextWindowWords = 30
const numSearchResults = 8
const numTagResults = 5

// Natural language date query parser — returns a date range (start/end as YYYY-MM-DD) + display label
interface DateRange {
  start: string
  end: string
  label: string
}

function parseDateQuery(term: string): DateRange | null {
  const lower = term.trim().toLowerCase()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const ymd = (d: Date) => d.toLocaleDateString("sv")
  const single = (d: Date): DateRange => ({
    start: ymd(d),
    end: ymd(d),
    label: d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
  })
  const makeRange = (start: Date, end: Date, label: string): DateRange => ({
    start: ymd(start),
    end: ymd(end),
    label,
  })

  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"]
  const monthShort = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
  const allMonths = monthNames.join("|") + "|" + monthShort.join("|")
  const getMonthIdx = (m: string) => { let i = monthNames.indexOf(m); if (i === -1) i = monthShort.indexOf(m); return i }
  const stripOrd = (s: string) => s.replace(/(st|nd|rd|th)$/, "")

  if (lower === "today") return single(today)
  if (lower === "yesterday") { const d = new Date(today); d.setDate(d.getDate() - 1); return single(d) }

  if (lower === "this week") {
    const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return makeRange(mon, today, `${mon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`)
  }
  if (lower === "last week") {
    const thisMon = new Date(today); thisMon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7)
    const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1)
    return makeRange(lastMon, lastSun, `${lastMon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${lastSun.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`)
  }
  if (lower === "this month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return makeRange(first, today, today.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }
  if (lower === "last month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    return makeRange(first, last, first.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }

  // Weekday: "monday", "last monday", "this monday"
  const wdMatch = lower.match(/^(?:(?:last|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/)
  if (wdMatch) {
    const target = dayNames.indexOf(wdMatch[1])
    const d = new Date(today)
    const back = ((d.getDay() - target + 7) % 7) || 7
    d.setDate(d.getDate() - back)
    return single(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
  }

  // "N/a day/week/month ago|back"
  const agoMatch = lower.match(/^(a|\d+)\s+(day|days|week|weeks|month|months)\s+(?:ago|back)$/)
  if (agoMatch) {
    const n = agoMatch[1] === "a" ? 1 : parseInt(agoMatch[1])
    const d = new Date(today)
    if (agoMatch[2].startsWith("day")) d.setDate(d.getDate() - n)
    else if (agoMatch[2].startsWith("week")) d.setDate(d.getDate() - n * 7)
    else if (agoMatch[2].startsWith("month")) d.setMonth(d.getMonth() - n)
    return single(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
  }

  // ISO: YYYY-MM-DD
  const isoMatch = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return single(new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3])))

  // US slash: M/D or M/D/YYYY
  const slashMatch = lower.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]) - 1, d = parseInt(slashMatch[2]), yr = slashMatch[3] ? parseInt(slashMatch[3]) : now.getFullYear()
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) return single(new Date(yr, m, d))
  }

  // Month + year: "march 2026"
  const myMatch = lower.match(new RegExp(`^(${allMonths})\\s+(\\d{4})$`))
  if (myMatch) {
    const mi = getMonthIdx(myMatch[1]), yr = parseInt(myMatch[2])
    const first = new Date(yr, mi, 1), last = new Date(yr, mi + 1, 0)
    return makeRange(first, last, first.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }

  // Month alone: "march"
  const mAlone = lower.match(new RegExp(`^(${allMonths})$`))
  if (mAlone) {
    const mi = getMonthIdx(mAlone[1]), yr = now.getFullYear()
    const first = new Date(yr, mi, 1), last = new Date(yr, mi + 1, 0)
    return makeRange(first, last, first.toLocaleDateString(undefined, { month: "long", year: "numeric" }))
  }

  // Month + day (with optional ordinal + year): "march 3rd", "march 3", "march 3rd, 2026"
  const mdMatch = lower.match(new RegExp(`^(${allMonths})\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:[,\\s]+(\\d{4}))?$`))
  if (mdMatch) {
    const mi = getMonthIdx(mdMatch[1]), day = parseInt(stripOrd(mdMatch[2])), yr = mdMatch[3] ? parseInt(mdMatch[3]) : now.getFullYear()
    return single(new Date(yr, mi, day))
  }

  // Day + month (with optional "the", "of", ordinal): "3rd march", "3rd of march", "the 3rd of march"
  const dmMatch = lower.match(new RegExp(`^(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?\\s+(${allMonths})(?:\\s+(\\d{4}))?$`))
  if (dmMatch) {
    const day = parseInt(stripOrd(dmMatch[1])), mi = getMonthIdx(dmMatch[2]), yr = dmMatch[3] ? parseInt(dmMatch[3]) : now.getFullYear()
    return single(new Date(yr, mi, day))
  }

  return null
}

const tokenizeTerm = (term: string) => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "")
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }

  return tokens.sort((a, b) => b.length - a.length) // always highlight longest terms first
}

function highlight(searchTerm: string, text: string, trim?: boolean) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  let tokenizedText = text.split(/\s+/).filter((t) => t !== "")

  let startIndex = 0
  let endIndex = tokenizedText.length - 1
  if (trim) {
    const includesCheck = (tok: string) =>
      tokenizedTerms.some((term) => tok.toLowerCase().startsWith(term.toLowerCase()))
    const occurrencesIndices = tokenizedText.map(includesCheck)

    let bestSum = 0
    let bestIndex = 0
    for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
      const window = occurrencesIndices.slice(i, i + contextWindowWords)
      const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0)
      if (windowSum >= bestSum) {
        bestSum = windowSum
        bestIndex = i
      }
    }

    startIndex = Math.max(bestIndex - contextWindowWords, 0)
    endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1)
    tokenizedText = tokenizedText.slice(startIndex, endIndex)
  }

  const slice = tokenizedText
    .map((tok) => {
      // see if this tok is prefixed by any search terms
      for (const searchTok of tokenizedTerms) {
        if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
          const regex = new RegExp(searchTok.toLowerCase(), "gi")
          return tok.replace(regex, `<span class="highlight">$&</span>`)
        }
      }
      return tok
    })
    .join(" ")

  return `${startIndex === 0 ? "" : "..."}${slice}${
    endIndex === tokenizedText.length - 1 ? "" : "..."
  }`
}

function highlightHTML(searchTerm: string, el: HTMLElement) {
  const p = new DOMParser()
  const tokenizedTerms = tokenizeTerm(searchTerm)
  const html = p.parseFromString(el.innerHTML, "text/html")

  const createHighlightSpan = (text: string) => {
    const span = document.createElement("span")
    span.className = "highlight"
    span.textContent = text
    return span
  }

  const highlightTextNodes = (node: Node, term: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue ?? ""
      const regex = new RegExp(term.toLowerCase(), "gi")
      const matches = nodeText.match(regex)
      if (!matches || matches.length === 0) return
      const spanContainer = document.createElement("span")
      let lastIndex = 0
      for (const match of matches) {
        const matchIndex = nodeText.indexOf(match, lastIndex)
        spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, matchIndex)))
        spanContainer.appendChild(createHighlightSpan(match))
        lastIndex = matchIndex + match.length
      }
      spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)))
      node.parentNode?.replaceChild(spanContainer, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).classList.contains("highlight")) return
      Array.from(node.childNodes).forEach((child) => highlightTextNodes(child, term))
    }
  }

  for (const term of tokenizedTerms) {
    highlightTextNodes(html.body, term)
  }

  return html.body
}

async function setupSearch(searchElement: Element, currentSlug: FullSlug, data: ContentIndex) {
  const container = searchElement.querySelector(".search-container") as HTMLElement
  if (!container) return

  const sidebar = container.closest(".sidebar") as HTMLElement | null

  const searchButton = searchElement.querySelector(".search-button") as HTMLButtonElement
  if (!searchButton) return

  const searchBar = searchElement.querySelector(".search-bar") as HTMLInputElement
  if (!searchBar) return

  const searchLayout = searchElement.querySelector(".search-layout") as HTMLElement
  if (!searchLayout) return

  const idDataMap = Object.keys(data) as FullSlug[]
  const appendLayout = (el: HTMLElement) => {
    searchLayout.appendChild(el)
  }

  const enablePreview = searchLayout.dataset.preview === "true"
  let preview: HTMLDivElement | undefined = undefined
  let previewInner: HTMLDivElement | undefined = undefined
  const results = document.createElement("div")
  results.className = "results-container"
  appendLayout(results)

  if (enablePreview) {
    preview = document.createElement("div")
    preview.className = "preview-container"
    appendLayout(preview)
  }

  function hideSearch() {
    container.classList.remove("active")
    searchBar.value = "" // clear the input when we dismiss the search
    if (sidebar) sidebar.style.zIndex = ""
    removeAllChildren(results)
    if (preview) {
      removeAllChildren(preview)
    }
    searchLayout.classList.remove("display-results")
    searchType = "basic" // reset search type after closing
    searchButton.focus()
  }

  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    if (sidebar) sidebar.style.zIndex = "1"
    container.classList.add("active")
    searchBar.focus()
  }

  let currentHover: HTMLInputElement | null = null
  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "k" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const searchBarOpen = container.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("basic")
      return
    } else if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      // Hotkey to open tag search
      e.preventDefault()
      const searchBarOpen = container.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("tags")

      // add "#" prefix for tag search
      searchBar.value = "#"
      return
    }

    if (currentHover) {
      currentHover.classList.remove("focus")
    }

    // If search is active, then we will render the first result and display accordingly
    if (!container.classList.contains("active")) return
    if (e.key === "Enter" && !e.isComposing) {
      // If result has focus, navigate to that one, otherwise pick first result
      if (results.contains(document.activeElement)) {
        const active = document.activeElement as HTMLInputElement
        if (active.classList.contains("no-match")) return
        await displayPreview(active)
        active.click()
      } else {
        const anchor = document.getElementsByClassName("result-card")[0] as HTMLInputElement | null
        if (!anchor || anchor.classList.contains("no-match")) return
        await displayPreview(anchor)
        anchor.click()
      }
    } else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
      e.preventDefault()
      if (results.contains(document.activeElement)) {
        // If an element in results-container already has focus, focus previous one
        const currentResult = currentHover
          ? currentHover
          : (document.activeElement as HTMLInputElement | null)
        const prevResult = currentResult?.previousElementSibling as HTMLInputElement | null
        currentResult?.classList.remove("focus")
        prevResult?.focus()
        if (prevResult) currentHover = prevResult
        await displayPreview(prevResult)
      }
    } else if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault()
      // The results should already been focused, so we need to find the next one.
      // The activeElement is the search bar, so we need to find the first result and focus it.
      if (document.activeElement === searchBar || currentHover !== null) {
        const firstResult = currentHover
          ? currentHover
          : (document.getElementsByClassName("result-card")[0] as HTMLInputElement | null)
        const secondResult = firstResult?.nextElementSibling as HTMLInputElement | null
        firstResult?.classList.remove("focus")
        secondResult?.focus()
        if (secondResult) currentHover = secondResult
        await displayPreview(secondResult)
      }
    }
  }

  const formatForDisplay = (term: string, id: number) => {
    const slug = idDataMap[id]
    return {
      id,
      slug,
      title: searchType === "tags" ? data[slug].title : highlight(term, data[slug].title ?? ""),
      content: highlight(term, data[slug].content ?? "", true),
      tags: highlightTags(term.substring(1), data[slug].tags),
    }
  }

  function highlightTags(term: string, tags: string[]) {
    if (!tags || searchType !== "tags") {
      return []
    }

    return tags
      .map((tag) => {
        if (tag.toLowerCase().includes(term.toLowerCase())) {
          return `<li><p class="match-tag">#${tag}</p></li>`
        } else {
          return `<li><p>#${tag}</p></li>`
        }
      })
      .slice(0, numTagResults)
  }

  function resolveUrl(slug: FullSlug): URL {
    return new URL(resolveRelative(currentSlug, slug), location.toString())
  }

  const resultToHTML = ({ slug, title, content, tags }: Item) => {
    const htmlTags = tags.length > 0 ? `<ul class="tags">${tags.join("")}</ul>` : ``
    const itemTile = document.createElement("a")
    itemTile.classList.add("result-card")
    itemTile.id = slug
    itemTile.href = resolveUrl(slug).toString()
    itemTile.innerHTML = `
      <h3 class="card-title">${title}</h3>
      ${htmlTags}
      <p class="card-description">${content}</p>
    `
    itemTile.addEventListener("click", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    })

    const handler = (event: MouseEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    }

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = ev.target as HTMLInputElement
      await displayPreview(target)
    }

    itemTile.addEventListener("mouseenter", onMouseEnter)
    window.addCleanup(() => itemTile.removeEventListener("mouseenter", onMouseEnter))
    itemTile.addEventListener("click", handler)
    window.addCleanup(() => itemTile.removeEventListener("click", handler))

    return itemTile
  }

  async function displayResults(finalResults: Item[], totalCount?: number, dateLabel?: string) {
    removeAllChildren(results)

    if (dateLabel) {
      const label = document.createElement("p")
      label.className = "date-search-label"
      label.textContent = `📅 ${dateLabel}`
      results.append(label)
    }

    if (finalResults.length === 0) {
      const noMatch = document.createElement("a")
      noMatch.className = "result-card no-match"
      noMatch.innerHTML = `<h3>No results.</h3><p>Try another search term?</p>`
      results.append(noMatch)
    } else {
      results.append(...finalResults.map(resultToHTML))
      if (totalCount !== undefined && totalCount > finalResults.length) {
        const seeAll = document.createElement("a")
        seeAll.className = "result-card see-all-results"
        const searchUrl = resolveUrl("Search" as FullSlug)
        searchUrl.searchParams.set("q", currentSearchTerm)
        seeAll.href = searchUrl.toString()
        seeAll.innerHTML = `<p>See all ${totalCount} results →</p>`
        seeAll.addEventListener("click", hideSearch)
        window.addCleanup(() => seeAll.removeEventListener("click", hideSearch))
        results.append(seeAll)
      }
    }

    if (finalResults.length === 0 && preview) {
      // no results, clear previous preview
      removeAllChildren(preview)
    } else {
      // focus on first result-card (skip the label if present)
      const firstCard = results.querySelector(".result-card") as HTMLElement | null
      if (firstCard) {
        firstCard.classList.add("focus")
        currentHover = firstCard as HTMLInputElement
        await displayPreview(firstCard)
      }
    }
  }

  async function fetchContent(slug: FullSlug): Promise<Element[]> {
    if (fetchContentCache.has(slug)) {
      return fetchContentCache.get(slug) as Element[]
    }

    const targetUrl = resolveUrl(slug).toString()
    const contents = await fetch(targetUrl)
      .then((res) => res.text())
      .then((contents) => {
        if (contents === undefined) {
          throw new Error(`Could not fetch ${targetUrl}`)
        }
        const html = p.parseFromString(contents ?? "", "text/html")
        normalizeRelativeURLs(html, targetUrl)
        return [...html.getElementsByClassName("popover-hint")]
      })

    fetchContentCache.set(slug, contents)
    return contents
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!searchLayout || !enablePreview || !el || !preview) return
    const slug = el.id as FullSlug
    const innerDiv = await fetchContent(slug).then((contents) =>
      contents.flatMap((el) => [...highlightHTML(currentSearchTerm, el as HTMLElement).children]),
    )
    previewInner = document.createElement("div")
    previewInner.classList.add("preview-inner")
    previewInner.append(...innerDiv)
    preview.replaceChildren(previewInner)

    // scroll to longest
    const highlights = [...preview.getElementsByClassName("highlight")].sort(
      (a, b) => b.innerHTML.length - a.innerHTML.length,
    )
    highlights[0]?.scrollIntoView({ block: "start" })
  }

  async function onType(e: HTMLElementEventMap["input"]) {
    if (!searchLayout || !index) return
    currentSearchTerm = (e.target as HTMLInputElement).value
    searchLayout.classList.toggle("display-results", currentSearchTerm !== "")
    searchType = currentSearchTerm.startsWith("#") ? "tags" : "basic"

    // Natural language date query detection
    if (searchType === "basic") {
      try {
        const dateRange = parseDateQuery(currentSearchTerm)
        if (dateRange) {
          const toLocalDateStr = (ts: string | Date | undefined): string => {
            if (!ts) return ""
            const d = new Date(ts as string)
            return d.toLocaleDateString("sv")
          }
          const toSlugDateStr = (slug: string): string => {
            const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
            return m ? m[1] : ""
          }
          const dateResults = Object.entries(data)
            .filter(([slug, fileData]) => {
              const fileDate = toLocalDateStr(fileData.date as string | undefined)
              const slugDate = toSlugDateStr(slug)
              const inRange = (d: string) => d >= dateRange.start && d <= dateRange.end
              return (inRange(fileDate) || inRange(slugDate)) && slug !== "Search"
            })
            .sort(([, a], [, b]) => {
              const aTs = new Date((a.date ?? 0) as string | number).getTime()
              const bTs = new Date((b.date ?? 0) as string | number).getTime()
              return bTs - aTs
            })
          const totalCount = dateResults.length
          const displayItems: Item[] = dateResults.slice(0, numSearchResults).map(([slug, fileData]) => {
            const id = idDataMap.indexOf(slug as FullSlug)
            const dateStr = fileData.date
              ? new Date(fileData.date as string).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
              : ""
            return { id, slug: slug as FullSlug, title: fileData.title ?? slug, content: dateStr ? `Modified: ${dateStr}` : "", tags: [] }
          })
          await displayResults(displayItems, totalCount, dateRange.label)
          return
        }
      } catch {
        // Date parse failed — fall through to normal FlexSearch
      }
    }

    let searchResults: DefaultDocumentSearchResults<Item>
    if (searchType === "tags") {
      currentSearchTerm = currentSearchTerm.substring(1).trim()
      const separatorIndex = currentSearchTerm.indexOf(" ")
      if (separatorIndex != -1) {
        // search by title and content index and then filter by tag (implemented in flexsearch)
        const tag = currentSearchTerm.substring(0, separatorIndex)
        const query = currentSearchTerm.substring(separatorIndex + 1).trim()
        searchResults = await index.searchAsync({
          query: query,
          // return at least 10000 documents, so it is enough to filter them by tag (implemented in flexsearch)
          limit: Math.max(numSearchResults, 10000),
          index: ["title", "content"],
          tag: { tags: tag },
        })
        for (let searchResult of searchResults) {
          searchResult.result = searchResult.result.slice(0, numSearchResults)
        }
        // set search type to basic and remove tag from term for proper highlightning and scroll
        searchType = "basic"
        currentSearchTerm = query
      } else {
        // default search by tags index
        searchResults = await index.searchAsync({
          query: currentSearchTerm,
          limit: numSearchResults,
          index: ["tags"],
        })
      }
    } else if (searchType === "basic") {
      searchResults = await index.searchAsync({
        query: currentSearchTerm,
        limit: 500,
        index: ["title", "content"],
      })
    }

    const getByField = (field: string): number[] => {
      const results = searchResults.filter((x) => x.field === field)
      return results.length === 0 ? [] : ([...results[0].result] as number[])
    }

    // order titles ahead of content
    const allIds: Set<number> = new Set([
      ...getByField("title"),
      ...getByField("content"),
      ...getByField("tags"),
    ])
    const allIdsList = [...allIds].filter((id) => idDataMap[id] !== "Search")
    const totalCount = allIdsList.length
    const finalResults = allIdsList.slice(0, numSearchResults).map((id) => formatForDisplay(currentSearchTerm, id))
    await displayResults(finalResults, totalCount)
  }

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => document.removeEventListener("keydown", shortcutHandler))
  searchButton.addEventListener("click", () => showSearch("basic"))
  window.addCleanup(() => searchButton.removeEventListener("click", () => showSearch("basic")))
  searchBar.addEventListener("input", onType)
  window.addCleanup(() => searchBar.removeEventListener("input", onType))

  registerEscapeHandler(container, hideSearch)
  await fillDocument(data)
}

/**
 * Fills flexsearch document with data
 * @param index index to fill
 * @param data data to fill index with
 */
let indexPopulated = false
async function fillDocument(data: ContentIndex) {
  if (indexPopulated) return
  let id = 0
  const promises: Array<Promise<unknown>> = []
  for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
    promises.push(
      index.addAsync(id++, {
        id,
        slug: slug as FullSlug,
        title: fileData.title,
        content: fileData.content,
        tags: fileData.tags,
      }),
    )
  }

  await Promise.all(promises)
  indexPopulated = true
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  const searchElement = document.getElementsByClassName("search")
  for (const element of searchElement) {
    await setupSearch(element, currentSlug, data)
  }
})
