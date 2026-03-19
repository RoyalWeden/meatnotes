import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [
    Component.ReadingProgress(),
    Component.DesktopOnly(Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    })),
  ],
  afterBody: [
    Component.DailyNoteNav(),
    Component.ConditionalRender({
      component: Component.HomeSections(),
      condition: (page) => page.fileData.slug === "index",
    }),
    Component.ConditionalRender({
      component: Component.AllNotesContent(),
      condition: (page) => page.fileData.slug === "All-Notes",
    }),
    Component.BackToTop(),
    Component.ConditionalRender({
      component: Component.FullSearch(),
      condition: (page) => page.fileData.slug === "Search",
    }),
  ],
  footer: Component.CustomFooter({
    links: {
      "Main Website": "https://straitisthegate.net",
      Zoom: "https://zoom.us/j/8858934548?pwd=144",
      "Video Search Tool": "https://straitisthegatesearch.netlify.app/",
      "Notes Search Tool": "https://straitisthegatex.net/",
      "Iron Sharpener": "https://andrewrepent.github.io/sharpen-iron/",
    },
  }),
}

const explorerConfig = {
  filterFn: (node: any) => {
    const cleaned = node.displayName.replace(/^\d+\s*[—–-]\s*/, "")
    return (
      !/^\d{4}-\d{2}-\d{2}$/.test(node.displayName) &&
      cleaned !== "Daily" &&
      cleaned !== "Search" &&
      node.displayName !== "All-Notes" &&
      node.displayName !== "All Notes"
    )
  },
  mapFn: (node: any) => {
    node.displayName = node.displayName.replace(/^\d+\s*[—–-]\s*/, "")
  },
  sortFn: (a: any, b: any) => {
    const priority: Record<string, number> = {
      "Capture": 0,
      "In Progress": 1,
      "Complete": 2,
      "Copy-Paste Rebukes": 3,
    }
    const aP = priority[a.displayName] ?? 99
    const bP = priority[b.displayName] ?? 99
    if (aP !== bP) return aP - bP
    return a.displayName.localeCompare(b.displayName)
  },
}

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index" && page.fileData.slug !== "Search",
    }),
    Component.ArticleTitle(),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => page.fileData.slug !== "Search",
    }),
    Component.ConditionalRender({
      component: Component.TagList(),
      condition: (page) => page.fileData.slug !== "Search",
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.TableOfContents()),
      condition: (page) => page.fileData.slug !== "Search",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.MobileOnly(Component.Search()), grow: true },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.ExplorerTopLinks(),
    Component.Explorer(explorerConfig),
  ],
  right: [
    Component.ConditionalRender({
      component: Component.Graph(),
      condition: (page) => page.fileData.slug !== "Search" && page.fileData.slug !== "index",
    }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
    Component.ConditionalRender({
      component: Component.RecentNotes({
        title: "Recently Updated",
        limit: 5,
        showTags: false,
        filter: (f) =>
          !f.slug?.startsWith("Daily/") &&
          f.slug !== "index" &&
          f.slug !== "Search" &&
          f.slug !== "All-Notes",
      }),
      condition: (page) => page.fileData.slug === "index" || page.fileData.slug === "All-Notes",
    }),
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        { Component: Component.MobileOnly(Component.Search()), grow: true },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.ExplorerTopLinks(),
    Component.Explorer(explorerConfig),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.FolderRecentNotes({ limit: 6 })),
  ],
}