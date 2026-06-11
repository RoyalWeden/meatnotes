import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [
    // ReadingProgress removed in Phase 2 — Apple sites don't use one and the
    // translucent toolbar provides enough sense of "where you are" on its own.
    Component.DesktopOnly(Component.Search()),
  ],
  afterBody: [
    Component.Tooltip(),
    Component.SidebarCollapse(),
    Component.Darkmode(),
    Component.MobileSettings(),
    // AccentPicker registers its before/afterDOMLoaded scripts (read saved
    // accent on first paint to avoid flash + wire click handlers on
    // [data-set-accent] swatches in Darkmode/MobileSettings).
    Component.AccentPicker(),
    // Phase 6.5: floating glass tab bar at the bottom of mobile viewports.
    // Hides scattered FABs and consolidates ☰ / ⌘K / Today / ⋯ into one bar.
    Component.MobileTabBar(),
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
    Component.ShortlinkButton(),
    Component.ConditionalRender({
      component: Component.FullSearch(),
      condition: (page) => page.fileData.slug === "Search",
    }),
    Component.ConditionalRender({
      component: Component.IdiomIndex(),
      condition: (page) => page.fileData.filePath?.includes("Bible Idioms") ?? false,
    }),
    Component.ConditionalRender({
      component: Component.PdfLibrary(),
      condition: (page) => page.fileData.slug === "Books-and-PDFs",
    }),
    Component.ConditionalRender({
      component: Component.VerseChainExplorer(),
      condition: (page) => page.fileData.slug === "Verse-Chain",
    }),
    Component.ConditionalRender({
      component: Component.BibleReader(),
      condition: (page) => page.fileData.slug === "Bible-Reader",
    }),
    Component.ConditionalRender({
      component: Component.PipelineDashboard(),
      condition: (page) => page.fileData.slug === "Dashboard",
    }),
    Component.ConditionalRender({
      component: Component.Graph(),
      condition: (page) => page.fileData.slug === "Graph",
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
    // Exclude hidden/system folders (dot-prefixed names like .octarine, .git, .obsidian)
    if (node.displayName.startsWith(".")) return false
    const cleaned = node.displayName.replace(/^\d+\s*[—–-]\s*/, "")
    return (
      !/^\d{4}-\d{2}-\d{2}$/.test(node.displayName) &&
      cleaned !== "Daily" &&
      cleaned !== "Search" &&
      node.displayName !== "All-Notes" &&
      node.displayName !== "All Notes" &&
      node.displayName !== "Books-and-PDFs" &&
      node.displayName !== "Books & PDFs" &&
      node.displayName !== "Verse-Chain" &&
      node.displayName !== "Verse Chain" &&
      node.displayName !== "Bible-Reader" &&
      node.displayName !== "Bible Reader" &&
      node.displayName !== "Dashboard" &&
      node.displayName !== "Graph"
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
      condition: (page) => page.fileData.slug !== "index" && page.fileData.slug !== "Search" && page.fileData.slug !== "Verse-Chain" && page.fileData.slug !== "Bible-Reader" && page.fileData.slug !== "Dashboard" && page.fileData.slug !== "Graph",
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => page.fileData.slug !== "Search" && page.fileData.slug !== "Verse-Chain" && page.fileData.slug !== "Bible-Reader" && page.fileData.slug !== "Dashboard" && page.fileData.slug !== "Graph",
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => page.fileData.slug !== "Search" && page.fileData.slug !== "Verse-Chain" && page.fileData.slug !== "Bible-Reader" && page.fileData.slug !== "Dashboard" && page.fileData.slug !== "Graph",
    }),
    // Daily-note Today button + Mon-Sun week strip; renders only on
    // /Daily/YYYY-MM-DD pages. Phase 9.5.
    Component.ConditionalRender({
      component: Component.DailyHeader(),
      condition: (page) => /^Daily\/\d{4}-\d{2}-\d{2}$/.test(page.fileData.slug ?? ""),
    }),
    Component.ConditionalRender({
      component: Component.TagList(),
      condition: (page) => page.fileData.slug !== "Search" && page.fileData.slug !== "Verse-Chain" && page.fileData.slug !== "Bible-Reader" && page.fileData.slug !== "Dashboard" && page.fileData.slug !== "Graph",
    }),
    Component.ConditionalRender({
      component: Component.RebukePanel(),
      condition: (page) =>
        ((page.fileData.frontmatter?.cssclasses as string[] | undefined) ?? []).includes("rebuke"),
    }),
    Component.ConditionalRender({
      component: Component.IdiomFlashcard(),
      condition: (page) =>
        ((page.fileData.frontmatter?.cssclasses as string[] | undefined) ?? []).includes("idiom"),
    }),
    Component.ConditionalRender({
      component: Component.MobileOnly(Component.TableOfContents()),
      condition: (page) =>
        page.fileData.slug !== "Search" &&
        !((page.fileData.frontmatter?.cssclasses as string[] | undefined) ?? []).includes("rebuke"),
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.MobileOnly(Component.Search()),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.ExplorerTopLinks(),
    Component.Explorer(explorerConfig),
  ],
  right: [
    // Graph moved to its own dedicated /Graph page (Phase 11). The right-rail
    // Graph was visually noisy on every note page; the dedicated page lets the
    // graph use the full viewport with its zoom/pan controls.
    Component.ConditionalRender({
      component: Component.DesktopOnly(Component.TableOfContents()),
      condition: (page) =>
        !((page.fileData.frontmatter?.cssclasses as string[] | undefined) ?? []).includes("rebuke"),
    }),
    Component.Backlinks(),
    Component.ConditionalRender({
      component: Component.TopicalChain(),
      condition: (page) =>
        page.fileData.slug !== "index" &&
        page.fileData.slug !== "Search" &&
        page.fileData.slug !== "Verse-Chain" &&
        page.fileData.slug !== "Bible-Reader" &&
        page.fileData.slug !== "Dashboard" &&
        page.fileData.slug !== "All-Notes" &&
        page.fileData.slug !== "Books-and-PDFs" &&
        page.fileData.slug !== "Graph",
    }),
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
    Component.ConditionalRender({
      component: Component.RecentIdioms(),
      condition: (page) => page.fileData.filePath?.includes("Bible Idioms") ?? false,
    }),
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.MobileOnly(Component.Search()),
    Component.DesktopOnly(Component.DailyCalendar()),
    Component.ExplorerTopLinks(),
    Component.Explorer(explorerConfig),
  ],
  right: [
    // Graph removed from list-page right rail; lives at the dedicated /Graph
    // page (Phase 11). FolderRecentNotes stays as the only right-rail item
    // on folder/tag list pages.
    Component.DesktopOnly(Component.FolderRecentNotes({ limit: 6 })),
  ],
}