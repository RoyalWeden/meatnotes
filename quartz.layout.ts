import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [
    Component.ReadingProgress(),
    Component.MobileOnly(Component.Search()),
  ],
  afterBody: [
    Component.DailyNoteNav(),
    Component.BackToTop(),
  ],
  footer: Component.CustomFooter({
    links: {
      "Main Website": "https://straitisthegate.net",
      Zoom: "https://zoom.us/j/8858934548?pwd=144",
      "Video Search Tool": "https://straitisthegatesearch.netlify.app/",
      "Notes Search Tool": "https://straitisthegatex.net/",
      "Iron Sharpener": "Iron Sharpener",
    },
  }),
}

const explorerConfig = {
  filterFn: (node: any) => {
    return !/^\d{4}-\d{2}-\d{2}$/.test(node.displayName)
  },
  mapFn: (node: any) => {
    node.displayName = node.displayName.replace(/^\d+\s*[—–-]\s*/, "")
  },
}

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    Component.MobileOnly(Component.TableOfContents()),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.DesktopOnly(Component.Search()), grow: true },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.Explorer(explorerConfig),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.DesktopOnly(Component.Search()), grow: true },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.Explorer(explorerConfig),
  ],
  right: [],
}