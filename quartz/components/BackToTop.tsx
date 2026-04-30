import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const BackToTop: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <button id="back-to-top" class="pressable" aria-label="Back to top" data-tooltip="Back to top">
      ↑
    </button>
  )
}

BackToTop.css = `
/* iOS-style glass chip — translucent, accent text, hairline edge.
   Sits above the iPhone home indicator via env(safe-area-inset-bottom). */
#back-to-top {
  position: fixed;
  bottom: max(1.25rem, env(safe-area-inset-bottom, 0px));
  right: max(1.25rem, env(safe-area-inset-right, 0px));
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--light) 78%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: var(--accent);
  border: 0.5px solid color-mix(in srgb, var(--darkgray) 14%, transparent);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.15s ease;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);

  /* Stack to the left of the MobileSettings FAB on mobile so they don't overlap.
     MobileSettings sits at right: 20px; BackToTop steps left by 64px. */
  @media (max-width: 800px) {
    right: calc(max(1.25rem, env(safe-area-inset-right, 0px)) + 3.5rem);
  }
}
#back-to-top.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: all;
}
#back-to-top:hover {
  background: color-mix(in srgb, var(--light) 95%, transparent);
}
#back-to-top:active {
  transform: translateY(0) scale(0.94);
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