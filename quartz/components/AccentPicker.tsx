// AccentPicker — wires the accent-color palette defined in custom.scss.
//
// The component renders nothing itself. It just registers two scripts:
//   1. `beforeDOMLoaded` reads localStorage and sets `data-accent` on <html>
//      *before* first paint, so refreshing on a non-blue accent doesn't flash
//      blue first.
//   2. `afterDOMLoaded` wires click handlers on every `[data-set-accent]`
//      button anywhere in the page (Darkmode float on desktop, MobileSettings
//      sheet on mobile, and any future surface).
//
// Swatch markup is inlined where it visually belongs (Darkmode.tsx +
// MobileSettings.tsx) so each surface controls its own layout.

import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const AccentPicker: QuartzComponent = (_props: QuartzComponentProps) => null

AccentPicker.beforeDOMLoaded = `
(function() {
  var VALID = ['blue','purple','pink','red','orange','yellow','green','graphite']
  function apply(accent) {
    if (!accent || VALID.indexOf(accent) === -1) accent = 'blue'
    document.documentElement.setAttribute('data-accent', accent)
  }
  try {
    apply(localStorage.getItem('accent') || 'blue')
  } catch (e) {
    apply('blue')
  }
})()
`

AccentPicker.afterDOMLoaded = `
(function() {
  var VALID = ['blue','purple','pink','red','orange','yellow','green','graphite']

  function setAccent(accent) {
    if (!accent || VALID.indexOf(accent) === -1) return
    document.documentElement.setAttribute('data-accent', accent)
    try { localStorage.setItem('accent', accent) } catch (e) {}
    syncActive(accent)
  }

  function syncActive(accent) {
    var current = accent || document.documentElement.getAttribute('data-accent') || 'blue'
    var btns = document.querySelectorAll('[data-set-accent]')
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i]
      var match = b.getAttribute('data-set-accent') === current
      b.classList.toggle('active', match)
      b.setAttribute('aria-checked', match ? 'true' : 'false')
    }
  }

  function onClick(e) {
    var t = e.target
    while (t && t !== document.body) {
      if (t.hasAttribute && t.hasAttribute('data-set-accent')) {
        e.preventDefault()
        setAccent(t.getAttribute('data-set-accent'))
        return
      }
      t = t.parentNode
    }
  }

  document.addEventListener('click', onClick)
  document.addEventListener('nav', function() {
    syncActive()
  })
  syncActive()
})()
`

export default (() => AccentPicker) satisfies QuartzComponentConstructor
