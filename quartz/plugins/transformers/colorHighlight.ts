import { QuartzTransformerPlugin } from "../types"

const emojiStyles: Record<string, { bg: string; color: string }> = {
  "🔴": { bg: "#ffb3b3", color: "#7a0000" },
  "🟠": { bg: "#ffd4a8", color: "#7a3500" },
  "🟡": { bg: "#fff0a8", color: "#7a6000" },
  "🟢": { bg: "#b8f0c8", color: "#0a5c2a" },
  "🔵": { bg: "#b8d8f8", color: "#0a3a6e" },
  "🟣": { bg: "#e0b8f8", color: "#4a0a7a" },
  "🟤": { bg: "#ddc4a8", color: "#4a2a00" },
  "🩷": { bg: "#ffc8dc", color: "#7a0040" },
}

const emojiPattern = Object.keys(emojiStyles).join("|")
const regex = new RegExp(`==(${emojiPattern})([^=]+)==`, "gu")

export const ColorHighlight: QuartzTransformerPlugin = () => {
  return {
    name: "ColorHighlight",
    textTransform(_ctx, src) {
      return src.replace(regex, (_match, emoji, text) => {
        const { bg, color } = emojiStyles[emoji]
        return `<mark style="background-color: ${bg}; color: ${color}">${text}</mark>`
      })
    },
  }
}