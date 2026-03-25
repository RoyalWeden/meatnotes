import fs from "fs"
import path from "path"
import { QuartzTransformerPlugin } from "../types"

export const SyncStamp: QuartzTransformerPlugin = () => {
  return {
    name: "SyncStamp",
    markdownPlugins(ctx) {
      return [
        () => {
          const stampPath = path.join(ctx.argv.directory, ".last-sync")
          let syncDate: Date | undefined
          try {
            const content = fs.readFileSync(stampPath, "utf-8").trim()
            const parsed = new Date(content)
            if (!isNaN(parsed.getTime())) syncDate = parsed
          } catch {
            // .last-sync doesn't exist yet — fall through, keep per-file dates
          }

          return async (_tree, file) => {
            if (syncDate && file.data.dates) {
              file.data.dates.modified = syncDate
            }
          }
        },
      ]
    },
  }
}
