// Theme toggle: light / dark / system (3-way segmented control)

const resolveSystemTheme = (): "light" | "dark" =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

// Read stored preference: "light", "dark", or "system"
const storedPref = localStorage.getItem("theme") ?? "system"
const resolvedTheme = storedPref === "system" ? resolveSystemTheme() : (storedPref as "light" | "dark")
document.documentElement.setAttribute("saved-theme", resolvedTheme)

const emitThemeChangeEvent = (theme: "light" | "dark") => {
  const event: CustomEventMap["themechange"] = new CustomEvent("themechange", {
    detail: { theme },
  })
  document.dispatchEvent(event)
}

function applyTheme(pref: string) {
  localStorage.setItem("theme", pref)
  const resolved = pref === "system" ? resolveSystemTheme() : (pref as "light" | "dark")
  document.documentElement.setAttribute("saved-theme", resolved)
  emitThemeChangeEvent(resolved)
}

function updatePillPosition(container: Element, pref: string) {
  const btn = container.querySelector(`[data-theme="${pref}"]`) as HTMLElement | null
  const pill = container.querySelector(".theme-toggle-pill") as HTMLElement | null
  if (!btn || !pill) return

  // Update active state on buttons
  container.querySelectorAll(".theme-toggle-btn").forEach((b) => {
    b.classList.toggle("active", b === btn)
    b.setAttribute("aria-checked", b === btn ? "true" : "false")
  })

  // Animate pill to button position (use offsetLeft — immune to CSS transforms on ancestors)
  pill.style.width = `${btn.offsetWidth}px`
  pill.style.transform = `translateX(${btn.offsetLeft}px)`
}

document.addEventListener("nav", () => {
  const currentPref = localStorage.getItem("theme") ?? "system"

  // Init all toggle instances (mobile + desktop)
  for (const toggle of document.querySelectorAll(".theme-toggle")) {
    updatePillPosition(toggle, currentPref)

    const handleClick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest(".theme-toggle-btn") as HTMLElement | null
      if (!btn) return
      const pref = btn.getAttribute("data-theme")
      if (!pref) return

      applyTheme(pref)

      // Update pill in ALL toggle instances (mobile + desktop stay in sync)
      for (const t of document.querySelectorAll(".theme-toggle")) {
        updatePillPosition(t, pref)
      }
    }

    toggle.addEventListener("click", handleClick)
    window.addCleanup(() => toggle.removeEventListener("click", handleClick))
  }

  // ── Auto-hide floating theme pill after 5s of inactivity ──
  const themeFloat = document.querySelector(".theme-float") as HTMLElement | null
  if (themeFloat) {
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const showFloat = () => {
      themeFloat.classList.remove("theme-float--hidden")
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => themeFloat.classList.add("theme-float--hidden"), 5000)
    }

    // Start initial hide timer
    hideTimer = setTimeout(() => themeFloat.classList.add("theme-float--hidden"), 5000)

    // Throttled scroll/mouse listener
    let lastActivity = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivity < 100) return
      lastActivity = now
      showFloat()
    }

    document.addEventListener("scroll", onActivity, { passive: true })
    document.addEventListener("mousemove", onActivity, { passive: true })
    window.addCleanup(() => {
      document.removeEventListener("scroll", onActivity)
      document.removeEventListener("mousemove", onActivity)
      if (hideTimer) clearTimeout(hideTimer)
    })
  }

  // Listen for OS theme changes (only matters when pref is "system")
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  const onSystemChange = () => {
    if (localStorage.getItem("theme") === "system") {
      const resolved = resolveSystemTheme()
      document.documentElement.setAttribute("saved-theme", resolved)
      emitThemeChangeEvent(resolved)
    }
  }
  mq.addEventListener("change", onSystemChange)
  window.addCleanup(() => mq.removeEventListener("change", onSystemChange))
})
