// Pipeline Dashboard — client-side logic
// Uses contentIndex.json for all data

interface ContentEntry {
  slug: string
  filePath: string
  title: string
  links: string[]
  tags: string[]
  content: string
  date?: string
  description?: string
}

type ContentIndex = Record<string, ContentEntry>

interface StageInfo {
  key: string
  label: string
  color: string
  prefix: string
}

const stages: StageInfo[] = [
  { key: "capture", label: "Capture", color: "#8b8b8b", prefix: "00" },
  { key: "in-progress", label: "In Progress", color: "#f59e0b", prefix: "10" },
  { key: "complete", label: "Complete", color: "#22c55e", prefix: "20" },
  { key: "rebukes", label: "Rebukes", color: "#ef4444", prefix: "Copy-Paste-Rebukes" },
]

function classifyEntry(slug: string): string {
  if (slug.startsWith("Daily/")) return "daily"
  if (slug.startsWith("Copy-Paste-Rebukes/")) return "rebukes"
  if (slug.startsWith("00")) return "capture"
  if (slug.startsWith("10")) return "in-progress"
  if (slug.startsWith("20")) return "complete"
  return "other"
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ── Heatmap state ──
interface DayStat {
  created: number
  modified: number
  total: number
  hasDaily: boolean
  entries: ContentEntry[]
}

let _dayStats: Record<string, DayStat> = {}
let _allEntries: ContentEntry[] = []
let _maxCount = 1
let _renderedMonthMin: Date | null = null // earliest rendered month start
let _renderedMonthMax: Date | null = null // latest rendered month start
const CELL_SIZE = 13
const GAP = 3
const MAX_MONTHS = 36 // cap at ~3 years of rendered months

function init() {
  const container = document.querySelector(".pipeline-dashboard") as HTMLElement | null
  if (!container) return
  loadData()
}

async function loadData() {
  let data: ContentIndex
  try {
    const res = await fetch("/static/contentIndex.json")
    data = await res.json()
  } catch {
    return
  }

  const entries = Object.values(data)

  const stageCounts: Record<string, number> = {}
  const stageEntries: Record<string, ContentEntry[]> = {}
  for (const stage of stages) {
    stageCounts[stage.key] = 0
    stageEntries[stage.key] = []
  }
  stageCounts["daily"] = 0

  for (const entry of entries) {
    const cat = classifyEntry(entry.slug)
    if (stageCounts[cat] !== undefined) {
      stageCounts[cat]++
      if (stageEntries[cat]) stageEntries[cat].push(entry)
    }
  }

  const total = stages.reduce((sum, s) => sum + (stageCounts[s.key] ?? 0), 0)

  // --- Stats cards ---
  const statsEl = document.getElementById("pd-stats")
  if (statsEl) {
    statsEl.innerHTML = stages.map((s, i) => {
      const count = stageCounts[s.key] ?? 0
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      return `<div class="pd-stat-card" style="--accent:${s.color};animation-delay:${i * 60}ms" data-tooltip="${count} notes in ${s.label} (${pct}% of total)">
        <div class="pd-stat-count">${count}</div>
        <div class="pd-stat-label">${s.label}</div>
        <div class="pd-stat-pct">${pct}%</div>
      </div>`
    }).join("")
  }

  // --- Pipeline bar ---
  const pipelineEl = document.getElementById("pd-pipeline")
  if (pipelineEl && total > 0) {
    pipelineEl.innerHTML = stages.map((s) => {
      const count = stageCounts[s.key] ?? 0
      const pct = (count / total) * 100
      if (pct < 1) return ""
      return `<div class="pd-pipe-seg" style="width:${pct}%;background:${s.color}" data-tooltip="${s.label}: ${count} notes (${Math.round(pct)}%)" data-stage="${s.key}"></div>`
    }).join("")

    pipelineEl.addEventListener("click", (e) => {
      const seg = (e.target as HTMLElement).closest(".pd-pipe-seg") as HTMLElement | null
      if (!seg) return
      seg.style.opacity = "0.7"
      setTimeout(() => seg.style.opacity = "", 300)
    })
  }

  // --- Study stats ---
  renderStudyStats(entries)
  renderRecentlyModified(entries)
  renderStaleStudies(stageEntries["in-progress"] ?? [])
}

function renderStudyStats(entries: ContentEntry[]) {
  const dailyDates = new Set<string>()
  for (const entry of entries) {
    const m = entry.slug.match(/^Daily\/(\d{4}-\d{2}-\d{2})$/)
    if (m) dailyDates.add(m[1])
  }

  // Current streak
  let currentStreak = 0
  const today = new Date()
  const d = new Date(today)
  while (true) {
    const key = d.toISOString().slice(0, 10)
    if (dailyDates.has(key)) {
      currentStreak++
      d.setDate(d.getDate() - 1)
    } else if (currentStreak === 0) {
      d.setDate(d.getDate() - 1)
      const yKey = d.toISOString().slice(0, 10)
      if (dailyDates.has(yKey)) {
        currentStreak++
        d.setDate(d.getDate() - 1)
      } else break
    } else break
  }

  // Longest streak
  const sortedDates = [...dailyDates].sort()
  let longestStreak = 0
  let run = 0
  let prevDate: Date | null = null
  for (const ds of sortedDates) {
    const cur = new Date(ds + "T00:00:00")
    if (prevDate && cur.getTime() - prevDate.getTime() === 86400000) {
      run++
    } else {
      run = 1
    }
    longestStreak = Math.max(longestStreak, run)
    prevDate = cur
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let thisWeek = 0
  let thisMonth = 0
  for (const entry of entries) {
    if (!entry.date) continue
    const eDate = new Date(entry.date)
    if (eDate >= weekStart) thisWeek++
    if (eDate >= monthStart) thisMonth++
  }

  const streakRow = document.getElementById("pd-streak-row")
  if (streakRow) {
    streakRow.innerHTML = `
      <div class="pd-streak-item" data-tooltip="Consecutive days with a daily note">
        <div class="pd-streak-num">${currentStreak}</div>
        <div class="pd-streak-label">Current streak</div>
      </div>
      <div class="pd-streak-item" data-tooltip="Your all-time record streak">
        <div class="pd-streak-num">${longestStreak}</div>
        <div class="pd-streak-label">Longest streak</div>
      </div>
      <div class="pd-streak-item" data-tooltip="Notes modified this week">
        <div class="pd-streak-num">${thisWeek}</div>
        <div class="pd-streak-label">This week</div>
      </div>
      <div class="pd-streak-item" data-tooltip="Notes modified this month">
        <div class="pd-streak-num">${thisMonth}</div>
        <div class="pd-streak-label">This month</div>
      </div>
    `
  }

  renderHeatmap(dailyDates, entries)
}

function buildDayStats(dailyDates: Set<string>, allEntries: ContentEntry[]) {
  _allEntries = allEntries
  _dayStats = {}

  function getOrCreate(dateKey: string): DayStat {
    if (!_dayStats[dateKey]) {
      _dayStats[dateKey] = { created: 0, modified: 0, total: 0, hasDaily: false, entries: [] }
    }
    return _dayStats[dateKey]
  }

  for (const entry of allEntries) {
    const dailyMatch = entry.slug.match(/^Daily\/(\d{4}-\d{2}-\d{2})$/)

    if (dailyMatch) {
      // Always register daily notes on their filename date (not mod date)
      const dailyDateKey = dailyMatch[1]
      const dailyStat = getOrCreate(dailyDateKey)
      if (!dailyStat.entries.some(e => e.slug === entry.slug)) {
        dailyStat.entries.push(entry)
      }
      dailyStat.hasDaily = true
      dailyStat.created++
      dailyStat.total++
    }

    // Also register on modification date (for non-daily notes, or daily notes modified on a different day)
    if (entry.date) {
      const modDateKey = new Date(entry.date).toISOString().slice(0, 10)
      if (!dailyMatch || modDateKey !== dailyMatch[1]) {
        const stat = getOrCreate(modDateKey)
        if (!stat.entries.some(e => e.slug === entry.slug)) {
          stat.entries.push(entry)
        }
        stat.modified++
        stat.total++
      }
    }
  }

  for (const dateStr of dailyDates) {
    const stat = getOrCreate(dateStr)
    stat.hasDaily = true
  }

  _maxCount = Math.max(1, ...Object.values(_dayStats).map((s) => s.total))
}

function renderHeatmap(dailyDates: Set<string>, allEntries: ContentEntry[]) {
  const daysEl = document.getElementById("pd-heatmap-days")
  const gridEl = document.getElementById("pd-heatmap-grid")
  const monthsEl = document.getElementById("pd-heatmap-months")
  const scrollEl = document.getElementById("pd-heatmap")
  if (!daysEl || !gridEl || !monthsEl || !scrollEl) return

  buildDayStats(dailyDates, allEntries)

  // Render day labels
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  daysEl.innerHTML = dayNames.map((name) =>
    `<div class="pd-heatmap-day-label" style="height:${CELL_SIZE}px;line-height:${CELL_SIZE}px">${name}</div>`
  ).join("")
  daysEl.style.gap = `${GAP}px`

  // Clear grid
  gridEl.innerHTML = ""
  gridEl.style.gap = `${GAP}px`
  monthsEl.innerHTML = ""

  // Render ~8 months centered on today
  const today = new Date()
  const startMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1)
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 2, 1)

  _renderedMonthMin = new Date(startMonth)
  _renderedMonthMax = new Date(endMonth)

  // Render months from start to end
  let cursor = new Date(startMonth)
  while (cursor <= endMonth) {
    appendMonth(cursor, gridEl, monthsEl)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  // Scroll to today (instant on first load, then smooth)
  requestAnimationFrame(() => {
    const offset = getTodayCellOffset(gridEl, scrollEl)
    if (offset >= 0) {
      scrollEl.scrollLeft = offset - scrollEl.clientWidth / 2
    } else {
      scrollEl.scrollLeft = scrollEl.scrollWidth
    }
  })

  // Setup IntersectionObserver for infinite scroll
  setupInfiniteScroll(gridEl, monthsEl, scrollEl)

  // Setup "Back to Today" button
  setupBackToToday(gridEl, scrollEl)

  // Click handler for cells
  gridEl.addEventListener("click", (e) => {
    const cell = (e.target as HTMLElement).closest(".pd-heatmap-cell") as HTMLElement | null
    if (!cell || cell.classList.contains("future")) return
    const dateKey = cell.dataset.date
    if (!dateKey) return
    showDayPanel(dateKey, _dayStats[dateKey])
  })
}

function getColorClass(count: number, isFuture: boolean): string {
  if (isFuture || count === 0) return count > 0 ? "level-1" : "empty"
  const intensity = Math.log(count + 1) / Math.log(_maxCount + 1)
  if (intensity < 0.25) return "level-1"
  if (intensity < 0.5) return "level-2"
  if (intensity < 0.75) return "level-3"
  return "level-4"
}

function renderWeekColumn(weekStart: Date): string {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  let html = `<div class="pd-heatmap-col" style="gap:${GAP}px">`

  for (let day = 0; day < 7; day++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + day)
    const dateKey = d.toISOString().slice(0, 10)
    const stat = _dayStats[dateKey]
    const count = stat?.total ?? 0
    const created = stat?.created ?? 0
    const modified = stat?.modified ?? 0
    const isToday = dateKey === todayKey
    const isFuture = d > today

    const hasDaily = stat?.hasDaily ?? false
    const colorClass = isFuture ? "future" : (count > 0 ? getColorClass(count, false) : (hasDaily ? "daily-only" : "empty"))

    const fmtDate = isFuture ? "" : new Intl.DateTimeFormat("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }).format(d)
    const dailyLabel = hasDaily ? " · 📖 Daily note" : ""
    const tooltipText = isFuture ? "" : `${fmtDate}\n${created} created · ${modified} modified${dailyLabel}`

    html += `<div class="pd-heatmap-cell ${colorClass}${isToday ? " today" : ""}${hasDaily ? " has-daily" : ""}"
      style="width:${CELL_SIZE}px;height:${CELL_SIZE}px"
      data-date="${dateKey}"
      ${!isFuture ? `data-tooltip="${tooltipText.replace(/"/g, "&quot;")}"` : ""}
    ></div>`
  }

  html += "</div>"
  return html
}

function appendMonth(monthDate: Date, gridEl: HTMLElement, monthsEl: HTMLElement) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  // Year boundary: add divider before January (if not the very first month)
  if (month === 0 && gridEl.children.length > 0) {
    const divider = document.createElement("div")
    divider.className = "pd-heatmap-year-divider"
    divider.innerHTML = `<span class="pd-heatmap-year-label">${year}</span>`
    gridEl.appendChild(divider)
  }

  // Create month wrapper
  const monthWrapper = document.createElement("div")
  monthWrapper.className = "pd-heatmap-month"
  monthWrapper.dataset.month = `${year}-${String(month + 1).padStart(2, "0")}`
  monthWrapper.style.gap = `${GAP}px`

  // Find the first Sunday on or before the 1st of the month
  const firstOfMonth = new Date(year, month, 1)
  const firstDayOfWeek = firstOfMonth.getDay()
  const weekStart = new Date(firstOfMonth)
  weekStart.setDate(1 - firstDayOfWeek)

  // Find the last day of the month
  const lastOfMonth = new Date(year, month + 1, 0)

  // Render all weeks that overlap this month
  const cursor = new Date(weekStart)
  while (cursor <= lastOfMonth) {
    monthWrapper.innerHTML += renderWeekColumn(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }

  gridEl.appendChild(monthWrapper)

  // Add month label
  const monthLabel = document.createElement("span")
  monthLabel.className = "pd-heatmap-month-label"
  monthLabel.textContent = firstOfMonth.toLocaleString("default", { month: "short" })
  monthLabel.dataset.month = monthWrapper.dataset.month
  monthsEl.appendChild(monthLabel)

  // Position the label after DOM layout
  requestAnimationFrame(() => {
    const gridRect = gridEl.getBoundingClientRect()
    const wrapRect = monthWrapper.getBoundingClientRect()
    monthLabel.style.left = `${wrapRect.left - gridRect.left}px`
  })
}

function prependMonth(monthDate: Date, gridEl: HTMLElement, monthsEl: HTMLElement, scrollEl: HTMLElement) {
  const prevScrollLeft = scrollEl.scrollLeft
  const prevScrollWidth = scrollEl.scrollWidth

  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  // Create month wrapper
  const monthWrapper = document.createElement("div")
  monthWrapper.className = "pd-heatmap-month"
  monthWrapper.dataset.month = `${year}-${String(month + 1).padStart(2, "0")}`
  monthWrapper.style.gap = `${GAP}px`

  const firstOfMonth = new Date(year, month, 1)
  const firstDayOfWeek = firstOfMonth.getDay()
  const weekStart = new Date(firstOfMonth)
  weekStart.setDate(1 - firstDayOfWeek)
  const lastOfMonth = new Date(year, month + 1, 0)

  const cursor = new Date(weekStart)
  while (cursor <= lastOfMonth) {
    monthWrapper.innerHTML += renderWeekColumn(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }

  // Year boundary: add divider after this month if next month is January
  const nextMonth = new Date(year, month + 1, 1)
  if (nextMonth.getMonth() === 0) {
    const divider = document.createElement("div")
    divider.className = "pd-heatmap-year-divider"
    divider.innerHTML = `<span class="pd-heatmap-year-label">${nextMonth.getFullYear()}</span>`
    gridEl.insertBefore(divider, gridEl.firstChild)
  }

  gridEl.insertBefore(monthWrapper, gridEl.firstChild)

  // Add month label
  const monthLabel = document.createElement("span")
  monthLabel.className = "pd-heatmap-month-label"
  monthLabel.textContent = firstOfMonth.toLocaleString("default", { month: "short" })
  monthLabel.dataset.month = monthWrapper.dataset.month
  monthsEl.insertBefore(monthLabel, monthsEl.firstChild)

  // Restore scroll position synchronously to prevent visible jump
  const scrollDelta = scrollEl.scrollWidth - prevScrollWidth
  scrollEl.scrollLeft = prevScrollLeft + scrollDelta
  repositionMonthLabels(gridEl, monthsEl)
}

function repositionMonthLabels(gridEl: HTMLElement, monthsEl: HTMLElement) {
  const gridRect = gridEl.getBoundingClientRect()
  for (const label of monthsEl.querySelectorAll(".pd-heatmap-month-label") as NodeListOf<HTMLElement>) {
    const monthKey = label.dataset.month
    if (!monthKey) continue
    const wrapper = gridEl.querySelector(`[data-month="${monthKey}"]`) as HTMLElement | null
    if (!wrapper) continue
    const wrapRect = wrapper.getBoundingClientRect()
    label.style.left = `${wrapRect.left - gridRect.left}px`
  }
}

function setupInfiniteScroll(gridEl: HTMLElement, monthsEl: HTMLElement, scrollEl: HTMLElement) {
  let loading = false
  const today = new Date()
  const maxFuture = new Date(today.getFullYear(), today.getMonth() + 6, 1)

  function checkScroll() {
    if (loading) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollEl

    // Near left edge → prepend months
    if (scrollLeft < 300 && _renderedMonthMin) {
      loading = true
      for (let i = 0; i < 2; i++) {
        _renderedMonthMin = new Date(_renderedMonthMin!.getFullYear(), _renderedMonthMin!.getMonth() - 1, 1)
        prependMonth(_renderedMonthMin, gridEl, monthsEl, scrollEl)
      }
      pruneDistantMonths(gridEl, monthsEl, "right")
      loading = false
    }

    // Near right edge → append months
    if (scrollLeft > scrollWidth - clientWidth - 300 && _renderedMonthMax) {
      loading = true
      for (let i = 0; i < 2; i++) {
        const next = new Date(_renderedMonthMax!.getFullYear(), _renderedMonthMax!.getMonth() + 1, 1)
        if (next > maxFuture) break
        _renderedMonthMax = next
        appendMonth(_renderedMonthMax, gridEl, monthsEl)
      }
      pruneDistantMonths(gridEl, monthsEl, "left")
      loading = false
    }
  }

  let scrollTimer: ReturnType<typeof setTimeout> | null = null
  const onScroll = () => {
    if (scrollTimer) return
    scrollTimer = setTimeout(() => {
      repositionMonthLabels(gridEl, monthsEl)
      checkScroll()
      scrollTimer = null
    }, 50)
  }

  scrollEl.addEventListener("scroll", onScroll, { passive: true })
  window.addCleanup(() => scrollEl.removeEventListener("scroll", onScroll))
}

function pruneDistantMonths(gridEl: HTMLElement, monthsEl: HTMLElement, side: "left" | "right") {
  const months = gridEl.querySelectorAll(".pd-heatmap-month")
  if (months.length <= MAX_MONTHS) return

  const excess = months.length - MAX_MONTHS
  for (let i = 0; i < excess; i++) {
    if (side === "right") {
      const last = months[months.length - 1 - i]
      const key = (last as HTMLElement).dataset.month
      last.remove()
      // Remove preceding year divider if present
      const lastChild = gridEl.lastElementChild
      if (lastChild?.classList.contains("pd-heatmap-year-divider")) lastChild.remove()
      // Remove month label
      const label = monthsEl.querySelector(`[data-month="${key}"]`)
      if (label) label.remove()
      // Update max
      if (key && _renderedMonthMax) {
        const [y, m] = key.split("-").map(Number)
        _renderedMonthMax = new Date(y, m - 1, 1)
      }
    } else {
      const first = months[i]
      const key = (first as HTMLElement).dataset.month
      first.remove()
      // Remove following year divider if present
      const firstChild = gridEl.firstElementChild
      if (firstChild?.classList.contains("pd-heatmap-year-divider")) firstChild.remove()
      const label = monthsEl.querySelector(`[data-month="${key}"]`)
      if (label) label.remove()
      if (key && _renderedMonthMin) {
        const [y, m] = key.split("-").map(Number)
        _renderedMonthMin = new Date(y, m - 1, 1)
      }
    }
  }
}

// Custom smooth scroll with easeOutCubic for iOS-like feel
function smoothScrollTo(el: HTMLElement, targetLeft: number, duration = 800) {
  const start = el.scrollLeft
  const delta = targetLeft - start
  if (Math.abs(delta) < 1) return
  const startTime = performance.now()
  function frame(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3) // easeOutCubic
    el.scrollLeft = start + delta * ease
    if (progress < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function getTodayCellOffset(gridEl: HTMLElement, scrollEl: HTMLElement): number {
  const todayCell = gridEl.querySelector('.pd-heatmap-cell.today') as HTMLElement | null
  if (!todayCell) return -1
  // Walk up offsetParent to find offset relative to scrollEl
  let offset = 0
  let el: HTMLElement | null = todayCell
  while (el && el !== scrollEl) {
    offset += el.offsetLeft
    el = el.offsetParent as HTMLElement | null
  }
  return offset
}

function updateArrowDirection(scrollEl: HTMLElement, gridEl: HTMLElement) {
  const arrowLine = document.getElementById("pd-arrow-line")
  const arrowHead = document.getElementById("pd-arrow-head")
  if (!arrowLine || !arrowHead) return

  const todayOffset = getTodayCellOffset(gridEl, scrollEl)
  if (todayOffset < 0) return

  const scrollCenter = scrollEl.scrollLeft + scrollEl.clientWidth / 2
  const pointsRight = todayOffset > scrollCenter

  if (pointsRight) {
    // Arrow pointing RIGHT →
    arrowLine.setAttribute("x1", "5")
    arrowLine.setAttribute("x2", "19")
    arrowHead.setAttribute("points", "12 5 19 12 12 19")
  } else {
    // Arrow pointing LEFT ←
    arrowLine.setAttribute("x1", "19")
    arrowLine.setAttribute("x2", "5")
    arrowHead.setAttribute("points", "12 19 5 12 12 5")
  }
}

function setupBackToToday(gridEl: HTMLElement, scrollEl: HTMLElement) {
  const btn = document.getElementById("pd-back-to-today") as HTMLElement | null
  const btnText = document.getElementById("pd-back-to-today-text") as HTMLElement | null
  if (!btn || !btnText) return

  const todayKey = new Date().toISOString().slice(0, 10)

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        btn.style.display = "none"
      } else {
        // Show button with today's info
        const todayStat = _dayStats[todayKey]
        const count = todayStat?.total ?? 0
        const today = new Date()
        const label = today.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        btnText.textContent = count > 0 ? `${label} · ${count} notes` : label
        btn.style.display = "flex"
        // Update arrow direction
        updateArrowDirection(scrollEl, gridEl)
      }
    }
  }, { root: scrollEl, threshold: 0 })

  // Observe the today cell once it exists
  requestAnimationFrame(() => {
    const todayCell = gridEl.querySelector('.pd-heatmap-cell.today')
    if (todayCell) observer.observe(todayCell)
  })

  // Also update arrow on scroll (when button is visible)
  const onScrollArrow = () => {
    if (btn.style.display !== "none") updateArrowDirection(scrollEl, gridEl)
  }
  scrollEl.addEventListener("scroll", onScrollArrow, { passive: true })

  btn.addEventListener("click", () => {
    const offset = getTodayCellOffset(gridEl, scrollEl)
    if (offset >= 0) {
      smoothScrollTo(scrollEl, offset - scrollEl.clientWidth / 2, 800)
    }
  })

  window.addCleanup(() => {
    observer.disconnect()
    scrollEl.removeEventListener("scroll", onScrollArrow)
  })
}

// ── Day detail panel (slide-in from right) ──
function showDayPanel(dateKey: string, stat: DayStat | undefined) {
  const panel = document.getElementById("pd-day-panel") as HTMLElement
  const backdrop = document.getElementById("pd-day-panel-backdrop") as HTMLElement
  const title = document.getElementById("pd-day-panel-title") as HTMLElement
  const body = document.getElementById("pd-day-panel-body") as HTMLElement
  if (!panel || !backdrop || !title || !body) return

  const date = new Date(dateKey + "T00:00:00")
  const fmtDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  }).format(date)

  title.textContent = fmtDate

  const entries = stat?.entries ?? []
  if (entries.length === 0) {
    body.innerHTML = `<div class="pd-empty">No notes on this day.</div>`
  } else {
    body.innerHTML = entries.map((e) => {
      const cat = classifyEntry(e.slug)
      const stage = stages.find((s) => s.key === cat)
      const color = stage?.color ?? (cat === "daily" ? "#3b82f6" : "#8b8b8b")
      const label = stage?.label ?? (cat === "daily" ? "Daily" : cat)
      const preview = (e.content ?? "").slice(0, 120).replace(/[#*_\[\]]/g, "").trim()
      const tags = (e.tags ?? []).slice(0, 3).map((t: string) => `<span class="pd-day-tag">#${t}</span>`).join("")

      // Format daily note title nicely
      let displayTitle = e.title
      const dailySlugMatch = e.slug.match(/^Daily\/(\d{4}-\d{2}-\d{2})$/)
      if (dailySlugMatch) {
        const d = new Date(dailySlugMatch[1] + "T12:00:00")
        displayTitle = "📖 " + d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      }

      return `<a class="pd-day-note" href="/${e.slug}">
        <div class="pd-day-note-header">
          <span class="pd-day-note-title">${displayTitle}</span>
          <span class="pd-day-note-badge" style="background:${color}">${label}</span>
        </div>
        ${preview ? `<div class="pd-day-note-preview">${preview}${e.content && e.content.length > 120 ? "…" : ""}</div>` : ""}
        ${tags ? `<div class="pd-day-note-tags">${tags}</div>` : ""}
      </a>`
    }).join("")
  }

  panel.classList.add("open")
  backdrop.classList.add("open")

  const close = () => {
    panel.classList.remove("open")
    backdrop.classList.remove("open")
  }

  const closeBtn = document.getElementById("pd-day-panel-close")
  if (closeBtn) {
    const handler = () => close()
    closeBtn.addEventListener("click", handler, { once: true })
  }
  backdrop.addEventListener("click", close, { once: true })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey) }
  }
  document.addEventListener("keydown", onKey)
}

