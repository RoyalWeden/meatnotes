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
type SearchFilter = "all" | "title" | "content" | "tags"
type SearchScope = "all" | "idioms" | "capture" | "progress" | "complete"

// Scroll lock: save position so opening the modal doesn't jump the page
let _scrollLockY = 0
function lockScroll() {
  _scrollLockY = window.scrollY
  const sw = window.innerWidth - document.documentElement.clientWidth
  document.body.style.overflow = "hidden"
  document.body.style.position = "fixed"
  document.body.style.top = `-${_scrollLockY}px`
  document.body.style.width = "100%"
  if (sw > 0) document.body.style.paddingRight = `${sw}px`
}
function unlockScroll() {
  document.body.style.overflow = ""
  document.body.style.position = ""
  document.body.style.top = ""
  document.body.style.width = ""
  document.body.style.paddingRight = ""
  window.scrollTo(0, _scrollLockY)
}

let searchType: SearchType = "basic"
let searchFilter: SearchFilter = "all"
let activeScopes: Set<SearchScope> = new Set(["all"])
let currentSearchTerm: string = ""
let phraseMode: boolean = false
let activeFolderFilter: string | null = null

// Slug-based folder scope matching
const SCOPE_PATTERNS: Record<string, (slug: string) => boolean> = {
  idioms:   (s) => s.toLowerCase().includes("idiom"),
  capture:  (s) => s.startsWith("00-"),
  progress: (s) => s.startsWith("10-"),
  complete: (s) => s.startsWith("20-"),
}

function matchesScope(slug: string): boolean {
  if (activeFolderFilter !== null) {
    return slug.startsWith(activeFolderFilter + "/")
  }
  if (activeScopes.has("all")) return true
  return [...activeScopes].some((scope) => SCOPE_PATTERNS[scope]?.(slug) ?? false)
}

// Derive a friendly display label from a folder slug path
function friendlyFolderLabel(path: string): string {
  return path
    .split("/")
    .map((seg) => seg.replace(/^\d+-—-/, "").replace(/-/g, " ").trim())
    .filter(Boolean)
    .join(" > ")
}

function isIdiomSlug(slug: string): boolean {
  return slug.includes("01-") && slug.toLowerCase().includes("idiom")
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

// ─── Quote-based phrase extraction ───────────────────────────────────────────

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

// ─── Boolean query parser ─────────────────────────────────────────────────────

type BoolToken = { type: "WORD" | "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN"; value: string }

type BoolQueryNode =
  | { type: "term"; value: string }
  | { type: "and"; left: BoolQueryNode; right: BoolQueryNode }
  | { type: "or"; left: BoolQueryNode; right: BoolQueryNode }
  | { type: "not"; operand: BoolQueryNode }

function queryHasBooleanOps(q: string): boolean {
  return /\bAND\b|\bOR\b|\bNOT\b|[()]/.test(q)
}

function tokenizeBoolQuery(q: string): BoolToken[] {
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

function parseBoolQuery(q: string): BoolQueryNode {
  const tokens = tokenizeBoolQuery(q)
  let pos = 0
  const peek = () => tokens[pos]
  const consume = () => tokens[pos++]

  function parseOr(): BoolQueryNode {
    let left = parseAnd()
    while (peek()?.type === "OR") {
      consume()
      const right = parseAnd()
      left = { type: "or", left, right }
    }
    return left
  }
  function parseAnd(): BoolQueryNode {
    let left = parseNot()
    while (peek()?.type === "AND") {
      consume()
      const right = parseNot()
      left = { type: "and", left, right }
    }
    return left
  }
  function parseNot(): BoolQueryNode {
    if (peek()?.type === "NOT") {
      consume()
      return { type: "not", operand: parsePrimary() }
    }
    return parsePrimary()
  }
  function parsePrimary(): BoolQueryNode {
    if (peek()?.type === "LPAREN") {
      consume()
      const node = parseOr()
      if (peek()?.type === "RPAREN") consume()
      return node
    }
    const words: string[] = []
    while (peek()?.type === "WORD") words.push(consume().value)
    if (words.length === 0) {
      if (peek()) consume()
      return { type: "term", value: "" }
    }
    return { type: "term", value: words.join(" ") }
  }
  return parseOr()
}

function boolSetIntersection(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => b.has(x)))
}
function boolSetUnion(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a, ...b])
}
function boolSetDifference(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => !b.has(x)))
}

// Natural language date query parser — returns a date range (start/end as YYYY-MM-DD) + display label
interface DateRange {
  start: string
  end: string
  label: string
}

function parseSingleDate(lower: string): DateRange | null {
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

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ]
  const monthShort = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ]
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const allMonths = monthNames.join("|") + "|" + monthShort.join("|")
  const getMonthIdx = (m: string) => {
    let i = monthNames.indexOf(m)
    if (i === -1) i = monthShort.indexOf(m)
    return i
  }
  const stripOrd = (s: string) => s.replace(/(st|nd|rd|th)$/, "")

  if (lower === "today") return single(today)
  if (lower === "yesterday") {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return single(d)
  }
  if (lower === "recent" || lower === "new" || lower === "latest") {
    const start = new Date(today)
    start.setDate(today.getDate() - 7)
    return makeRange(start, today, "Last 7 days")
  }

  if (lower === "this week") {
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return makeRange(
      mon,
      today,
      `${mon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
    )
  }
  if (lower === "last week") {
    const thisMon = new Date(today)
    thisMon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const lastMon = new Date(thisMon)
    lastMon.setDate(thisMon.getDate() - 7)
    const lastSun = new Date(thisMon)
    lastSun.setDate(thisMon.getDate() - 1)
    return makeRange(
      lastMon,
      lastSun,
      `${lastMon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${lastSun.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
    )
  }
  if (lower === "this month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return makeRange(
      first,
      today,
      today.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    )
  }
  if (lower === "last month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    return makeRange(
      first,
      last,
      first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    )
  }
  if (lower === "this year") {
    const first = new Date(today.getFullYear(), 0, 1)
    return makeRange(first, today, String(today.getFullYear()))
  }
  if (lower === "last year") {
    const yr = today.getFullYear() - 1
    return makeRange(new Date(yr, 0, 1), new Date(yr, 11, 31), String(yr))
  }

  // "in 2024" or bare 4-digit year "2024"
  const inYearMatch = lower.match(/^(?:in\s+)?(\d{4})$/)
  if (inYearMatch) {
    const yr = parseInt(inYearMatch[1])
    if (yr >= 1900 && yr <= 2100) {
      const isCurrentYear = yr === today.getFullYear()
      return makeRange(new Date(yr, 0, 1), isCurrentYear ? today : new Date(yr, 11, 31), String(yr))
    }
  }

  // Weekday: "monday", "last monday", "this monday"
  const wdMatch = lower.match(
    /^(?:(?:last|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  )
  if (wdMatch) {
    const target = dayNames.indexOf(wdMatch[1])
    const d = new Date(today)
    const back = (d.getDay() - target + 7) % 7 || 7
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
  if (isoMatch)
    return single(new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3])))

  // US slash: M/D or M/D/YY or M/D/YYYY (e.g. 3/10, 3/10/26, 03/10/2026)
  const slashMatch = lower.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]) - 1,
      d = parseInt(slashMatch[2])
    let yr = now.getFullYear()
    if (slashMatch[3]) {
      const rawYr = parseInt(slashMatch[3])
      yr = slashMatch[3].length <= 2 ? (rawYr <= 50 ? 2000 + rawYr : 1900 + rawYr) : rawYr
    }
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) return single(new Date(yr, m, d))
  }

  // Month + year: "march 2026"
  const myMatch = lower.match(new RegExp(`^(${allMonths})\\s+(\\d{4})$`))
  if (myMatch) {
    const mi = getMonthIdx(myMatch[1]),
      yr = parseInt(myMatch[2])
    const first = new Date(yr, mi, 1),
      last = new Date(yr, mi + 1, 0)
    return makeRange(
      first,
      last,
      first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    )
  }

  // Month alone: "march"
  const mAlone = lower.match(new RegExp(`^(${allMonths})$`))
  if (mAlone) {
    const mi = getMonthIdx(mAlone[1]),
      yr = now.getFullYear()
    const first = new Date(yr, mi, 1),
      last = new Date(yr, mi + 1, 0)
    return makeRange(
      first,
      last,
      first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    )
  }

  // Month + day (with optional ordinal + year): "march 3rd", "march 3", "march 3rd, 2026"
  const mdMatch = lower.match(
    new RegExp(`^(${allMonths})\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:[,\\s]+(\\d{4}))?$`),
  )
  if (mdMatch) {
    const mi = getMonthIdx(mdMatch[1]),
      day = parseInt(stripOrd(mdMatch[2])),
      yr = mdMatch[3] ? parseInt(mdMatch[3]) : now.getFullYear()
    return single(new Date(yr, mi, day))
  }

  // Day + month (with optional "the", "of", ordinal): "3rd march", "3rd of march", "the 3rd of march"
  const dmMatch = lower.match(
    new RegExp(
      `^(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?\\s+(${allMonths})(?:\\s+(\\d{4}))?$`,
    ),
  )
  if (dmMatch) {
    const day = parseInt(stripOrd(dmMatch[1])),
      mi = getMonthIdx(dmMatch[2]),
      yr = dmMatch[3] ? parseInt(dmMatch[3]) : now.getFullYear()
    return single(new Date(yr, mi, day))
  }

  return null
}

