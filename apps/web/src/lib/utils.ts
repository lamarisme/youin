import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "ui-2xs",
            "ui-xs",
            "ui-sm",
            "ui-md",
            "ui-lg",
            "title-sm",
            "title-md",
            "title-lg",
            "editorial",
            "editorial-hero",
            "editorial-md",
            "eyebrow",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
