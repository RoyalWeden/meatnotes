import { FullSlug } from "../../util/path"
import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { registerEscapeHandler } from "./util"

type ContentIndex = Record<FullSlug, ContentDetails>

const BOOK_ICON = `<svg class="idiom-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`

function isIdiomSlug(slug: string): boolean {
  return slug.includes("01-") && slug.toLowerCase().includes("idiom")
}


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

async function setupIdiomSearch(el: Element) {
  const button = el.querySelector(".idiom-search-button") as HTMLButtonElement | null
  const modal = el.querySelector(".idiom-modal") as HTMLElement | null
  const filterInput = el.querySelector(".idiom-filter") as HTMLInputElement | null
  const grid = el.querySelector(".idiom-grid") as HTMLElement | null
  if (!button || !modal || !filterInput || !grid) return

  let loaded = false
  let cards: { slug: string; name: string; desc: string }[] = []

  function renderCards(filter: string) {
    const q = filter.toLowerCase().trim()
    let anyVisible = false
    for (const child of Array.from(grid!.querySelectorAll<HTMLElement>(".idiom-card"))) {
      const name = child.dataset.name?.toLowerCase() ?? ""
      const desc = child.dataset.desc?.toLowerCase() ?? ""
      const visible = !q || name.includes(q) || desc.includes(q)
      child.classList.toggle("hidden", !visible)
      if (visible) anyVisible = true
    }
    let noResults = grid!.querySelector(".idiom-no-results")
    if (!anyVisible) {
      if (!noResults) {
        noResults = document.createElement("div")
        noResults.className = "idiom-no-results"
        noResults.textContent = "No idioms match your filter."
        grid!.appendChild(noResults)
      }
    } else {
      noResults?.remove()
    }
  }

  async function loadCards() {
    if (loaded) return
    loaded = true

    const data: ContentIndex = await fetch("/static/contentIndex.json").then((r) => r.json())

    const skipLine = /^(meaning|details?|related|overview|definition|background|notes?|summary|examples?|usage|context|references?|strong|definitions?|n\/a|qualities?)/i
    cards = Object.entries(data)
      .filter(([slug]) => isIdiomSlug(slug))
      .map(([slug, fd]) => {
        const name = fd.title ?? slug.split("/").pop() ?? slug
        const content: string = (fd as any).content ?? ""
        const snippet = content
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 4 && l !== name && !skipLine.test(l))
          .slice(0, 2)
          .join(" — ")
        return { slug, name, desc: snippet }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const { slug, name, desc } of cards) {
      const card = document.createElement("a")
      card.className = "idiom-card"
      card.href = `/${slug}`
      card.dataset.name = name
      card.dataset.desc = desc
      card.innerHTML = `
        <div class="idiom-card-inner">
          <div class="idiom-card-front">
            <span class="idiom-card-name">${name}</span>
            ${BOOK_ICON}
          </div>
          <div class="idiom-card-back">
            <p class="idiom-card-desc">${desc || `<em style="opacity:0.45">Open to read</em>`}</p>
          </div>
        </div>
      `
      card.addEventListener("click", () => closeModal())
      grid!.appendChild(card)
    }
  }

  function openModal() {
    modal!.classList.add("active")
    lockScroll()
    loadCards().then(() => {
      filterInput!.value = ""
      renderCards("")
      filterInput!.focus()
    })
  }

  function closeModal() {
    modal!.classList.remove("active")
    unlockScroll()
    button!.focus()
  }

  button.addEventListener("click", openModal)
  window.addCleanup(() => button.removeEventListener("click", openModal))

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal()
  })

  filterInput.addEventListener("input", (e) => {
    renderCards((e.target as HTMLInputElement).value)
  })

  // Keyboard navigation inside the grid
  filterInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const first = grid!.querySelector<HTMLElement>(".idiom-card:not(.hidden)")
      first?.focus()
    }
  })

  grid.addEventListener("keydown", (e) => {
    const focused = document.activeElement as HTMLElement | null
    if (!focused?.classList.contains("idiom-card")) return
    const visible = Array.from(grid!.querySelectorAll<HTMLElement>(".idiom-card:not(.hidden)"))
    const idx = visible.indexOf(focused)
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      visible[idx + 1]?.focus()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      if (idx === 0) {
        filterInput!.focus()
      } else {
        visible[idx - 1]?.focus()
      }
    }
  })

  registerEscapeHandler(modal, closeModal)
}

document.addEventListener("nav", async () => {
  const elements = document.querySelectorAll(".idiom-search")
  for (const el of elements) {
    await setupIdiomSearch(el)
  }
})
