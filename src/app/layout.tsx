import type { Metadata } from "next";
import { Inter, Special_Elite, Rye, Caveat } from "next/font/google";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const specialElite = Special_Elite({
  weight: "400",
  variable: "--font-special-elite",
  subsets: ["latin"],
});

const rye = Rye({
  weight: "400",
  variable: "--font-rye",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-sketch",
  subsets: ["latin"],
});

const faviconSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
  "<text x='50' y='72' font-size='72' text-anchor='middle'>🎨</text>" +
  "</svg>";

export const metadata: Metadata = {
  title: "Emoji Pictionary",
  description: "Draw with emoji, guess with friends — real-time multiplayer Pictionary.",
  icons: {
    icon: `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${specialElite.variable} ${rye.variable} ${caveat.variable} h-full antialiased`}
    >
      <body
        data-theme="studio"
        className="min-h-full flex flex-col font-sans transition-colors duration-500"
      >
        <header className="w-full flex justify-end p-4 absolute top-0 right-0 z-50">
          <HeaderAuth />
        </header>
        <div className="flex-1 pt-12">{children}</div>
        <footer className="gutter py-3 text-center text-[11px] text-muted-foreground">
          Posters and cover art via{' '}
          <a href="https://en.wikipedia.org" className="underline" target="_blank" rel="noreferrer">
            Wikipedia
          </a>
          , used for identification only.
        </footer>
      </body>
    </html>
  );
}
