import { Onest, Source_Serif_4 } from "next/font/google";

// Текст и интерфейс: Onest, в нём есть кириллица.
export const onest = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-onest",
});

// Заголовки: антиква с кириллицей, как у учебных платформ вроде Brilliant.
export const serif = Source_Serif_4({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-serif",
});
