import { QuartzEmitterPlugin } from "../types"
import { joinSegments, FilePath } from "../../util/path"
import fs from "fs"

export const BuildTime: QuartzEmitterPlugin = () => {
  return {
    name: "BuildTime",
    getQuartzComponents() { return [] },
    async emit(ctx, _content, _resources) {
      const outputDir = ctx.argv.output
      await fs.promises.mkdir(outputDir, { recursive: true })
      const data = JSON.stringify({ builtAt: new Date().toISOString() })
      await fs.promises.writeFile(joinSegments(outputDir, "buildTime.json"), data)
      return ["buildTime.json" as FilePath]
    },
  }
}