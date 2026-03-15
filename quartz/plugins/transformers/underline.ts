import { QuartzTransformerPlugin } from "../types"

export const Underline: QuartzTransformerPlugin = () => {
  return {
    name: "Underline",
    textTransform(_ctx, src) {
      // Triple tilde = strikethrough + underline (must come first)
      src = src.replace(/~~~([^~\n]+?)~~~/g, "<del><ins>$1</ins></del>")
      // Single tilde = underline only
      src = src.replace(/(?<!~)~(?!~)([^~\n]+?)~(?!~)/g, "<ins>$1</ins>")
      return src
    },
  }
}