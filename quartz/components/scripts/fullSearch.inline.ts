// @ts-nocheck
import FlexSearch from "flexsearch"
import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { FullSlug, resolveRelative } from "../../util/path"

type ContentData = Record<string, ContentDetails>

declare const fetchData: Promise<ContentData>

interface FSItem {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  [key: string]: unknown
}

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
      (code >= 0xac00 && code <= 0xd7af)
    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13
    if (isCJK) {
      if (bufferStart !== -1) { tokens.push(lower.slice(bufferStart, bufferEnd)); bufferStart = -1 }
      tokens.push(char)
    } else if (isWhitespace) {
      if (bufferStart !== -1) { tokens.push(lower.slice(bufferStart, bufferEnd)); bufferStart = -1 }
    } else {
      if (bufferStart === -1) bufferStart = i
      bufferEnd = i + char.length
    }
    i += char.length
  }
  if (bufferStart !== -1) tokens.push(lower.slice(bufferStart))
  return tokens
}

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

function highlight(term: string, text: string): string {
  if (!term || !text) return text
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  return text.replace(regex, "<mark>$1</mark>")
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  if (currentSlug !== ("Search" as FullSlug)) return

  const data: ContentData = await fetchData
  const inputEl = document.getElementById("full-search-input") as HTMLInputElement | null
  const resultsEl = document.getElementById("full-search-results") as HTMLDivElement | null
  const countEl = document.getElementById("full-search-count") as HTMLDivElement | null
  const sortEl = document.getElementById("fs-sort") as HTMLSelectElement | null
  const filterTitle = document.getElementById("fs-filter-title") as HTMLInputElement | null
  const filterContent = document.getElementById("fs-filter-content") as HTMLInputElement | null
  const filterTags = document.getElementById("fs-filter-tags") as HTMLInputElement | null

  if (!inputEl || !resultsEl) return

  const idDataMap = Object.keys(data) as FullSlug[]
  let indexPopulated = false

  const index = new FlexSearch.Document<FSItem>({
    encode: encoder,
    document: {
      id: "id",
      tag: "tags",
      index: [
        { field: "title", tokenize: "forward" },
        { field: "content", tokenize: "forward" },
        { field: "tags", tokenize: "forward" },
      ],
    },
  })

  async function populateIndex() {
    if (indexPopulated) return
    const promises: Promise<unknown>[] = []
    let id = 0
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

  function resolveUrl(slug: FullSlug): string {
    return new URL(resolveRelative(currentSlug, slug), location.toString()).toString()
  }

  function renderResults(items: Array<{ slug: FullSlug; fileData: ContentDetails; highlight?: string }>, query: string, dateLabel?: string) {
    resultsEl.innerHTML = ""
    if (items.length === 0) {
      resultsEl.innerHTML = `<p class="fs-no-results">No results found. Try a different search term.</p>`
      if (countEl) countEl.textContent = ""
      return
    }
    if (countEl) {
      const count = `${items.length} result${items.length === 1 ? "" : "s"}`
      countEl.textContent = dateLabel ? `📅 ${dateLabel} — ${count}` : count
    }
    for (const { slug, fileData, highlight: hl } of items) {
      const card = document.createElement("a")
      card.className = "fs-result-card"
      card.href = resolveUrl(slug)

      const title = hl ? highlight(query, fileData.title ?? slug) : (fileData.title ?? slug)
      const dateStr = fileData.date
        ? new Date(fileData.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : ""
      const excerpt = hl ? highlight(query, (fileData.content ?? "").slice(0, 200)) : ""
      const tagsHtml =
        fileData.tags && fileData.tags.length > 0
          ? `<ul class="fs-result-tags">${fileData.tags.map((t) => `<li>#${t}</li>`).join("")}</ul>`
          : ""

      card.innerHTML = `
        <h3 class="fs-result-title">${title}</h3>
        ${dateStr ? `<p class="fs-result-meta">${dateStr}</p>` : ""}
        ${excerpt ? `<p class="fs-result-excerpt">${excerpt}</p>` : ""}
        ${tagsHtml}
      `
      resultsEl.appendChild(card)
    }
  }

  async function doSearch(query: string) {
    if (!query.trim()) {
      resultsEl.innerHTML = ""
      if (countEl) countEl.textContent = ""
      return
    }

    const sort = sortEl?.value ?? "relevance"
    const useTitle = filterTitle?.checked ?? true
    const useContent = filterContent?.checked ?? true
    const useTags = filterTags?.checked ?? true

    // Check for date query
    const dateRange = parseDateQuery(query)
    if (dateRange) {
      const toLocalDateStr = (ts: string | Date | undefined): string => {
        if (!ts) return ""
        return new Date(ts as string).toLocaleDateString("sv")
      }
      const toSlugDateStr = (slug: string): string => {
        const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
        return m ? m[1] : ""
      }
      const inRange = (d: string) => d >= dateRange.start && d <= dateRange.end
      const dateMatches = Object.entries(data)
        .filter(([slug, fd]) => {
          const fileDate = toLocalDateStr(fd.date as string | undefined)
          const slugDate = toSlugDateStr(slug)
          return (inRange(fileDate) || inRange(slugDate)) && slug !== "Search"
        })
        .sort(([, a], [, b]) => {
          const aTs = new Date(a.date ?? 0).getTime()
          const bTs = new Date(b.date ?? 0).getTime()
          return sort === "date-asc" ? aTs - bTs : bTs - aTs
        })
        .map(([slug, fileData]) => ({ slug: slug as FullSlug, fileData, highlight: undefined }))
      renderResults(dateMatches, query, dateRange.label)
      return
    }

    await populateIndex()
    const searchFields: string[] = []
    if (useTitle) searchFields.push("title")
    if (useContent) searchFields.push("content")
    if (useTags) searchFields.push("tags")
    if (searchFields.length === 0) {
      renderResults([], query)
      return
    }

    const searchResults = await index.searchAsync({ query, limit: 1000, index: searchFields })
    const allIds: Set<number> = new Set()
    for (const r of searchResults) {
      for (const id of r.result) allIds.add(id as number)
    }

    let items = [...allIds].map((id) => ({
      slug: idDataMap[id],
      fileData: data[idDataMap[id]],
      highlight: query,
    })).filter((item) => item.slug !== "Search" && item.fileData != null)

    if (sort === "date-desc" || sort === "date-asc") {
      items.sort((a, b) => {
        const aTs = new Date(a.fileData.date ?? 0).getTime()
        const bTs = new Date(b.fileData.date ?? 0).getTime()
        return sort === "date-asc" ? aTs - bTs : bTs - aTs
      })
    } else if (sort === "title") {
      items.sort((a, b) => (a.fileData.title ?? "").localeCompare(b.fileData.title ?? ""))
    }

    renderResults(items, query)
  }

  // Read initial query from URL
  const urlParams = new URLSearchParams(location.search)
  const initialQuery = urlParams.get("q") ?? ""
  inputEl.value = initialQuery

  const onInput = () => doSearch(inputEl.value)
  inputEl.addEventListener("input", onInput)
  window.addCleanup(() => inputEl.removeEventListener("input", onInput))

  const onSortChange = () => doSearch(inputEl.value)
  sortEl?.addEventListener("change", onSortChange)
  window.addCleanup(() => sortEl?.removeEventListener("change", onSortChange))

  const onFilterChange = () => doSearch(inputEl.value)
  filterTitle?.addEventListener("change", onFilterChange)
  filterContent?.addEventListener("change", onFilterChange)
  filterTags?.addEventListener("change", onFilterChange)
  window.addCleanup(() => {
    filterTitle?.removeEventListener("change", onFilterChange)
    filterContent?.removeEventListener("change", onFilterChange)
    filterTags?.removeEventListener("change", onFilterChange)
  })

  if (initialQuery) await doSearch(initialQuery)
})