function parseDateQuery(term: string): DateRange | null {
  const lower = term.trim().toLowerCase()

  // Strip conversational framing prefixes
  const stripped = lower
    .replace(/^(?:notes?\s+from|entries?\s+from|find\s+(?:notes?\s+)?(?:from\s+|about\s+)?)\s*/, "")
    .trim()

  // Try range expressions first (avoids ambiguity with single ISO dates containing hyphens)
  const rangePatterns: RegExp[] = [
    /^from\s+(.+?)\s+to\s+(.+)$/, // "from X to Y"
    /^(.+?)\s+to\s+(.+)$/, // "X to Y"
    /^(.+?)\s+through\s+(.+)$/, // "X through Y"
    /^(.+?)\s+-\s+(.+)$/, // "X - Y" (space-hyphen-space)
    /^(.+?)\s+–\s+(.+)$/, // "X – Y" (en dash)
  ]
  for (const pattern of rangePatterns) {
    const match = stripped.match(pattern)
    if (match) {
      const start = parseSingleDate(match[1].trim())
      const end = parseSingleDate(match[2].trim())
      if (start && end) {
        return { start: start.start, end: end.end, label: `${start.label} – ${end.label}` }
      }
    }
  }

  return parseSingleDate(stripped)
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

function stripBoolOps(query: string): string {
  return query
    .replace(/\b(AND|OR|NOT)\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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

function highlightPhrase(phrases: string[], text: string, trim?: boolean): string {
  if (!phrases.length || !text) return text
  let result = text
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    result = result.replace(new RegExp(escaped, "gi"), `<span class="highlight">$&</span>`)
  }
  if (!trim) return result
  // Find best context window around first highlight
  const words = result.split(/\s+/)
  let firstHlIdx = 0
  for (let i = 0; i < words.length; i++) {
    if (words[i].includes("highlight")) {
      firstHlIdx = i
      break
    }
  }
  const start = Math.max(firstHlIdx - 10, 0)
  const end = Math.min(start + 40, words.length)
  return `${start > 0 ? "..." : ""}${words.slice(start, end).join(" ")}${end < words.length ? "..." : ""}`
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

function highlightHTMLPhrase(phrases: string[], el: HTMLElement) {
  const p = new DOMParser()
  const html = p.parseFromString(el.innerHTML, "text/html")
  const createSpan = (text: string) => {
    const span = document.createElement("span")
    span.className = "highlight"
    span.textContent = text
    return span
  }
  const walk = (node: Node, phrase: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue ?? ""
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(escaped, "gi")
      if (!regex.test(nodeText)) return
      regex.lastIndex = 0
      const spanContainer = document.createElement("span")
      let lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(nodeText)) !== null) {
        spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, match.index)))
        spanContainer.appendChild(createSpan(match[0]))
        lastIndex = match.index + match[0].length
      }
      spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)))
      node.parentNode?.replaceChild(spanContainer, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).classList.contains("highlight")) return
      Array.from(node.childNodes).forEach((child) => walk(child, phrase))
    }
  }
  for (const phrase of phrases) walk(html.body, phrase)
  return html.body
}

const RECENT_SEARCHES_KEY = "quartz-recent-searches"
const MAX_RECENT_SEARCHES = 5

function saveRecentSearch(term: string) {
  if (!term.trim()) return
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]")
    const deduped = [term, ...existing.filter((t) => t !== term)].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(deduped))
  } catch {
    /* ignore storage errors */
  }
}

function loadRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]")
  } catch {
    return []
  }
}

// ─── Fuzzy / phonetic helpers ─────────────────────────────────────────────────

// Word dictionary built from all note titles+content during fillDocument
const wordDictionary: Set<string> = new Set()

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function soundex(s: string): string {
  const lower = s.toLowerCase().replace(/[^a-z]/g, "")
  if (!lower) return "0000"
  const table: Record<string, string> = {
    b: "1",
    f: "1",
    p: "1",
    v: "1",
    c: "2",
    g: "2",
    j: "2",
    k: "2",
    q: "2",
    s: "2",
    x: "2",
    z: "2",
    d: "3",
    t: "3",
    l: "4",
    m: "5",
    n: "5",
    r: "6",
  }
  let code = lower[0].toUpperCase()
  let prev = table[lower[0]] ?? "0"
  for (let i = 1; i < lower.length && code.length < 4; i++) {
    const c = table[lower[i]] ?? "0"
    if (c !== "0" && c !== prev) code += c
    prev = c
  }
  return code.padEnd(4, "0")
}

function findFuzzySuggestion(term: string): string | null {
  const lower = term.toLowerCase().trim()
  if (lower.length < 3) return null
  const maxDist = Math.ceil(lower.length / 4) // 1 edit per 4 chars
  let bestWord: string | null = null
  let bestDist = Infinity
  // Edit-distance pass
  for (const word of wordDictionary) {
    if (Math.abs(word.length - lower.length) > maxDist) continue
    const dist = levenshtein(lower, word)
    if (dist < bestDist && dist <= maxDist) {
      bestDist = dist
      bestWord = word
    }
  }
  if (bestWord) return bestWord
  // Phonetic pass
  const targetCode = soundex(lower)
  for (const word of wordDictionary) {
    if (word !== lower && soundex(word) === targetCode) return word
  }
  return null
}

// ─── Bible book abbreviation expansion ────────────────────────────────────────

