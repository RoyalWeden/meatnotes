import { FullSlug, joinSegments, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"
import { VFile } from "vfile"
import { computeShortlinkId } from "../../util/shortlink"

async function* processFile(ctx: BuildCtx, file: VFile) {
  const cfg = ctx.cfg.configuration
  const slug = simplifySlug(file.data.slug!)
  if (slug === "404") return

  const manualId = file.data.frontmatter?.shortlink as string | undefined
  const id = computeShortlinkId(slug, manualId)

  const base = cfg.baseUrl ?? "example.com"
  const pageUrl = `https://${base}/${slug}`
  const pageTitle = (file.data.frontmatter?.title as string) ?? slug

  const redirectSlug = joinSegments("s", id) as FullSlug

  yield write({
    ctx,
    content: `<!DOCTYPE html>
<html lang="en-us">
<head>
<title>${pageTitle}</title>
<link rel="canonical" href="${pageUrl}">
<meta name="robots" content="noindex">
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${pageUrl}">
</head>
</html>`,
    slug: redirectSlug,
    ext: ".html",
  })

  // If a manual shortlink ID was provided, also emit the auto-generated hash redirect
  // so both /s/custom and /s/hash work
  if (manualId?.trim()) {
    const hashId = computeShortlinkId(slug)
    if (hashId !== id) {
      const hashSlug = joinSegments("s", hashId) as FullSlug
      yield write({
        ctx,
        content: `<!DOCTYPE html>
<html lang="en-us">
<head>
<title>${pageTitle}</title>
<link rel="canonical" href="${pageUrl}">
<meta name="robots" content="noindex">
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${pageUrl}">
</head>
</html>`,
        slug: hashSlug,
        ext: ".html",
      })
    }
  }
}

export const ShortlinkRedirects: QuartzEmitterPlugin = () => ({
  name: "ShortlinkRedirects",
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      yield* processFile(ctx, file)
    }
  },
  async *partialEmit(ctx, _content, _resources, changeEvents) {
    for (const changeEvent of changeEvents) {
      if (!changeEvent.file) continue
      if (changeEvent.type === "add" || changeEvent.type === "change") {
        yield* processFile(ctx, changeEvent.file)
      }
    }
  },
})
