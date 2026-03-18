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

// ─── Quote-based phrase extraction ──────────────────────────────────────────

function extractPhrases(query: string): { phrases: string[]; searchTerm: string } {
  const phrases: string[] = []
  const remainder = query
    .replace(/"([^"]+)"/g, (_, phrase) => {
      phrases.push(phrase.trim().toLowerCase())
      return " "
    })
    .replace(/\s+/g, " ")
    .trim()
  return { phrases, searchTerm: remainder || phrases.join(" ") }
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

// ─── Boolean query parser ────────────────────────────────────────────────────

type Token = { type: "WORD" | "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN"; value: string }

type QueryNode =
  | { type: "term"; value: string }
  | { type: "and"; left: QueryNode; right: QueryNode }
  | { type: "or"; left: QueryNode; right: QueryNode }
  | { type: "not"; operand: QueryNode }

function tokenizeBoolQuery(q: string): Token[] {
  const raw = q.trim().match(/\(|\)|AND|OR|NOT|[^\s()]+/g) ?? []
  return raw.map((tok) => {
    if (tok === "AND") return { type: "AND", value: tok }
    if (tok === "OR") return { type: "OR", value: tok }
    if (tok === "NOT") return { type: "NOT", value: tok }
    if (tok === "(") return { type: "LPAREN", value: tok }
    if (tok === ")") return { type: "RPAREN", value: tok }
    return { type: "WORD", value: tok }
  })
}

function parseBoolQuery(q: string): QueryNode {
  const tokens = tokenizeBoolQuery(q)
  let pos = 0

  function peek(): Token | undefined { return tokens[pos] }
  function consume(): Token { return tokens[pos++] }

  function parseOr(): QueryNode {
    let left = parseAnd()
    while (peek()?.type === "OR") {
      consume()
      const right = parseAnd()
      left = { type: "or", left, right }
    }
    return left
  }

  function parseAnd(): QueryNode {
    let left = parseNot()
    while (peek()?.type === "AND") {
      consume()
      const right = parseNot()
      left = { type: "and", left, right }
    }
    return left
  }

  function parseNot(): QueryNode {
    if (peek()?.type === "NOT") {
      consume()
      return { type: "not", operand: parsePrimary() }
    }
    return parsePrimary()
  }

  function parsePrimary(): QueryNode {
    if (peek()?.type === "LPAREN") {
      consume() // (
      const node = parseOr()
      if (peek()?.type === "RPAREN") consume() // )
      return node
    }
    // Collect consecutive WORDs as a single term
    const words: string[] = []
    while (peek()?.type === "WORD") {
      words.push(consume().value)
    }
    if (words.length === 0) {
      // Unexpected token — skip it and return an empty term
      if (peek()) consume()
      return { type: "term", value: "" }
    }
    return { type: "term", value: words.join(" ") }
  }

  return parseOr()
}

function queryHasBooleanOps(q: string): boolean {
  return /\bAND\b|\bOR\b|\bNOT\b|[()]/.test(q)
}

function setIntersection(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => b.has(x)))
}
function setUnion(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a, ...b])
}
function setDifference(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => !b.has(x)))
}

