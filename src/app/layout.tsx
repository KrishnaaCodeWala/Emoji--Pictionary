import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
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
