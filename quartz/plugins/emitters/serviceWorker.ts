// Emit the service worker at site root so it can control the whole origin.
//
// Service-worker registration scope is determined by the SW file's URL path.
// A SW served from /static/sw.js can only control /static/* by default.
// To control the whole site (cache HTML pages, not just CSS/JS), the file
// must live at /sw.js. Quartz's Static plugin emits everything from
// quartz/static/ to /static/* — there's no built-in way to copy a single
// file to root, so this emitter does that.

import fs from "fs"
import path from "path"
import { QuartzEmitterPlugin } from "../types"
import { joinSegments, FilePath, QUARTZ } from "../../util/path"

export const ServiceWorker: QuartzEmitterPlugin = () => {
  return {
    name: "ServiceWorker",
    getQuartzComponents() {
      return []
    },
    async emit(ctx, _content, _resources) {
      const outputDir = ctx.argv.output
      const sourcePath = path.join(QUARTZ, "static", "sw.js")
      const destPath = path.join(outputDir, "sw.js")

      try {
        const content = await fs.promises.readFile(sourcePath, "utf-8")
        await fs.promises.mkdir(outputDir, { recursive: true })
        await fs.promises.writeFile(destPath, content)
        return ["sw.js" as FilePath]
      } catch (err) {
        console.warn(`[ServiceWorker emitter] could not emit sw.js: ${err}`)
        return []
      }
    },
  }
}
