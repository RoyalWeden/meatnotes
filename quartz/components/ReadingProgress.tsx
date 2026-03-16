import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const ReadingProgress: QuartzComponent = (_props: QuartzComponentProps) => {
  return <div id="reading-progress-bar"></div>
}

ReadingProgress.css = `
#reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 0%;
  height: 3px;
  background: var(--secondary);
  z-index: 9999;
  transition: width 0.1s ease;
}
`

ReadingProgress.afterDOMLoaded = `
(function() {
  function updateProgress() {
    const bar = document.getElementById('reading-progress-bar')
    if (!bar) return
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
    bar.style.width = progress + '%'
  }

  window.addEventListener('scroll', updateProgress, { passive: true })
  document.addEventListener('nav', updateProgress)
  updateProgress()
})()
`

export default (() => ReadingProgress) satisfies QuartzComponentConstructor