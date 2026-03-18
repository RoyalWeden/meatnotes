import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative, FullSlug } from "../util/path"
import style from "./styles/homeSections.scss"
import { classNames } from "../util/lang"

const sections = [
  {
    emoji: "📥",
    label: "Capture",
    folderPrefix: "00-—-Capture",
    description: "Raw topics and sources being gathered",
  },
  {
    emoji: "📖",
    label: "In Progress",
    folderPrefix: "10-—-In-Progress",
    description: "Studies currently being developed",
  },
  {
    emoji: "✅",
    label: "Complete",
    folderPrefix: "20-—-Complete",
    description: "Finished, teachable study notes",
  },
  {
    emoji: "✉️",
    label: "Copy-Paste Rebukes",
    folderPrefix: "Copy-Paste-Rebukes",
    description: "Ready-to-use scripture rebukes by topic",
  },
]

const HomeSections: QuartzComponent = ({ allFiles, fileData, displayClass }: QuartzComponentProps) => {
  let total = 0
  const counts = sections.map(({ folderPrefix }) => {
    const count = allFiles.filter((f) => f.slug?.startsWith(folderPrefix + "/")).length
    total += count
    return count
  })

  return (
    <div class={classNames(displayClass, "home-sections")}>
      <p class="site-description">
        Working study notes from{" "}
        <a href="https://straitisthegate.net" target="_blank" rel="noopener" class="site-ref-link">
          Straitisthegate.net
        </a>{" "}
        — organized by topic and study status.
      </p>
      <h2>Sections</h2>
      <table class="sections-table">
        <thead>
          <tr>
            <th></th>
            <th>Section</th>
            <th class="count-col">Notes</th>
            <th class="desc-col">What's in it</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(({ emoji, label, folderPrefix, description }, i) => (
            <tr>
              <td>{emoji}</td>
              <td>
                <a href={resolveRelative(fileData.slug!, folderPrefix as FullSlug)} class="internal">
                  {label}
                </a>
              </td>
              <td class="count-col">{counts[i]}</td>
              <td class="desc-col">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="sections-total">{total} notes total</p>
      <p class="today-link-wrap">
        <a id="today-daily-link" href="#" class="internal">📅 Today's Daily Note</a>
      </p>
    </div>
  )
}

HomeSections.css = style

HomeSections.afterDOMLoaded = `
(function() {
  function updateTodayLink() {
    var el = document.getElementById('today-daily-link')
    if (!el) return
    var d = new Date()
    var pad = function(n) { return String(n).padStart(2, '0') }
    var slug = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    el.href = '/Daily/' + slug
  }
  updateTodayLink()
  document.addEventListener('nav', updateTodayLink)
})()
`

export default (() => HomeSections) satisfies QuartzComponentConstructor
