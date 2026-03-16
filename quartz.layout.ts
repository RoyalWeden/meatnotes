import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.ReadingProgress()],
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
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.DesktopOnly(Component.PageTitle()),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
        { Component: Component.DesktopOnly(Component.Darkmode()) },
        { Component: Component.DesktopOnly(Component.ReaderMode()) },
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

// components for pages that display lists of pages (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.DesktopOnly(Component.PageTitle()),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
        { Component: Component.DesktopOnly(Component.Darkmode()) },
      ],
    }),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.Explorer(explorerConfig),
  ],
  right: [],
}