// ─── Main search logic ───────────────────────────────────────────────────────

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
  const filterPhrase = document.getElementById("fs-filter-phrase") as HTMLInputElement | null
  const phraseWrapper = document.getElementById("fs-phrase-wrapper") as HTMLElement | null

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

  // Build HTML for a list of result cards (reusable for main results + suggestions)
  function buildCards(
    items: Array<{ slug: FullSlug; fileData: ContentDetails; highlight?: string }>,
    query: string,
  ): string {
    return items
      .map(({ slug, fileData, highlight: hl }) => {
        const url = resolveUrl(slug)
        const title = hl ? highlight(query, fileData.title ?? slug) : (fileData.title ?? slug)
        const dateStr = fileData.date
          ? new Date(fileData.date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : ""
        const excerpt = hl ? highlight(query, (fileData.content ?? "").slice(0, 200)) : ""
        const tagsHtml =
          fileData.tags && fileData.tags.length > 0
            ? `<ul class="fs-result-tags">${fileData.tags.map((t) => `<li>#${t}</li>`).join("")}</ul>`
            : ""
        return `
          <a class="fs-result-card" href="${url}">
            <h3 class="fs-result-title">${title}</h3>
            ${dateStr ? `<p class="fs-result-meta">${dateStr}</p>` : ""}
            ${excerpt ? `<p class="fs-result-excerpt">${excerpt}</p>` : ""}
            ${tagsHtml}
          </a>`
      })
      .join("")
  }

  // Search for a term across specified fields, returns item array
  async function searchFor(
    term: string,
    fields: string[],
  ): Promise<Array<{ slug: FullSlug; fileData: ContentDetails; highlight: string }>> {
    if (!term.trim() || fields.length === 0) return []
    const res = await index.searchAsync({ query: term, limit: 1000, index: fields })
    const ids = new Set<number>()
    for (const r of res) for (const id of r.result) ids.add(id as number)
    return [...ids]
      .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]], highlight: term }))
      .filter((item) => item.slug !== "Search" && item.fileData != null)
  }

  // Evaluate a boolean query AST, returns Set of matching IDs
  async function evalBoolNode(node: QueryNode, fields: string[]): Promise<Set<number>> {
    if (node.type === "term") {
      if (!node.value) return new Set()
      const res = await index.searchAsync({ query: node.value, limit: 1000, index: fields })
      const ids = new Set<number>()
      for (const r of res) for (const id of r.result) ids.add(id as number)
      return ids
    }
    if (node.type === "and") {
      return setIntersection(
        await evalBoolNode(node.left, fields),
        await evalBoolNode(node.right, fields),
      )
    }
    if (node.type === "or") {
      return setUnion(
        await evalBoolNode(node.left, fields),
        await evalBoolNode(node.right, fields),
      )
    }
    if (node.type === "not") {
      const all = new Set(idDataMap.map((_, i) => i))
      const sub = await evalBoolNode(node.operand, fields)
      return setDifference(all, sub)
    }
    return new Set()
  }

  // Smart suggestions: try adjacent word pairs, then individual words
  async function getSmartSuggestions(
    words: string[],
    fields: string[],
  ): Promise<Array<{ label: string; items: Array<{ slug: FullSlug; fileData: ContentDetails; highlight: string }> }>> {
    const seen = new Set<string>()
    const results: Array<{ label: string; items: Array<{ slug: FullSlug; fileData: ContentDetails; highlight: string }> }> = []

    // Adjacent pairs
    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i + 1]}`
      if (seen.has(pair)) continue
      seen.add(pair)
      const r = await searchFor(pair, fields)
      if (r.length > 0) results.push({ label: `"${pair}"`, items: r })
    }

    // Individual words (skip stopwords / very short)
    const stopwords = new Set(["the", "a", "an", "in", "of", "to", "for", "and", "or", "but", "is", "it"])
    for (const word of words) {
      if (word.length < 3 || stopwords.has(word.toLowerCase())) continue
      if (seen.has(word)) continue
      seen.add(word)
      const r = await searchFor(word, fields)
      if (r.length > 0) results.push({ label: `"${word}"`, items: r.slice(0, 5) })
    }

    return results.slice(0, 3)
  }

  function renderResults(
    items: Array<{ slug: FullSlug; fileData: ContentDetails; highlight?: string }>,
    query: string,
    dateLabel?: string,
    words?: string[],
    fields?: string[],
  ) {
    resultsEl.innerHTML = ""
    if (items.length === 0) {
      const doSuggestions = async () => {
        const w = words ?? query.trim().split(/\s+/).filter(Boolean)
        const f = fields ?? ["title", "content", "tags"]
        if (w.length >= 2 && !queryHasBooleanOps(query)) {
          const suggestions = await getSmartSuggestions(w, f)
          if (suggestions.length > 0) {
            resultsEl.innerHTML = `
              <p class="fs-no-results">No results for <em>"${query}"</em>.</p>
              <details class="fs-similar" open>
                <summary>💡 Similar results</summary>
                ${suggestions
                  .map(
                    (g) => `
                  <div class="fs-similar-group">
                    <p class="fs-similar-label">Results for ${g.label}</p>
                    ${buildCards(g.items, g.label.replace(/"/g, ""))}
                  </div>`,
                  )
                  .join("")}
              </details>`
            if (countEl) countEl.textContent = ""
            return
          }
        }
        resultsEl.innerHTML = `<p class="fs-no-results">No results found. Try a different search term.</p>`
        if (countEl) countEl.textContent = ""
      }
      doSuggestions()
      return
    }
    if (countEl) {
      const count = `${items.length} result${items.length === 1 ? "" : "s"}`
      countEl.textContent = dateLabel ? `📅 ${dateLabel} — ${count}` : count
    }
    resultsEl.innerHTML = buildCards(items, query)
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

    // Extract quoted phrases from the query
    const { phrases, searchTerm: effectiveTerm } = extractPhrases(query)
    const hasQuotes = phrases.length > 0

    // Phrase checkbox: hide when quotes are active (auto-phrase mode), otherwise always visible
    if (hasQuotes && filterPhrase) filterPhrase.checked = false
    const usePhrase = !hasQuotes && (filterPhrase?.checked ?? false)

    // Check for date query (use raw query so date phrases still parse)
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

    // Boolean query path (only when no quoted phrases)
    if (!hasQuotes && queryHasBooleanOps(effectiveTerm)) {
      try {
        const ast = parseBoolQuery(effectiveTerm)
        const ids = await evalBoolNode(ast, searchFields)
        let items = [...ids]
          .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]], highlight: undefined }))
          .filter((item) => item.slug !== "Search" && item.fileData != null)

        if (sort === "date-desc" || sort === "date-asc") {
          items.sort((a, b) => {
            const aTs = new Date(a.fileData.date ?? 0).getTime()
            const bTs = new Date(b.fileData.date ?? 0).getTime()
            return sort === "date-asc" ? aTs - bTs : bTs - aTs
          })
        } else if (sort === "title") {
          items.sort((a, b) => (a.fileData.title ?? "").localeCompare(b.fileData.title ?? ""))
        }

        renderResults(items, effectiveTerm)
      } catch {
        // Fall back to plain search on parse error
        const searchResults = await index.searchAsync({ query: effectiveTerm, limit: 1000, index: searchFields })
        const allIds = new Set<number>()
        for (const r of searchResults) for (const id of r.result) allIds.add(id as number)
        const items = [...allIds]
          .map((id) => ({ slug: idDataMap[id], fileData: data[idDataMap[id]], highlight: effectiveTerm }))
          .filter((item) => item.slug !== "Search" && item.fileData != null)
        renderResults(items, effectiveTerm)
      }
      return
    }

    // Plain search path — use effectiveTerm (quotes stripped) for FlexSearch
    const searchResults = await index.searchAsync({ query: effectiveTerm, limit: 1000, index: searchFields })
    const allIds: Set<number> = new Set()
    for (const r of searchResults) {
      for (const id of r.result) allIds.add(id as number)
    }

    let items = [...allIds]
      .map((id) => ({
        slug: idDataMap[id],
        fileData: data[idDataMap[id]],
        highlight: effectiveTerm,
      }))
      .filter((item) => item.slug !== "Search" && item.fileData != null)

    // Apply quoted phrase filter (auto-detect) or checkbox phrase filter
    if (hasQuotes) {
      items = items.filter((item) =>
        phrases.every(
          (p) =>
            item.fileData.content?.toLowerCase().includes(p) ||
            item.fileData.title?.toLowerCase().includes(p),
        ),
      )
    } else if (usePhrase && effectiveTerm.trim()) {
      const q = effectiveTerm.toLowerCase()
      items = items.filter(
        (item) =>
          item.fileData.content?.toLowerCase().includes(q) ||
          item.fileData.title?.toLowerCase().includes(q),
      )
    }

    if (sort === "date-desc" || sort === "date-asc") {
      items.sort((a, b) => {
        const aTs = new Date(a.fileData.date ?? 0).getTime()
        const bTs = new Date(b.fileData.date ?? 0).getTime()
        return sort === "date-asc" ? aTs - bTs : bTs - aTs
      })
    } else if (sort === "title") {
      items.sort((a, b) => (a.fileData.title ?? "").localeCompare(b.fileData.title ?? ""))
    }

    const words = effectiveTerm.trim().split(/\s+/).filter(Boolean)
    renderResults(items, effectiveTerm, undefined, words, searchFields)
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
  filterPhrase?.addEventListener("change", onFilterChange)
  window.addCleanup(() => {
    filterTitle?.removeEventListener("change", onFilterChange)
    filterContent?.removeEventListener("change", onFilterChange)
    filterTags?.removeEventListener("change", onFilterChange)
    filterPhrase?.removeEventListener("change", onFilterChange)
  })

  if (initialQuery) await doSearch(initialQuery)
})