function renderRecentlyModified(entries: ContentEntry[]) {
  const listEl = document.getElementById("pd-recent-list")
  if (!listEl) return

  const systemPages = new Set(["index", "Search", "All-Notes", "Books-and-PDFs", "Verse-Chain", "Dashboard"])
  const sorted = entries
    .filter((e) => e.date && !systemPages.has(e.slug) && !e.slug.startsWith("Daily/"))
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 10)

  if (sorted.length === 0) {
    listEl.innerHTML = `<div class="pd-empty">No recently modified notes.</div>`
    return
  }

  listEl.innerHTML = sorted
    .map((e, i) => {
      const cat = classifyEntry(e.slug)
      const stage = stages.find((s) => s.key === cat)
      const color = stage?.color ?? "#8b8b8b"
      const label = stage?.label ?? cat
      return `<div class="pd-recent-item" style="animation-delay:${i * 40}ms">
        <a class="pd-recent-title" href="/${e.slug}">${e.title}</a>
        <span class="pd-recent-badge" style="background:${color}">${label}</span>
        <span class="pd-recent-date">${relativeDate(e.date!)}</span>
      </div>`
    })
    .join("")
}

function renderStaleStudies(inProgressEntries: ContentEntry[]) {
  const listEl = document.getElementById("pd-stale-list")
  if (!listEl) return

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const stale = inProgressEntries
    .filter((e) => e.date && new Date(e.date).getTime() < thirtyDaysAgo)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .slice(0, 10)

  if (stale.length === 0) {
    listEl.innerHTML = `<div class="pd-empty">No stale studies! All in-progress notes are active.</div>`
    return
  }

  listEl.innerHTML = stale
    .map((e) => {
      const days = Math.floor((Date.now() - new Date(e.date!).getTime()) / 86400000)
      return `<div class="pd-stale-item">
        <a class="pd-stale-title" href="/${e.slug}">${e.title}</a>
        <span class="pd-stale-days">${days} days stale</span>
      </div>`
    })
    .join("")
}

document.addEventListener("nav", init)
