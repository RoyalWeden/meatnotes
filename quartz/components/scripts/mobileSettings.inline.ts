document.addEventListener("nav", () => {
  const fab = document.querySelector(".mobile-settings-fab") as HTMLButtonElement | null
  const sheet = document.querySelector(".mobile-settings-sheet") as HTMLElement | null
  const backdrop = document.querySelector(".mobile-settings-backdrop") as HTMLElement | null
  if (!fab || !sheet || !backdrop) return

  let isOpen = false

  function openSheet() {
    isOpen = true
    sheet!.classList.add("open")
    backdrop!.classList.add("open")
    document.body.style.overflow = "hidden"

    // Sync pill position in this sheet's toggle
    const pref = localStorage.getItem("theme") ?? "system"
    const toggle = sheet!.querySelector(".theme-toggle")
    if (toggle) {
      // Use the same updatePillPosition logic from darkmode.inline.ts
      const btn = toggle.querySelector(`[data-theme="${pref}"]`) as HTMLElement | null
      const pill = toggle.querySelector(".theme-toggle-pill") as HTMLElement | null
      if (btn && pill) {
        toggle.querySelectorAll(".theme-toggle-btn").forEach((b) => {
          b.classList.toggle("active", b === btn)
          b.setAttribute("aria-checked", b === btn ? "true" : "false")
        })
        const containerRect = toggle.getBoundingClientRect()
        const btnRect = btn.getBoundingClientRect()
        pill.style.width = `${btnRect.width}px`
        pill.style.transform = `translateX(${btnRect.left - containerRect.left}px)`
      }
    }
  }

  function closeSheet() {
    isOpen = false
    sheet!.classList.remove("open")
    backdrop!.classList.remove("open")
    document.body.style.overflow = ""
  }

  const onFabClick = () => {
    if (isOpen) closeSheet()
    else openSheet()
  }

  const onBackdropClick = () => closeSheet()

  const onSheetClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest(".theme-toggle-btn") as HTMLElement | null
    if (!btn) return
    const pref = btn.getAttribute("data-theme")
    if (!pref) return

    // Apply theme (reuse the global applyTheme function via event dispatch)
    localStorage.setItem("theme", pref)
    const resolveSystemTheme = (): "light" | "dark" =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    const resolved = pref === "system" ? resolveSystemTheme() : (pref as "light" | "dark")
    document.documentElement.setAttribute("saved-theme", resolved)
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: resolved } }))

    // Update pill in ALL toggle instances (mobile sheet + desktop float)
    for (const t of document.querySelectorAll(".theme-toggle")) {
      const targetBtn = t.querySelector(`[data-theme="${pref}"]`) as HTMLElement | null
      const pill = t.querySelector(".theme-toggle-pill") as HTMLElement | null
      if (!targetBtn || !pill) continue
      t.querySelectorAll(".theme-toggle-btn").forEach((b) => {
        b.classList.toggle("active", b === targetBtn)
        b.setAttribute("aria-checked", b === targetBtn ? "true" : "false")
      })
      const containerRect = t.getBoundingClientRect()
      const btnRect = targetBtn.getBoundingClientRect()
      pill.style.width = `${btnRect.width}px`
      pill.style.transform = `translateX(${btnRect.left - containerRect.left}px)`
    }
  }

  // Swipe-down to dismiss
  let startY = 0
  let currentY = 0
  let dragging = false

  const onTouchStart = (e: TouchEvent) => {
    startY = e.touches[0].clientY
    currentY = startY
    dragging = true
    sheet!.style.transition = "none"
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!dragging) return
    currentY = e.touches[0].clientY
    const dy = Math.max(0, currentY - startY)
    sheet!.style.transform = `translateY(${dy}px)`
  }

  const onTouchEnd = () => {
    if (!dragging) return
    dragging = false
    sheet!.style.transition = ""
    sheet!.style.transform = ""
    const dy = currentY - startY
    if (dy > 80) {
      closeSheet()
    }
  }

  fab.addEventListener("click", onFabClick)
  backdrop.addEventListener("click", onBackdropClick)
  sheet.addEventListener("click", onSheetClick)
  sheet.addEventListener("touchstart", onTouchStart, { passive: true })
  sheet.addEventListener("touchmove", onTouchMove, { passive: true })
  sheet.addEventListener("touchend", onTouchEnd)

  // Escape key
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) closeSheet()
  }
  document.addEventListener("keydown", onKeyDown)

  window.addCleanup(() => {
    fab.removeEventListener("click", onFabClick)
    backdrop.removeEventListener("click", onBackdropClick)
    sheet.removeEventListener("click", onSheetClick)
    sheet.removeEventListener("touchstart", onTouchStart)
    sheet.removeEventListener("touchmove", onTouchMove)
    sheet.removeEventListener("touchend", onTouchEnd)
    document.removeEventListener("keydown", onKeyDown)
    if (isOpen) {
      document.body.style.overflow = ""
    }
  })
})
