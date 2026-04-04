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

  // Classify all entries
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
      return `<div class="pd-stat-card" style="--accent:${s.color};animation-delay:${i * 60}ms">
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
      return `<div class="pd-pipe-seg" style="width:${pct}%;background:${s.color}" title="${s.label}: ${count} notes (${Math.round(pct)}%)" data-stage="${s.key}"></div>`
    }).join("")

    // Click segment → could navigate to explorer filtered to that folder
    pipelineEl.addEventListener("click", (e) => {
      const seg = (e.target as HTMLElement).closest(".pd-pipe-seg") as HTMLElement | null
      if (!seg) return
      const stage = seg.dataset.stage
      // For now, just show a tooltip-like effect
      seg.style.opacity = "0.7"
      setTimeout(() => seg.style.opacity = "", 300)
    })
  }

  // --- Study stats (streak + heatmap) ---
  renderStudyStats(entries)

  // --- Recently modified ---
  renderRecentlyModified(entries)

  // --- Stale studies ---
  renderStaleStudies(stageEntries["in-progress"] ?? [])
}

function renderStudyStats(entries: ContentEntry[]) {
  // Daily notes = slug starts with "Daily/" and matches YYYY-MM-DD pattern
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
      // Allow today to not have a note yet — check yesterday
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

  // This week / month counts (all notes, not just daily)
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
      <div class="pd-streak-item">
        <div class="pd-streak-num">${currentStreak}</div>
        <div class="pd-streak-label">Current streak</div>
      </div>
      <div class="pd-streak-item">
        <div class="pd-streak-num">${longestStreak}</div>
        <div class="pd-streak-label">Longest streak</div>
      </div>
      <div class="pd-streak-item">
        <div class="pd-streak-num">${thisWeek}</div>
        <div class="pd-streak-label">This week</div>
      </div>
      <div class="pd-streak-item">
        <div class="pd-streak-num">${thisMonth}</div>
        <div class="pd-streak-label">This month</div>
      </div>
    `
  }

  // Heatmap: 52 weeks × 7 days
  renderHeatmap(dailyDates, entries)
}

function renderHeatmap(dailyDates: Set<string>, allEntries: ContentEntry[]) {
  const heatmapEl = document.getElementById("pd-heatmap")
  if (!heatmapEl) return

  // Count notes per day (all notes, not just daily)
  const dayCounts: Record<string, number> = {}
  for (const entry of allEntries) {
    if (!entry.date) continue
    const dateKey = new Date(entry.date).toISOString().slice(0, 10)
    dayCounts[dateKey] = (dayCounts[dateKey] ?? 0) + 1
  }

  const today = new Date()
  const todayDay = today.getDay() // 0=Sun
  const weeks = 53
  const cellSize = 12
  const gap = 2
  const dayLabelsWidth = 20
  const monthLabelsHeight = 14

  // Start from (weeks ago) on Sunday
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - (weeks * 7 - 1) - todayDay)

  const totalW = dayLabelsWidth + weeks * (cellSize + gap)
  const totalH = monthLabelsHeight + 7 * (cellSize + gap)

  let svg = `<svg width="${totalW}" height="${totalH}" class="pd-heatmap-svg">`

  // Day labels
  const dayNames = ["", "M", "", "W", "", "F", ""]
  for (let d = 0; d < 7; d++) {
    if (dayNames[d]) {
      const y = monthLabelsHeight + d * (cellSize + gap) + cellSize - 2
      svg += `<text x="0" y="${y}" font-size="9" fill="var(--gray)">${dayNames[d]}</text>`
    }
  }

  // Month labels
  let lastMonth = -1
  const cursor = new Date(startDate)
  for (let w = 0; w < weeks; w++) {
    const checkDate = new Date(cursor)
    checkDate.setDate(cursor.getDate() + w * 7)
    const month = checkDate.getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      const x = dayLabelsWidth + w * (cellSize + gap)
      const monthName = checkDate.toLocaleString("default", { month: "short" })
      svg += `<text x="${x}" y="${monthLabelsHeight - 3}" font-size="9" fill="var(--gray)">${monthName}</text>`
    }
  }

  // Cells
  const maxCount = Math.max(1, ...Object.values(dayCounts))
  const d = new Date(startDate)
  for (let w = 0; w < weeks; w++) {
    for (let day = 0; day < 7; day++) {
      const dateKey = d.toISOString().slice(0, 10)
      const count = dayCounts[dateKey] ?? 0
      const hasDaily = dailyDates.has(dateKey)
      const x = dayLabelsWidth + w * (cellSize + gap)
      const y = monthLabelsHeight + day * (cellSize + gap)

      // Check if this cell is in the current week
      const daysSinceStart = Math.floor((d.getTime() - startDate.getTime()) / 86400000)
      const cellWeek = Math.floor(daysSinceStart / 7)
      const todaysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000)
      const currentWeek = Math.floor(todaysSinceStart / 7)
      const isCurrentWeek = cellWeek === currentWeek

      let fill: string
      if (d > today) {
        fill = "transparent"
      } else if (count === 0) {
        fill = "var(--lightgray)"
      } else {
        // Logarithmic scaling — prevents bulk-committed days from washing out smaller counts
        const intensity = Math.log(count + 1) / Math.log(maxCount + 1)
        const isDark = document.documentElement.getAttribute("saved-theme") === "dark"
        if (isDark) {
          if (intensity < 0.25) fill = "#0e4429"
          else if (intensity < 0.5) fill = "#006d32"
          else if (intensity < 0.75) fill = "#26a641"
          else fill = "#39d353"
        } else {
          if (intensity < 0.25) fill = "#9be9a8"
          else if (intensity < 0.5) fill = "#40c463"
          else if (intensity < 0.75) fill = "#30a14e"
          else fill = "#216e39"
        }
      }

      const title = `${dateKey}: ${count} note${count !== 1 ? "s" : ""}${hasDaily ? " (daily)" : ""}`
      const stroke = isCurrentWeek && d <= today ? ` stroke="var(--secondary)" stroke-width="1" stroke-opacity="0.4"` : ""
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}"${stroke}><title>${title}</title></rect>`

      d.setDate(d.getDate() + 1)
    }
  }

  svg += "</svg>"
  heatmapEl.innerHTML = svg

  // Auto-scroll to current week so recent activity is visible
  requestAnimationFrame(() => {
    heatmapEl.scrollLeft = heatmapEl.scrollWidth
  })
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
