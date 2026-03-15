import { QuartzTransformerPlugin } from "../types"

const imageExtensions = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff|tif|avif|heic|heif)$/i

export const ImageLinks: QuartzTransformerPlugin = () => {
  return {
    name: "ImageLinks",
    textTransform(_ctx, src) {
      return src.replace(/\[\[([^\]]+)\]\]/g, (match, filename) => {
        if (imageExtensions.test(filename.split("|")[0].trim())) {
          return "!" + match
        }
        return match
      })
    },
  }
}