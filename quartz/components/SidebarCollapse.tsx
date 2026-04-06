import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/sidebarCollapse.scss"
// @ts-ignore
import script from "./scripts/sidebarCollapse.inline"

export default (() => {
  const SidebarCollapse: QuartzComponent = (_props: QuartzComponentProps) => {
    // This component renders nothing visible — it only contributes CSS and JS.
    // The actual toggle buttons and icon rail are injected into renderPage.tsx.
    return null
  }

  SidebarCollapse.css = style
  // Prevent FOUC: apply collapsed state before first paint
  SidebarCollapse.beforeDOMLoaded = `
(function(){
  try {
    var slug = document.body?.getAttribute("data-slug") || "";
    var pt = slug === "index" ? "home" : slug === "Dashboard" ? "dashboard" : slug === "Verse-Chain" ? "verse-chain" : slug === "Books-and-PDFs" ? "books" : slug === "All-Notes" ? "all-notes" : slug === "Search" ? "search" : slug.indexOf("Daily/") === 0 ? "daily" : "note";
    var lk = "sidebar-left-" + pt;
    var rk = "sidebar-right-" + pt;
    if (localStorage.getItem(lk) === "collapsed") document.body.setAttribute("data-sidebar-left", "collapsed");
    if (localStorage.getItem(rk) === "collapsed" || slug === "Verse-Chain") document.body.setAttribute("data-sidebar-right", "collapsed");
  } catch(e) {}
})();`
  SidebarCollapse.afterDOMLoaded = script

  return SidebarCollapse
}) satisfies QuartzComponentConstructor