const BIBLE_BOOKS: Record<string, string> = {
  gen: "genesis",
  exod: "exodus",
  ex: "exodus",
  lev: "leviticus",
  num: "numbers",
  deut: "deuteronomy",
  josh: "joshua",
  judg: "judges",
  ruth: "ruth",
  "1sam": "1 samuel",
  "2sam": "2 samuel",
  "1ki": "1 kings",
  "2ki": "2 kings",
  "1chr": "1 chronicles",
  "2chr": "2 chronicles",
  ezra: "ezra",
  neh: "nehemiah",
  esth: "esther",
  job: "job",
  ps: "psalms",
  psa: "psalms",
  prov: "proverbs",
  eccl: "ecclesiastes",
  song: "song of solomon",
  sos: "song of solomon",
  isa: "isaiah",
  jer: "jeremiah",
  lam: "lamentations",
  ezek: "ezekiel",
  dan: "daniel",
  hos: "hosea",
  joel: "joel",
  amos: "amos",
  obad: "obadiah",
  jonah: "jonah",
  mic: "micah",
  nah: "nahum",
  hab: "habakkuk",
  zeph: "zephaniah",
  hag: "haggai",
  zech: "zechariah",
  mal: "malachi",
  matt: "matthew",
  mk: "mark",
  lk: "luke",
  jn: "john",
  acts: "acts",
  rom: "romans",
  "1cor": "1 corinthians",
  "2cor": "2 corinthians",
  gal: "galatians",
  eph: "ephesians",
  phil: "philippians",
  col: "colossians",
  "1thess": "1 thessalonians",
  "2thess": "2 thessalonians",
  "1tim": "1 timothy",
  "2tim": "2 timothy",
  tit: "titus",
  phlm: "philemon",
  heb: "hebrews",
  jas: "james",
  "1pet": "1 peter",
  "2pet": "2 peter",
  "1jn": "1 john",
  "2jn": "2 john",
  "3jn": "3 john",
  jude: "jude",
  rev: "revelation",
}

/**
 * If term starts with (or equals) a known Bible book abbreviation,
 * returns the expanded full-name equivalent so we can search both.
 * e.g. "rev 3" → "revelation 3", "rev" → "revelation"
 */
