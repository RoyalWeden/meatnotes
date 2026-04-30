import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Bible Notes",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "sitgmeat.com",
    ignorePatterns: ["private", "templates", ".obsidian", ".git", ".gitignore", ".templates", ".last-sync"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Inter",
        body: "Inter",
        code: "IBM Plex Mono",
      },
      colors: {
        // macOS / iOS system palette. Components consume var(--accent)
        // (defined in custom.scss) instead of --secondary going forward.
        // --secondary is kept for token compatibility and defaults to system blue.
        lightMode: {
          light: "#ffffff",
          lightgray: "#e5e5ea", // system gray 5
          gray: "#aeaeb2", // system gray 2
          darkgray: "#3c3c43", // system gray 1 (label)
          dark: "#1d1d1f", // apple.com near-black
          secondary: "#007aff", // system blue
          tertiary: "#5ac8fa", // system teal (link hover)
          highlight: "rgba(0, 122, 255, 0.10)",
          textHighlight: "#ffe58f88",
        },
        darkMode: {
          light: "#1c1c1e", // system background dark
          lightgray: "#2c2c2e", // grouped background dark
          gray: "#8e8e93", // system gray
          darkgray: "#ebebf0", // label dark
          dark: "#f5f5f7", // primary text dark
          secondary: "#0a84ff", // system blue dark
          tertiary: "#64d2ff", // system teal dark
          highlight: "rgba(10, 132, 255, 0.14)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest", openLinksInNewTab: true }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
      Plugin.Underline(),
      Plugin.ImageLinks(),
      Plugin.ColorHighlight(),
      Plugin.BibleLinks(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ShortlinkRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
      Plugin.BuildTime(),
      Plugin.PdfIndex(),
      Plugin.BibleVerseIndex(),
    ],
  },
}

export default config
