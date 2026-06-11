document.addEventListener("nav", () => {
  const fab = document.querySelector(".mobile-settings-fab") as HTMLButtonElement | null
  const sheet = document.querySelector(".mobile-settings-sheet") as HTMLElement | null
  const backdrop = document.querySelector(".mobile-settings-backdrop") as HTMLElement | null
  if (!fab || !sheet || !backdrop) return

  // Reparent to <body> so position:fixed resolves against the viewport and
  // isn't trapped inside .center's stacking context (SPA opacity/transform animation).
  if (sheet.parentElement !== document.body) document.body.appendChild(sheet)
  if (backdrop.parentElement !== document.body) document.body.appendChild(backdrop)

  let isOpen = false
  let isExpanded = false

  // ── Verses in this note ──────────────────────────────────────────────────────
  function buildVersesSection() {
    const existing = sheet!.querySelector(".mvc-in-sheet")
    if (existing) existing.remove()

    const anchors = Array.from(
      document.querySelectorAll("article a[data-verse-ref]"),
    ) as HTMLAnchorElement[]
    if (!anchors.length) return

    // Deduplicate by verse ref text
    const seen = new Set<string>()
    const unique = anchors.filter((a) => {
      const key = a.getAttribute("data-verse-ref") || a.textContent || ""
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const section = document.createElement("div")
    section.className = "mvc-in-sheet"
    section.innerHTML = `<p class="mvc-sheet-title">Verses in this note</p><ul class="mvc-list"></ul>`
    const list = section.querySelector(".mvc-list")!
    unique.forEach((a) => {
      const li = document.createElement("li")
      const link = document.createElement("a")
      link.className = "mvc-link"
      link.href = a.href
      link.textContent = a.getAttribute("data-verse-ref") || a.textContent || ""
      link.addEventListener("click", () => closeSheet())
      li.appendChild(link)
      list.appendChild(li)
    })

    // Insert before the first .mobile-settings-title
    const firstTitle = sheet!.querySelector(".mobile-settings-title")
    if (firstTitle) firstTitle.parentElement!.insertBefore(section, firstTitle)
    else sheet!.appendChild(section)
  }

  function openSheet() {
    isOpen = true
    sheet!.classList.add("open")
    backdrop!.classList.add("open")
    document.body.style.overflow = "hidden"
    buildVersesSection()

    // Sync pill position in this sheet's toggle
    const pref = localStorage.getItem("theme") ?? "system"
    const toggle = sheet!.querySelector(".theme-toggle")
    if (toggle) {
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
    isExpanded = false
    sheet!.classList.remove("open", "expanded")
    backdrop!.classList.remove("open")
    document.body.style.overflow = ""
    sheet!.style.transition = ""
    sheet!.style.transform = ""
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

    localStorage.setItem("theme", pref)
    const resolveSystemTheme = (): "light" | "dark" =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    const resolved = pref === "system" ? resolveSystemTheme() : (pref as "light" | "dark")
    document.documentElement.setAttribute("saved-theme", resolved)
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: resolved } }))

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

  // ── Swipe-down to dismiss / swipe-up to expand ───────────────────────────────
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
    const dy = currentY - startY
    if (dy > 0 && !isExpanded) {
      sheet!.style.transform = `translateY(${dy}px)`
    } else if (dy < 0 && !isExpanded) {
      // Upward drag — no visual feedback, snap on release
    }
  }

  const onTouchEnd = () => {
    if (!dragging) return
    dragging = false
    sheet!.style.transition = ""
    sheet!.style.transform = ""
    const dy = currentY - startY
    if (dy < -60 && !isExpanded) {
      // Expand to full height
      isExpanded = true
      sheet!.classList.add("expanded")
    } else if (dy > 80) {
      if (isExpanded) {
        isExpanded = false
        sheet!.classList.remove("expanded")
      } else {
        closeSheet()
      }
    }
  }

  fab.addEventListener("click", onFabClick)
  backdrop.addEventListener("click", onBackdropClick)
  sheet.addEventListener("click", onSheetClick)
  sheet.addEventListener("touchstart", onTouchStart, { passive: true })
  sheet.addEventListener("touchmove", onTouchMove, { passive: true })
  sheet.addEventListener("touchend", onTouchEnd)

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
