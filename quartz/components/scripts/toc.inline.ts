const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const slug = entry.target.id
    const tocEntryElements = document.querySelectorAll(`a[data-for="${slug}"]`)
    const windowHeight = entry.rootBounds?.height
    if (windowHeight && tocEntryElements.length > 0) {
      if (entry.boundingClientRect.y < windowHeight) {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.add("in-view"))
      } else {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.remove("in-view"))
      }
    }
  }
})

function toggleToc(this: HTMLElement) {
  this.classList.toggle("collapsed")
  this.setAttribute(
    "aria-expanded",
    this.getAttribute("aria-expanded") === "true" ? "false" : "true",
  )
  const content = this.nextElementSibling as HTMLElement | undefined
  if (!content) return
  content.classList.toggle("collapsed")
}

function setupToc() {
  for (const toc of document.getElementsByClassName("toc")) {
    const button = toc.querySelector(".toc-header")
    const content = toc.querySelector(".toc-content")
    if (!button || !content) return
    button.addEventListener("click", toggleToc)
    window.addCleanup(() => button.removeEventListener("click", toggleToc))
  }
}

// Keep scroll-padding-top in sync with whatever is actually sticking at the top
// of the viewport right now. We scan all sticky/fixed elements and take the
// maximum bottom edge of those that are actively sticking (rect.top ≈ CSS top).
// This is fully dynamic — no hard-coded breakpoints or pixel values — so it
// works correctly on any screen size, browser, or device.
let rafPending = false
function updateScrollPadding() {
  let maxBottom = 0
  for (const el of document.querySelectorAll<HTMLElement>("header, nav, div, aside")) {
    const style = getComputedStyle(el)
    if (style.position !== "sticky" && style.position !== "fixed") continue
    const topCss = parseFloat(style.top)
    // Skip elements not anchored near the top (e.g. bottom-fixed buttons)
    if (isNaN(topCss) || topCss > 300) continue
    const rect = el.getBoundingClientRect()
    if (rect.height === 0) continue
    // Exclude elements translated off-screen (e.g. a closed mobile menu drawer
    // that slides in from the left — its rect.right is 0 or negative).
    if (rect.right <= 0 || rect.left >= window.innerWidth) continue
    // An element is actively sticking when its rendered top equals its CSS top.
    // Allow 2px tolerance for subpixel/browser rounding differences.
    if (rect.top <= topCss + 2) {
      maxBottom = Math.max(maxBottom, rect.bottom)
    }
  }
  const h = Math.ceil(maxBottom) + 8
  document.documentElement.style.setProperty("--scroll-padding", `${h}px`)
}

function onScrollOrResize() {
  if (!rafPending) {
    rafPending = true
    requestAnimationFrame(() => {
      updateScrollPadding()
      rafPending = false
    })
  }
}

document.addEventListener("nav", () => {
  setupToc()

  // update toc entry highlighting
  observer.disconnect()
  const headers = document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")
  headers.forEach((header) => observer.observe(header))

  // Measure header height and keep it updated as the header shrinks on scroll
  // or reflows on resize (different screen sizes change the header height).
  updateScrollPadding()
  window.addEventListener("scroll", onScrollOrResize, { passive: true })
  window.addEventListener("resize", onScrollOrResize, { passive: true })
  window.addCleanup(() => {
    window.removeEventListener("scroll", onScrollOrResize)
    window.removeEventListener("resize", onScrollOrResize)
  })
})
