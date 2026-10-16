import { Onest } from "next/font/google";

// Onest covers Latin and Cyrillic. The direction sheet's Red Hat Display has no Cyrillic glyphs.
export const onest = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-onest",
});