function expandBibleBook(term: string): string | null {
  const lower = term.trim().toLowerCase()
  // Exact match
  if (BIBLE_BOOKS[lower]) return BIBLE_BOOKS[lower]
  // Prefix match: "rev 3:16" → abbr="rev", rest=" 3:16"
  const spaceIdx = lower.indexOf(" ")
  if (spaceIdx !== -1) {
    const abbr = lower.slice(0, spaceIdx)
    if (BIBLE_BOOKS[abbr]) return BIBLE_BOOKS[abbr] + lower.slice(spaceIdx)
  }
  return null
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

  const inputWrap = searchElement.querySelector(".search-input-wrap") as HTMLElement | null
  const scopeRow = searchElement.querySelector(".search-scope-row") as HTMLElement | null

  function setFolderFilter(path: string, label: string) {
    activeFolderFilter = path
    // Remove any existing chip first
    inputWrap?.querySelector(".search-chip")?.remove()
    // Inject chip into the input wrap, before the search bar input
    if (inputWrap) {
      const chip = document.createElement("span")
      chip.className = "search-chip"
      chip.setAttribute("aria-label", `Filtering by folder: ${label}`)
      chip.innerHTML = `<span class="search-chip-icon">📁</span><span class="search-chip-label">${label}</span><button class="search-chip-clear" type="button" aria-label="Clear folder filter">×</button>`
      inputWrap.insertBefore(chip, searchBar)
      const clearBtn = chip.querySelector(".search-chip-clear") as HTMLButtonElement
      const clearBtnHandler = () => {
        clearFolderFilter()
        searchBar.dispatchEvent(new Event("input"))
        searchBar.focus()
      }
      clearBtn.addEventListener("click", clearBtnHandler)
      window.addCleanup(() => clearBtn.removeEventListener("click", clearBtnHandler))
    }
    // Dim scope row while folder filter is active
    if (scopeRow) scopeRow.classList.add("scope-row-filtered")
    // Update placeholder to guide the user
    searchBar.placeholder = "Type to search or narrow…"
  }

  function clearFolderFilter() {
    activeFolderFilter = null
    inputWrap?.querySelector(".search-chip")?.remove()
    searchBar.placeholder = defaultPlaceholder
    if (scopeRow) scopeRow.classList.remove("scope-row-filtered")
  }

  function setFilter(filter: SearchFilter) {
    searchFilter = filter
    const filterBtns = searchElement.querySelectorAll(".filter-btn")
    filterBtns.forEach((btn) => {
      btn.classList.toggle("active", (btn as HTMLElement).dataset.filter === filter)
    })
  }

  const phraseBtnEl = searchElement.querySelector(".phrase-btn") as HTMLButtonElement | null

  function setPhraseMode(active: boolean) {
    phraseMode = active
    if (phraseBtnEl) {
      phraseBtnEl.classList.toggle("active", active)
      phraseBtnEl.setAttribute("aria-pressed", String(active))
    }
  }

  function toggleScope(scope: SearchScope) {
    if (scope === "all") {
      activeScopes = new Set(["all"])
    } else if (activeScopes.has(scope)) {
      activeScopes.delete(scope)
      if (activeScopes.size === 0) activeScopes.add("all")
    } else {
      activeScopes.delete("all")
      activeScopes.add(scope)
    }
    const scopeBtns = searchElement.querySelectorAll<HTMLElement>(".scope-btn")
    scopeBtns.forEach((btn) => {
      btn.classList.toggle("active", activeScopes.has((btn.dataset.scope ?? "all") as SearchScope))
    })
  }

  function hideSearch() {
    container.classList.remove("active")
    unlockScroll()
    searchBar.value = "" // clear the input when we dismiss the search
    if (sidebar) sidebar.style.zIndex = ""
    // Restore the full-search page sticky bar
    const fsBar = document.getElementById("fs-sticky-bar")
    if (fsBar) fsBar.style.visibility = ""
    removeAllChildren(results)
    if (preview) {
      removeAllChildren(preview)
    }
    searchLayout.classList.remove("display-results")
    searchType = "basic" // reset search type after closing
    setFilter("all") // reset filter after closing
    setPhraseMode(false) // reset phrase mode after closing
    clearFolderFilter() // reset folder filter after closing
    activeScopes = new Set(["all"])
    const scopeBtns = searchElement.querySelectorAll<HTMLElement>(".scope-btn")
    scopeBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scope === "all")
    })
    stopPlaceholderCycle()
    searchButton.focus()
  }

  // Keyboard hints bar — injected once below the search input wrap
  searchElement.querySelector(".search-kbd-hints") ??
    (() => {
      const el = document.createElement("div")
      el.className = "search-kbd-hints"
      el.innerHTML = `
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>Tab</kbd> next</span>
      <span><kbd>Enter</kbd> open</span>
      <span><kbd>Esc</kbd> close</span>
    `
      // Insert after the input wrap (not searchBar directly, which is now inside the wrap)
      ;(inputWrap ?? searchBar).after(el)
      return el
    })()

  // Backspace on empty input clears the active folder filter
  const backspaceHandler = (e: KeyboardEvent) => {
    if (e.key === "Backspace" && searchBar.value === "" && activeFolderFilter !== null) {
      clearFolderFilter()
      searchBar.dispatchEvent(new Event("input"))
    }
  }
  searchBar.addEventListener("keydown", backspaceHandler)
  window.addCleanup(() => searchBar.removeEventListener("keydown", backspaceHandler))

  // Cycling placeholder hints
  const placeholderHints = [
    // ── Date queries ──────────────────────────────────────────────────────────
    "try: today",
    "try: yesterday",
    "try: last week",
    "try: this week",
    "try: this month",
    "try: last month",
    "try: 3 days ago",
    "try: 10 days ago",
    "try: 2 weeks ago",
    "try: last monday",
    "try: last tuesday",
    "try: last friday",
    "try: march 2026",
    "try: jan 2026",
    "try: feb 2025",
    "try: last year",

    // ── Core topics ───────────────────────────────────────────────────────────
    "try: sin",
    "try: grace",
    "try: covenant",
    "try: faith",
    "try: salvation",
    "try: repentance",
    "try: prayer",
    "try: righteousness",
    "try: baptism",
    "try: resurrection",
    "try: judgment",
    "try: holy spirit",
    "try: atonement",
    "try: prophecy",
    "try: sabbath",
    "try: leaven",
    "try: love",
    "try: obedience",
    "try: truth",
    "try: light",
    "try: darkness",
    "try: law",
    "try: gospel",
    "try: parable",
    "try: miracle",
    "try: healing",
    "try: wisdom",
    "try: knowledge",
    "try: understanding",
    "try: power",
    "try: authority",
    "try: worship",
    "try: fasting",
    "try: humility",
    "try: pride",
    "try: patience",
    "try: endurance",
    "try: peace",
    "try: wrath",
    "try: mercy",
    "try: forgiveness",
    "try: idolatry",
    "try: adultery",
    "try: fornication",
    "try: jealousy",
    "try: sanctification",
    "try: justification",
    "try: glorification",
    "try: election",
    "try: creation",
    "try: redemption",
    "try: incarnation",
    "try: crucifixion",
    "try: ascension",
    "try: tribulation",
    "try: millennium",
    "try: sacrifice",
    "try: offering",
    "try: shepherd",
    "try: fire",
    "try: sword",
    "try: blood",
    "try: flesh",
    "try: spirit",
    "try: bread",
    "try: wine",
    "try: water",
    "try: temple",
    "try: throne",
    "try: crown",
    "try: cross",
    "try: servant",
    "try: angels",
    "try: demons",
    "try: devil",
    "try: eternal life",
    "try: hell",
    "try: heaven",
    "try: kingdom",
    "try: church",
    "try: promise",
    "try: inheritance",
    "try: armor",
    "try: suffering",
    "try: persecution",
    "try: lukewarm",
    "try: lukewarm church",
    "try: false prophet",
    "try: fornication",
    "try: disobedience",

    // ── Scoped queries ─────────────────────────────────────────────────────────
    "try: in:idioms",
    "try: in:capture",
    "try: in:complete",
    "try: in:progress",
    "try: in:idioms covenant",
    "try: in:idioms leaven",
    "try: in:idioms bread",
    "try: in:complete righteousness",
    "try: in:complete faith",
    "try: in:complete sin",
    "try: in:complete covenant",
    "try: in:capture prayer",
    "try: in:progress grace",

    // ── Tag queries ───────────────────────────────────────────────────────────
    "try: #faith",
    "try: #covenant",
    "try: #prophecy",
    "try: #grace",
    "try: #repentance",
    "try: #salvation",
    "try: #holy-spirit",
    "try: #obedience",
    "try: #prayer",
    "try: #sin",

    // ── Boolean & exact phrase ─────────────────────────────────────────────────
    "try: faith AND grace",
    "try: sin AND judgment",
    "try: faith OR works",
    "try: sin NOT lawlessness",
    "try: prayer AND fasting",
    "try: love AND obedience",
    "try: grace NOT works",
    "try: pride NOT humility",
    "try: sin AND death",
    'try: "blood of Christ"',
    'try: "Holy Spirit"',
    'try: "fear of God"',
    'try: "kingdom of God"',
    'try: "kingdom of heaven"',
    'try: "Son of God"',
    'try: "Day of Judgment"',
    'try: "bread of life"',
    'try: "new covenant"',
    'try: "word of God"',
    'try: "true vine"',
    'try: "fruit of the spirit"',
    'try: "Lamb of God"',
    'try: "eternal life"',
    'try: "body of Christ"',
  ]
  // Typing animation state (replaces simple setInterval)
  let typingTimer: ReturnType<typeof setTimeout> | null = null
  let typingChars = ""   // current partial text shown
  let typingTarget = ""  // full hint being typed
  let shuffledHints: string[] = []
  let shuffledIdx = 0
  let isPlaceholderAnimActive = false  // whether the cycle should be running at all
  const defaultPlaceholder = "Search for something"

  function pickNextHint(): string {
    if (shuffledIdx >= shuffledHints.length) {
      // Re-shuffle with Fisher-Yates
      shuffledHints = [...placeholderHints]
      for (let i = shuffledHints.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledHints[i], shuffledHints[j]] = [shuffledHints[j], shuffledHints[i]]
      }
      shuffledIdx = 0
    }
    return shuffledHints[shuffledIdx++]
  }

  // Whether conditions allow the animation to visually update the placeholder
  // Note: we intentionally allow animation even when the bar is focused — the
  // placeholder is visible in an empty focused input, and removing this check
  // is necessary because searchBar.focus() is called immediately on open.
  function animAllowed(): boolean {
    return (
      searchBar.value === "" &&
      activeFolderFilter === null &&
      container.classList.contains("active")
    )
  }

  function typeStep() {
    if (!isPlaceholderAnimActive) return
    if (!animAllowed()) {
      // Bar is focused or user typed — wait and retry; don't kill the animation
      typingTimer = setTimeout(typeStep, 250)
      return
    }
    if (typingChars.length < typingTarget.length) {
      typingChars += typingTarget[typingChars.length]
      searchBar.placeholder = typingChars
      typingTimer = setTimeout(typeStep, 65)
    } else {
      // Done typing — pause, then start deleting
      typingTimer = setTimeout(deleteStep, 2200)
    }
  }

  function deleteStep() {
    if (!isPlaceholderAnimActive) return
    if (!animAllowed()) {
      typingTimer = setTimeout(deleteStep, 250)
      return
    }
    if (typingChars.length > 0) {
      typingChars = typingChars.slice(0, -1)
      searchBar.placeholder = typingChars || "\u00A0" // non-breaking space prevents collapse
      typingTimer = setTimeout(deleteStep, 28)
    } else {
      // Done deleting — short pause, then type next hint
      typingTarget = pickNextHint()
      typingTimer = setTimeout(typeStep, 600)
    }
  }

  function startPlaceholderCycle() {
    if (isPlaceholderAnimActive) return // already running
    isPlaceholderAnimActive = true
    searchBar.placeholder = defaultPlaceholder
    typingChars = ""
    typingTarget = pickNextHint()
    // Initial pause before first hint starts typing
    typingTimer = setTimeout(typeStep, 1800)
  }

  function stopPlaceholderCycle() {
    isPlaceholderAnimActive = false
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    typingChars = ""
    searchBar.placeholder = defaultPlaceholder
  }

  function showRecentSearches() {
    const recent = loadRecentSearches()
    if (recent.length === 0) return
    removeAllChildren(results)
    searchLayout.classList.add("display-results")

    const wrapper = document.createElement("div")
    wrapper.className = "recent-searches"
    const labelRow = document.createElement("div")
    labelRow.className = "recent-label-row"
    const label = document.createElement("p")
    label.className = "recent-label"
    label.textContent = "Recent searches"
    const clearBtn = document.createElement("button")
    clearBtn.className = "recent-clear-btn"
    clearBtn.textContent = "Clear"
    const clearHandler = () => {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
      removeAllChildren(results)
      searchLayout.classList.remove("display-results")
    }
    clearBtn.addEventListener("click", clearHandler)
    window.addCleanup(() => clearBtn.removeEventListener("click", clearHandler))
    labelRow.appendChild(label)
    labelRow.appendChild(clearBtn)
    const chips = document.createElement("div")
    chips.className = "recent-chips"

    for (const term of recent) {
      const chip = document.createElement("button")
      chip.className = "recent-chip"
      chip.textContent = term
      const chipHandler = () => {
        searchBar.value = term
        searchBar.dispatchEvent(new Event("input"))
      }
      chip.addEventListener("click", chipHandler)
      window.addCleanup(() => chip.removeEventListener("click", chipHandler))
      chips.appendChild(chip)
    }

    wrapper.appendChild(labelRow)
    wrapper.appendChild(chips)
    results.appendChild(wrapper)
  }

  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    lockScroll()
    if (sidebar) sidebar.style.zIndex = "1"
    container.classList.add("active")
    // Hide the full-search page sticky bar so it doesn't show through the modal backdrop
    const fsBar = document.getElementById("fs-sticky-bar")
    if (fsBar) fsBar.style.visibility = "hidden"
    searchBar.focus()
    startPlaceholderCycle()
    // Show recent searches if input is empty
    if (searchBar.value === "") {
      showRecentSearches()
    }
  }

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

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
      if (results.contains(document.activeElement) || currentHover !== null) {
        // Use querySelectorAll to skip non-focusable elements (dividers, labels)
        const allCards = [...results.querySelectorAll<HTMLInputElement>(".result-card")]
        const currentResult = currentHover ?? (document.activeElement as HTMLInputElement | null)
        const currentIdx = currentResult ? allCards.indexOf(currentResult) : allCards.length
        const prevResult = allCards[currentIdx - 1] ?? null
        currentResult?.classList.remove("focus")
        prevResult?.focus()
        currentHover = prevResult
        await displayPreview(prevResult)
      }
    } else if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault()
      if (document.activeElement === searchBar || currentHover !== null) {
        // Use querySelectorAll to skip non-focusable elements (dividers, labels)
        const allCards = [...results.querySelectorAll<HTMLInputElement>(".result-card")]
        const currentIdx = currentHover ? allCards.indexOf(currentHover) : -1
        const nextCard = allCards[currentIdx + 1] ?? null
        currentHover?.classList.remove("focus")
        nextCard?.focus()
        currentHover = nextCard
        await displayPreview(nextCard)
      }
    }
  }

  const formatForDisplay = (term: string, id: number, hlPhrases?: string[]) => {
    const slug = idDataMap[id]
    const plainTerm = stripBoolOps(term)
    const doHighlight = (text: string, isTrim?: boolean) =>
      hlPhrases ? highlightPhrase(hlPhrases, text, isTrim) : highlight(plainTerm, text, isTrim)
    return {
      id,
      slug,
      title: searchType === "tags" ? data[slug].title : doHighlight(data[slug].title ?? ""),
      content: doHighlight(data[slug].content ?? "", true),
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
    // Add idiom quick-answer class for individual idiom notes
    if (isIdiomSlug(slug)) {
      itemTile.classList.add("idiom-quick-answer")
      const desc = (window as any).__idiomDescriptions?.[slug] ?? ""
      itemTile.innerHTML = `
        <span class="idiom-badge">Idiom</span>
        <h3 class="card-title">${title}</h3>
        ${desc ? `<p class="idiom-description">${desc}</p>` : ""}
        ${htmlTags}
      `
    } else {
      itemTile.innerHTML = `
        <h3 class="card-title">${title}</h3>
        ${htmlTags}
        <p class="card-description">${content}</p>
      `
    }
    itemTile.id = slug
    itemTile.href = resolveUrl(slug).toString()
    itemTile.addEventListener("click", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      saveRecentSearch(currentSearchTerm)
      hideSearch()
    })

    const handler = (event: MouseEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      saveRecentSearch(currentSearchTerm)
      hideSearch()
    }

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = ev.target as HTMLInputElement
      // Mouse takes over from keyboard — clear any keyboard-set .focus from other cards
      if (currentHover && currentHover !== target) {
        currentHover.classList.remove("focus")
        currentHover = null
      }
      await displayPreview(target)
    }

    itemTile.addEventListener("mouseenter", onMouseEnter)
    window.addCleanup(() => itemTile.removeEventListener("mouseenter", onMouseEnter))
    itemTile.addEventListener("click", handler)
    window.addCleanup(() => itemTile.removeEventListener("click", handler))

    return itemTile
  }

  // ─── Boolean evaluator (uses module-level index + local idDataMap) ───────────

  async function evalBoolNode(node: BoolQueryNode, fields: string[]): Promise<Set<number>> {
    if (node.type === "term") {
      if (!node.value) return new Set()
      const res = await index.searchAsync({ query: node.value, limit: 500, index: fields })
      const ids = new Set<number>()
      for (const r of res) for (const id of r.result) ids.add(id as number)
      return ids
    }
    if (node.type === "and") {
      return boolSetIntersection(
        await evalBoolNode(node.left, fields),
        await evalBoolNode(node.right, fields),
      )
    }
    if (node.type === "or") {
      return boolSetUnion(
        await evalBoolNode(node.left, fields),
        await evalBoolNode(node.right, fields),
      )
    }
    if (node.type === "not") {
      const all = new Set(idDataMap.map((_, i) => i))
      const sub = await evalBoolNode(node.operand, fields)
      return boolSetDifference(all, sub)
    }
    return new Set()
  }

  // ─── Smart suggestions (shown when 0 results for multi-word plain query) ─────

  async function showSmartSuggestions(query: string, fields: string[]) {
    const words = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "in",
      "of",
      "to",
      "for",
      "and",
      "or",
      "but",
      "is",
      "it",
    ])
    const seen = new Set<string>()
    const groups: { label: string; items: Item[] }[] = []

    async function fetchGroup(term: string): Promise<Item[]> {
      const res = await index.searchAsync({ query: term, limit: numSearchResults, index: fields })
      const ids = new Set<number>()
      for (const r of res) for (const id of r.result) ids.add(id as number)
      return [...ids]
        .filter((id) => idDataMap[id] !== "Search")
        .slice(0, 4)
        .map((id) => formatForDisplay(term, id))
    }

    // Adjacent word pairs
    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i + 1]}`
      if (seen.has(pair)) continue
      seen.add(pair)
      const items = await fetchGroup(pair)
      if (items.length > 0) groups.push({ label: `"${pair}"`, items })
    }

    // Individual words
    for (const word of words) {
      if (stopwords.has(word.toLowerCase()) || seen.has(word)) continue
      seen.add(word)
      const items = (await fetchGroup(word)).slice(0, 3)
      if (items.length > 0) groups.push({ label: `"${word}"`, items })
    }

    if (groups.length === 0) return

    const section = document.createElement("div")
    section.className = "search-similar"

    const heading = document.createElement("p")
    heading.className = "search-similar-label"
    heading.textContent = "💡 Similar results"
    section.appendChild(heading)

    for (const group of groups.slice(0, 3)) {
      const groupEl = document.createElement("div")
      groupEl.className = "search-similar-group"

      const groupLabel = document.createElement("p")
      groupLabel.className = "search-similar-group-label"
      groupLabel.textContent = `Results for ${group.label}`
      groupEl.appendChild(groupLabel)

      for (const item of group.items) {
        groupEl.appendChild(resultToHTML(item))
      }
      section.appendChild(groupEl)
    }
    results.appendChild(section)
  }

  function buildFolderFilterCards(query: string): HTMLElement[] {
    const folderIndex: Array<{ path: string; label: string }> = (window as any).__folderIndex ?? []
    if (!folderIndex.length) return []

    const q = query.toLowerCase().trim()
    let matches: Array<{ path: string; label: string; displayLabel: string }>

    if (activeFolderFilter !== null) {
      // When a filter is active: show direct child sub-folders of the current filter.
      // Show all children when no query, or filter by query when one is entered.
      const prefix = activeFolderFilter + "/"
      matches = folderIndex
        .filter((f) => {
          if (!f.path.startsWith(prefix)) return false
          // Only direct children — no deeper nesting
          const rest = f.path.slice(prefix.length)
          if (rest.includes("/")) return false
          if (q) {
            return f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
          }
          return true
        })
        .slice(0, 6)
        .map((f) => ({
          ...f,
          // Show just the child segment name (last part) for clarity
          displayLabel: f.label.split(" > ").pop() ?? f.label,
        }))
    } else {
      // No active filter: show top-level folder matches when query is long enough
      if (!q || q.length < 2) return []
      matches = folderIndex
        .filter((f) => f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
        .slice(0, 3)
        .map((f) => ({ ...f, displayLabel: f.label }))
    }

    if (matches.length === 0) return []

    const elements: HTMLElement[] = []

    const sectionLabel = document.createElement("p")
    sectionLabel.className = "folder-filter-section-label"
    sectionLabel.textContent = activeFolderFilter ? "Narrow to subfolder" : "Filter by folder"
    elements.push(sectionLabel)

    for (const folder of matches) {
      const card = document.createElement("button")
      card.type = "button"
      card.className = "result-card folder-filter-card"
      card.innerHTML = `<span class="folder-filter-icon">📁</span><span class="folder-filter-name">${folder.displayLabel}</span>`
      const handler = () => {
        setFolderFilter(folder.path, folder.label)
        searchBar.value = ""
        currentSearchTerm = ""
        searchBar.dispatchEvent(new Event("input"))
        searchBar.focus()
      }
      card.addEventListener("click", handler)
      window.addCleanup(() => card.removeEventListener("click", handler))
      elements.push(card)
    }

    const divider = document.createElement("div")
    divider.className = "folder-filter-divider"
    divider.setAttribute("aria-hidden", "true")
    elements.push(divider)

    return elements
  }

  async function displayResults(finalResults: Item[], totalCount?: number, dateLabel?: string) {
    removeAllChildren(results)

    // Folder filter suggestions: always shown when filter is active (for sub-folder drilling),
    // or when query is long enough for top-level folder matches
    if (activeFolderFilter !== null || currentSearchTerm.trim().length >= 2) {
      const folderElements = buildFolderFilterCards(currentSearchTerm)
      folderElements.forEach((el) => results.appendChild(el))
    }

    // "See all results" banner at the TOP so it's always visible without scrolling
    if (totalCount !== undefined && totalCount > finalResults.length) {
      const seeAll = document.createElement("a")
      seeAll.className = "see-all-results"
      const searchUrl = resolveUrl("Search" as FullSlug)
      searchUrl.searchParams.set("q", currentSearchTerm)
      seeAll.href = searchUrl.toString()
      seeAll.innerHTML = `<p>See all ${totalCount} results →</p>`
      seeAll.addEventListener("click", hideSearch)
      window.addCleanup(() => seeAll.removeEventListener("click", hideSearch))
      results.append(seeAll)
    }

    if (dateLabel) {
      const label = document.createElement("p")
      label.className = "date-search-label"
      label.textContent = `📅 ${dateLabel}`
      results.append(label)
    }

    if (finalResults.length === 0) {
      const noMatch = document.createElement("div")
      noMatch.className = "result-card no-match"
      noMatch.innerHTML = `<h3>No results.</h3><p>Try another search term?</p>`
      results.append(noMatch)
    } else {
      // Idiom results bubble to top as "Quick Answer" cards
      const sortedResults = [
        ...finalResults.filter((r) => isIdiomSlug(r.slug)),
        ...finalResults.filter((r) => !isIdiomSlug(r.slug)),
      ]
      results.append(...sortedResults.map(resultToHTML))
    }

    // "Did you mean" — fires when results are sparse (0–2) using edit-distance + phonetic matching
    const term = currentSearchTerm.trim()
    if (term.length >= 3 && finalResults.length <= 2) {
      const suggestion = findFuzzySuggestion(term)
      if (suggestion && suggestion !== term.toLowerCase()) {
        const didYouMean = document.createElement("div")
        didYouMean.className = "did-you-mean" // no "result-card" — prevents keyboard nav from picking it up
        didYouMean.innerHTML = `<p>Did you mean: <a class="dym-link" href="#" data-router-ignore>${suggestion}</a>?</p>`
        const link = didYouMean.querySelector(".dym-link") as HTMLElement
        const dymHandler = (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
          searchBar.value = suggestion
          searchBar.dispatchEvent(new Event("input"))
          searchBar.focus()
        }
        link.addEventListener("click", dymHandler)
        window.addCleanup(() => link.removeEventListener("click", dymHandler))
        results.append(didYouMean)

        // Fetch and render fuzzy results for the suggestion below the DYM banner
        const fuzzyRaw = await index.searchAsync({
          query: suggestion,
          limit: 4,
          index: ["title", "content"],
        })
        const fuzzyIds: Set<number> = new Set([
          ...((fuzzyRaw.find((x) => x.field === "title")?.result ?? []) as number[]),
          ...((fuzzyRaw.find((x) => x.field === "content")?.result ?? []) as number[]),
        ])
        const fuzzyIdsList = [...fuzzyIds].filter((id) => idDataMap[id] !== "Search")
        if (fuzzyIdsList.length > 0) {
          const fuzzyLabel = document.createElement("p")
          fuzzyLabel.className = "fuzzy-results-label"
          fuzzyLabel.textContent = "Similar results:"
          results.append(fuzzyLabel)
          for (const id of fuzzyIdsList) {
            const item = formatForDisplay(suggestion, id)
            const card = resultToHTML(item)
            card.classList.add("fuzzy-result-card")
            results.append(card)
          }
        }
      }
    }

    if (finalResults.length === 0) {
      if (preview) removeAllChildren(preview)
      // Show smart suggestions for plain multi-word queries
      const term = currentSearchTerm.trim()
      const words = term.split(/\s+/).filter(Boolean)
      if (words.length >= 2 && !queryHasBooleanOps(term) && !term.includes('"')) {
        const filterFields =
          searchFilter === "title"
            ? ["title"]
            : searchFilter === "content"
              ? ["content"]
              : searchFilter === "tags"
                ? ["tags"]
                : ["title", "content"]
        await showSmartSuggestions(term, filterFields)
      }
    } else {
      // focus on first result-card (skip non-result elements at top)
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

  // Apply the same h2→collapsible-card transformation the idiom page JS does,
  // so the preview panel looks like the actual idiom page.
  function applyIdiomPreviewStyle(container: HTMLElement) {
    container.querySelector("h1")?.remove()
    const h2s = Array.from(container.querySelectorAll("h2"))
    h2s.forEach((h2) => {
      const title = h2.textContent?.trim() ?? ""
      const body = document.createElement("div")
      body.className = "idiom-section-card-body"
      let node = h2.nextSibling
      while (node && !(node.nodeType === 1 && (node as Element).tagName === "H2")) {
        const next = node.nextSibling
        body.appendChild(node)
        node = next
      }
      const card = document.createElement("div")
      card.className = "idiom-section-card"
      card.innerHTML = `<div class="idiom-section-card-heading" style="cursor:default"><span class="idiom-section-card-title">${title}</span></div>`
      card.appendChild(body)
      h2.parentNode?.insertBefore(card, h2)
      h2.remove()
    })
    // Hide empty Strong's / related-idioms cards (the auto-injected ones below replace them)
    Array.from(container.querySelectorAll(".idiom-section-card")).forEach((card) => {
      const t = card.querySelector(".idiom-section-card-title")?.textContent?.trim().toLowerCase() ?? ""
      if (!t.includes("strong") && t !== "related idioms") return
      const body = card.querySelector(".idiom-section-card-body")?.textContent?.trim() ?? ""
      if (!body || body.toLowerCase() === "n/a" || body.toLowerCase() === "none") card.remove()
    })

    // Auto-inject Related Verses + Related Idioms from frontmatter data (mirroring afterDOMLoaded)
    const dataEl = container.querySelector(".idiom-auto-sections") as HTMLElement | null
    if (!dataEl) return
    const SEP = "\x1f"
    const KV = "\x1e"
    const versesRaw = dataEl.dataset.relatedVerses ?? ""
    const idiomsRaw = dataEl.dataset.relatedIdioms ?? ""

    function makePreviewCard(title: string, chipsEl: HTMLElement): HTMLElement {
      const card = document.createElement("div")
      card.className = "idiom-section-card"
      card.innerHTML = `<div class="idiom-section-card-heading" style="cursor:default"><span class="idiom-section-card-title">${title}</span></div>`
      const body = document.createElement("div")
      body.className = "idiom-section-card-body"
      body.appendChild(chipsEl)
      card.appendChild(body)
      return card
    }

    if (versesRaw) {
      const verses = versesRaw.split(SEP).filter(Boolean)
      if (verses.length > 0) {
        const chips = document.createElement("div")
        chips.className = "idiom-flashcard-chips"
        verses.forEach((v) => {
          const span = document.createElement("span")
          span.className = "idiom-chip idiom-chip-verse"
          span.textContent = v
          chips.appendChild(span)
        })
        container.appendChild(makePreviewCard("Related Verses", chips))
      }
    }

    if (idiomsRaw) {
      const items = idiomsRaw.split(SEP).filter(Boolean)
      if (items.length > 0) {
        const chips = document.createElement("div")
        chips.className = "idiom-flashcard-chips"
        items.forEach((item) => {
          const parts = item.split(KV)
          const name = parts[0]
          const span = document.createElement("span")
          span.className = "idiom-chip idiom-chip-related"
          span.textContent = name
          chips.appendChild(span)
        })
        container.appendChild(makePreviewCard("Related Idioms", chips))
      }
    }
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!searchLayout || !enablePreview || !el || !preview) return
    // Folder filter cards don't have a slug — skip preview for them
    if (el.classList.contains("folder-filter-card")) return
    const slug = el.id as FullSlug
    const { phrases: quotedPhrases, searchTerm: effectiveTermPreview } =
      extractPhrases(currentSearchTerm)
    const prevPhrases =
      quotedPhrases.length > 0
        ? quotedPhrases
        : phraseMode
          ? [effectiveTermPreview || currentSearchTerm]
          : []
    const innerDiv = await fetchContent(slug).then((contents) =>
      contents.flatMap((el) =>
        prevPhrases.length > 0
          ? [...highlightHTMLPhrase(prevPhrases, el as HTMLElement).children]
          : [...highlightHTML(stripBoolOps(currentSearchTerm), el as HTMLElement).children],
      ),
    )
    previewInner = document.createElement("div")
    previewInner.classList.add("preview-inner")
    previewInner.append(...innerDiv)
    if (isIdiomSlug(slug)) applyIdiomPreviewStyle(previewInner)

    // If this is a rebuke page, wrap content in article.rebuke and build the tab UI
    if (slug.startsWith("Copy-Paste-Rebukes/") && (window as any).__initRebukePanel) {
      const article = document.createElement("article")
      article.className = "rebuke"
      while (previewInner.firstChild) article.appendChild(previewInner.firstChild)
      const tabRoot = document.createElement("div")
      previewInner.appendChild(tabRoot)
      previewInner.appendChild(article)
      ;(window as any).__initRebukePanel(article, tabRoot)
    }

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

    // Parse `in:scope` prefix from query and activate that scope pill
    const inMatch = currentSearchTerm.match(/(?:^|\s)in:(\w+)/i)
    if (inMatch) {
      const scopeAlias = inMatch[1].toLowerCase()
      const scopeMap: Record<string, SearchScope> = {
        idioms: "idioms",
        idiom: "idioms",
        capture: "capture",
        progress: "progress",
        "in-progress": "progress",
        complete: "complete",
        completed: "complete",
      }
      const detectedScope = scopeMap[scopeAlias]
      if (detectedScope) {
        activeScopes = new Set([detectedScope])
        const scopeBtns = searchElement.querySelectorAll<HTMLElement>(".scope-btn")
        scopeBtns.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.scope === detectedScope)
        })
      }
      // Strip the in: prefix from the actual search term
      currentSearchTerm = currentSearchTerm.replace(/(?:^|\s)in:\w+/i, "").trim()
      ;(e.target as HTMLInputElement).dataset.scopeStripped = "1"
    }

    if (currentSearchTerm === "") {
      if (activeFolderFilter !== null) {
        // Folder filter active + empty query: show all notes in the folder
        // (sub-folder chips appear at the top via displayResults → buildFolderFilterCards)
        searchLayout.classList.add("display-results")
        const folderItems: Item[] = idDataMap
          .map((slug, i) => ({ slug, i }))
          .filter(({ slug }) => slug !== "Search" && matchesScope(slug))
          .map(({ slug, i }) => ({
            id: i,
            slug: slug as FullSlug,
            title: data[slug].title ?? slug,
            content: "",
            tags: [],
          }))
        await displayResults(folderItems)
      } else {
        searchLayout.classList.remove("display-results")
        showRecentSearches()
      }
      return
    }
    searchLayout.classList.add("display-results")
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
              return (inRange(fileDate) || inRange(slugDate)) && slug !== "Search" && matchesScope(slug)
            })
            .sort(([, a], [, b]) => {
              const aTs = new Date((a.date ?? 0) as string | number).getTime()
              const bTs = new Date((b.date ?? 0) as string | number).getTime()
              return bTs - aTs
            })
          const totalCount = dateResults.length
          const displayItems: Item[] = dateResults
            .slice(0, numSearchResults)
            .map(([slug, fileData]) => {
              const id = idDataMap.indexOf(slug as FullSlug)
              const dateStr = fileData.date
                ? new Date(fileData.date as string).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : ""
              return {
                id,
                slug: slug as FullSlug,
                title: fileData.title ?? slug,
                content: dateStr ? `Modified: ${dateStr}` : "",
                tags: [],
              }
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
      // Determine which index fields to search based on active filter
      const filterFields: string[] =
        searchFilter === "title"
          ? ["title"]
          : searchFilter === "content"
            ? ["content"]
            : searchFilter === "tags"
              ? ["tags"]
              : ["title", "content"] // "all"

      // Extract quoted phrases and get the effective search term (quotes stripped)
      const { phrases: quotedPhrases, searchTerm: effectiveTerm } =
        extractPhrases(currentSearchTerm)
      const hasQuotes = quotedPhrases.length > 0
      // If quote auto-detected, turn off manual phrase mode (redundant)
      if (hasQuotes && phraseMode) setPhraseMode(false)
      // Combine: quoted phrases take priority; otherwise manual phraseMode adds the whole term as a phrase
      const phrases = hasQuotes
        ? quotedPhrases
        : phraseMode
          ? [effectiveTerm || currentSearchTerm]
          : []
      const termForSearch = effectiveTerm || currentSearchTerm

      // Boolean query path (only when no quoted phrases)
      if (!hasQuotes && queryHasBooleanOps(termForSearch) && searchFilter !== "tags") {
        try {
          const ast = parseBoolQuery(termForSearch)
          const ids = await evalBoolNode(ast, filterFields)
          const allIdsList = [...ids]
            .filter((id) => idDataMap[id] !== "Search")
            .filter((id) => matchesScope(idDataMap[id]))
          const finalResults = allIdsList
            .slice(0, numSearchResults)
            .map((id) => formatForDisplay(termForSearch, id))
          await displayResults(finalResults, allIdsList.length)
          return
        } catch {
          // fall through to plain search on parse error
        }
      }

      // Bible book expansion (on the effective term, not including quoted phrases)
      const expandedTerm = !hasQuotes ? expandBibleBook(termForSearch) : null
      if (expandedTerm && searchFilter !== "tags") {
        const [r1, r2] = await Promise.all([
          index.searchAsync({ query: termForSearch, limit: 500, index: filterFields }),
          index.searchAsync({ query: expandedTerm, limit: 500, index: filterFields }),
        ])
        const mergeField = (field: string): number[] => {
          const a = (r1.find((x) => x.field === field)?.result ?? []) as number[]
          const b = (r2.find((x) => x.field === field)?.result ?? []) as number[]
          return [...new Set([...a, ...b])]
        }
        const allIds = new Set(filterFields.flatMap((f) => mergeField(f)))
        let allIdsList = [...allIds]
          .filter((id) => idDataMap[id] !== "Search")
          .filter((id) => matchesScope(idDataMap[id]))
        // Apply phrase filter if quotes or phrase mode active
        if (phrases.length > 0) {
          allIdsList = allIdsList.filter((id) => {
            const fd = data[idDataMap[id]]
            return phrases.every(
              (p) => fd?.content?.toLowerCase().includes(p) || fd?.title?.toLowerCase().includes(p),
            )
          })
        }
        const finalResults = allIdsList
          .slice(0, numSearchResults)
          .map((id) =>
            formatForDisplay(termForSearch, id, phrases.length > 0 ? phrases : undefined),
          )
        await displayResults(finalResults, allIdsList.length)
        return
      }

      // Plain search using the effective term (quotes stripped)
      searchResults = await index.searchAsync({
        query: termForSearch,
        limit: 500,
        index: filterFields,
      })

      const getByField2 = (field: string): number[] => {
        const r = searchResults.filter((x) => x.field === field)
        return r.length === 0 ? [] : ([...r[0].result] as number[])
      }
      const allIds2: Set<number> = new Set([
        ...(searchFilter !== "content" && searchFilter !== "tags" ? getByField2("title") : []),
        ...(searchFilter !== "title" && searchFilter !== "tags" ? getByField2("content") : []),
      ])
      let allIdsList2 = [...allIds2]
        .filter((id) => idDataMap[id] !== "Search")
        .filter((id) => matchesScope(idDataMap[id]))
      // Apply phrase filter for quoted phrases or phrase mode
      if (phrases.length > 0) {
        allIdsList2 = allIdsList2.filter((id) => {
          const fd = data[idDataMap[id]]
          return phrases.every(
            (p) => fd?.content?.toLowerCase().includes(p) || fd?.title?.toLowerCase().includes(p),
          )
        })
      }
      const finalResults2 = allIdsList2
        .slice(0, numSearchResults)
        .map((id) => formatForDisplay(termForSearch, id, phrases.length > 0 ? phrases : undefined))
      await displayResults(finalResults2, allIdsList2.length)
      return
    }

    const getByField = (field: string): number[] => {
      const results = searchResults.filter((x) => x.field === field)
      return results.length === 0 ? [] : ([...results[0].result] as number[])
    }

    // order titles ahead of content (respect active filter) — for tags search path
    const allIds: Set<number> = new Set([
      ...(searchType !== "tags" && searchFilter !== "content" && searchFilter !== "tags"
        ? getByField("title")
        : []),
      ...(searchType !== "tags" && searchFilter !== "title" && searchFilter !== "tags"
        ? getByField("content")
        : []),
      ...(searchType === "tags" || searchFilter === "tags" ? getByField("tags") : []),
    ])
    const allIdsList = [...allIds]
      .filter((id) => idDataMap[id] !== "Search")
      .filter((id) => matchesScope(idDataMap[id]))
    const totalCount = allIdsList.length
    const finalResults = allIdsList
      .slice(0, numSearchResults)
      .map((id) => formatForDisplay(currentSearchTerm, id))
    await displayResults(finalResults, totalCount)
  }

  function onSearchFocus() {
    // Reset the visible placeholder — cancel any in-flight timer first so a pending
    // typeStep/deleteStep can't fire immediately after and override the reset,
    // causing a visible flicker between the partial hint and "Search for something".
    if (isPlaceholderAnimActive) {
      if (typingTimer) { clearTimeout(typingTimer); typingTimer = null }
      typingChars = ""
      typingTarget = pickNextHint()
      searchBar.placeholder = defaultPlaceholder
      // Restart the cycle cleanly after the initial pause
      typingTimer = setTimeout(typeStep, 1800)
    }
    // If input is cleared, show recent searches — but not when a folder filter is active
    // (folder filter focus fires from searchBar.focus() after selecting a folder chip,
    //  and would wipe the folder results that displayResults just rendered)
    if (searchBar.value === "" && activeFolderFilter === null) {
      showRecentSearches()
    }
  }

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => document.removeEventListener("keydown", shortcutHandler))
  searchButton.addEventListener("click", () => showSearch("basic"))
  window.addCleanup(() => searchButton.removeEventListener("click", () => showSearch("basic")))
  searchBar.addEventListener("input", onType)
  window.addCleanup(() => searchBar.removeEventListener("input", onType))
  searchBar.addEventListener("focus", onSearchFocus)
  window.addCleanup(() => searchBar.removeEventListener("focus", onSearchFocus))

  registerEscapeHandler(container, hideSearch)

  // Filter button click handlers
  const filterBtns = searchElement.querySelectorAll(".filter-btn")
  filterBtns.forEach((btn) => {
    const filterHandler = () => {
      const filter = (btn as HTMLElement).dataset.filter as SearchFilter
      setFilter(filter)
      // Re-run search with new filter if there's a query
      if (searchBar.value.trim()) {
        searchBar.dispatchEvent(new Event("input"))
      }
    }
    btn.addEventListener("click", filterHandler)
    window.addCleanup(() => btn.removeEventListener("click", filterHandler))
  })

  // Phrase button click handler
  if (phraseBtnEl) {
    const phraseHandler = () => {
      setPhraseMode(!phraseMode)
      if (searchBar.value.trim()) {
        searchBar.dispatchEvent(new Event("input"))
      }
    }
    phraseBtnEl.addEventListener("click", phraseHandler)
    window.addCleanup(() => phraseBtnEl.removeEventListener("click", phraseHandler))
  }

  // Scope button click handlers
  const scopeBtns = searchElement.querySelectorAll(".scope-btn")
  scopeBtns.forEach((btn) => {
    const scopeHandler = () => {
      const scope = (btn as HTMLElement).dataset.scope as SearchScope
      toggleScope(scope)
      if (searchBar.value.trim()) {
        searchBar.dispatchEvent(new Event("input"))
      }
    }
    btn.addEventListener("click", scopeHandler)
    window.addCleanup(() => btn.removeEventListener("click", scopeHandler))
  })

  // Set platform-aware shortcut hint on search button
  const openHint = searchElement.querySelector(".search-open-hint") as HTMLElement | null
  if (openHint) {
    openHint.textContent = isMac ? "⌘K" : "Ctrl+K"
  }

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
  // Pre-build idiom description lookup for quick-answer cards
  ;(window as any).__idiomDescriptions = (window as any).__idiomDescriptions ?? {}
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
    // Build word dictionary from titles for fuzzy "did you mean"
    const text = (fileData.title ?? "") + " " + (fileData.content ?? "")
    for (const raw of text.split(/\s+/)) {
      const word = raw.toLowerCase().replace(/[^a-z]/g, "")
      if (word.length >= 4) wordDictionary.add(word)
    }
    // Cache idiom descriptions for quick-answer display
    if (isIdiomSlug(slug) && fileData.description) {
      ;(window as any).__idiomDescriptions[slug] = fileData.description
    }
  }

  await Promise.all(promises)
  indexPopulated = true

  // Build folder index from all slug paths (run once)
  if (!(window as any).__folderIndex) {
    const folderPaths = new Set<string>()
    for (const slug of Object.keys(data)) {
      const parts = slug.split("/")
      for (let i = 1; i < parts.length; i++) {
        folderPaths.add(parts.slice(0, i).join("/"))
      }
    }
    ;(window as any).__folderIndex = [...folderPaths].map((path) => ({
      path,
      label: friendlyFolderLabel(path),
    }))
  }
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  const searchElement = document.getElementsByClassName("search")
  for (const element of searchElement) {
    await setupSearch(element, currentSlug, data)
  }

  // Scroll-driven header shrink: sets --header-shrink (0→1) on :root
  // CSS uses this to linearly animate search bar height, text opacity, and icon scale
  let rafScheduled = false
  const onHeaderScroll = () => {
    if (!rafScheduled) {
      rafScheduled = true
      requestAnimationFrame(() => {
        const ratio = Math.min(Math.max((window.scrollY - 30) / 150, 0), 1)
        document.documentElement.style.setProperty("--header-shrink", ratio.toFixed(4))
        rafScheduled = false
      })
    }
  }
  window.addEventListener("scroll", onHeaderScroll, { passive: true })
  window.addCleanup(() => {
    window.removeEventListener("scroll", onHeaderScroll)
    document.documentElement.style.removeProperty("--header-shrink")
  })
  onHeaderScroll() // initialize on page load
})
