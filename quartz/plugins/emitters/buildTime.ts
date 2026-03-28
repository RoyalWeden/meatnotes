import { QuartzEmitterPlugin } from "../types"
import { joinSegments, FilePath } from "../../util/path"
import fs from "fs"
import { execSync } from "child_process"

function computeSiteVersion(): string {
  try {
    const exclude = "grep -Ev 'Quartz sync:|Auto-commit before sync'"
    const featCount =
      parseInt(
        execSync(`git log --oneline | ${exclude} | grep -c 'feat:' || echo 0`, {
          timeout: 5000,
        }).toString().trim(),
      ) || 0
    const fixCount =
      parseInt(
        execSync(`git log --oneline | ${exclude} | grep -c 'fix:' || echo 0`, {
          timeout: 5000,
        }).toString().trim(),
      ) || 0
    return `1.${featCount}.${fixCount}`
  } catch {
    return "1.0.0"
  }
}

export const BuildTime: QuartzEmitterPlugin = () => {
  return {
    name: "BuildTime",
    getQuartzComponents() { return [] },
    async emit(ctx, _content, _resources) {
      const outputDir = ctx.argv.output
      await fs.promises.mkdir(outputDir, { recursive: true })
      const data = JSON.stringify({
        builtAt: new Date().toISOString(),
        version: computeSiteVersion(),
      })
      await fs.promises.writeFile(joinSegments(outputDir, "buildTime.json"), data)
      return ["buildTime.json" as FilePath]
    },
  }
}