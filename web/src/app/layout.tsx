import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Nav } from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HalpingHand – Finde Hilfe für jede Aufgabe",
  description:
    "HalpingHand ist der Aufgaben-Marktplatz für Deutschland. Finde schnell und sicher Hilfe in deiner Stadt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1 flex flex-col">{children}</main>
          <footer className="border-t border-border mt-12 py-8 text-sm text-muted">
            <div className="container-page flex flex-col sm:flex-row items-center justify-between gap-4">
              <p>© {new Date().getFullYear()} HalpingHand – Demo/MVP-Projekt.</p>
              <div className="flex gap-4">
                <Link href="/impressum" className="hover:text-primary-dark">
                  Impressum
                </Link>
                <Link href="/datenschutz" className="hover:text-primary-dark">
                  Datenschutz
                </Link>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
