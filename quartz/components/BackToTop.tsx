import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const BackToTop: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <button id="back-to-top" aria-label="Back to top">
      ↑
    </button>
  )
}

BackToTop.css = `
#back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--secondary);
  color: var(--light);
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
#back-to-top.visible {
  opacity: 1;
  pointer-events: all;
}
#back-to-top:hover {
  opacity: 0.85;
}
`

BackToTop.afterDOMLoaded = `
(function() {
  function updateVisibility() {
    const btn = document.getElementById('back-to-top')
    if (!btn) return
    if (window.scrollY > 300) {
      btn.classList.add('visible')
    } else {
      btn.classList.remove('visible')
    }
  }

  function setupButton() {
    const btn = document.getElementById('back-to-top')
    if (!btn) return
    btn.onclick = function() {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  window.addEventListener('scroll', updateVisibility, { passive: true })
  document.addEventListener('nav', function() {
    setupButton()
    updateVisibility()
  })
  setupButton()
  updateVisibility()
})()
`

export default (() => BackToTop) satisfies QuartzComponentConstructor