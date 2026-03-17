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

function parseDateQuery(term: string): Date | null {
  const lower = term.trim().toLowerCase()
  const now = new Date()
  if (lower === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (lower === "yesterday") {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const agoMatch = lower.match(/^(\d+)\s+(day|days|week|weeks|month|months)\s+ago$/)
  if (agoMatch) {
    const n = parseInt(agoMatch[1])
    const d = new Date(now)
    if (agoMatch[2].startsWith("day")) d.setDate(d.getDate() - n)
    else if (agoMatch[2].startsWith("week")) d.setDate(d.getDate() - n * 7)
    else if (agoMatch[2].startsWith("month")) d.setMonth(d.getMonth() - n)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const lastDayMatch = lower.match(/^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/)
  if (lastDayMatch) {
    const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
    const target = days.indexOf(lastDayMatch[1])
    const d = new Date(now)
    const back = ((d.getDay() - target + 7) % 7) || 7
    d.setDate(d.getDate() - back)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const mNames = ["january","february","march","april","may","june","july","august","september","october","november","december"]
  const mShort = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
  const allM = mNames.join("|") + "|" + mShort.join("|")
  const mdMatch = lower.match(new RegExp(`^(${allM})\\s+(\\d{1,2})(?:[,\\s]+(\\d{4}))?$`))
  if (mdMatch) {
    let mi = mNames.indexOf(mdMatch[1]); if (mi === -1) mi = mShort.indexOf(mdMatch[1])
    return new Date(mdMatch[3] ? parseInt(mdMatch[3]) : now.getFullYear(), mi, parseInt(mdMatch[2]))
  }
  const dmMatch = lower.match(new RegExp(`^(\\d{1,2})\\s+(${allM})(?:\\s+(\\d{4}))?$`))
  if (dmMatch) {
    let mi = mNames.indexOf(dmMatch[2]); if (mi === -1) mi = mShort.indexOf(dmMatch[2])
    return new Date(dmMatch[3] ? parseInt(dmMatch[3]) : now.getFullYear(), mi, parseInt(dmMatch[1]))
  }
  return null
}

function sameDay(ts: number | string | undefined, target: Date): boolean {
  if (ts == null) return false
  const d = new Date(ts)
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth() && d.getDate() === target.getDate()
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

  function renderResults(items: Array<{ slug: FullSlug; fileData: ContentDetails; highlight?: string }>, query: string) {
    resultsEl.innerHTML = ""
    if (items.length === 0) {
      resultsEl.innerHTML = `<p class="fs-no-results">No results found. Try a different search term.</p>`
      if (countEl) countEl.textContent = ""
      return
    }
    if (countEl) countEl.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`
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
    const dateTarget = parseDateQuery(query)
    if (dateTarget) {
      const dateMatches = Object.entries(data)
        .filter(([, fd]) => sameDay(fd.date, dateTarget) || sameDay(fd.date, dateTarget))
        .sort(([, a], [, b]) => {
          const aTs = new Date(a.date ?? 0).getTime()
          const bTs = new Date(b.date ?? 0).getTime()
          return sort === "date-asc" ? aTs - bTs : bTs - aTs
        })
        .map(([slug, fileData]) => ({ slug: slug as FullSlug, fileData, highlight: undefined }))
      renderResults(dateMatches, query)
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
    })).filter((item) => item.fileData != null)

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
