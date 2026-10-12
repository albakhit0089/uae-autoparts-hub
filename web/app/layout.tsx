import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DemoBanner, Footer, Header } from "@/components/shell";
import { SITE_URL } from "@/lib/site";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-ar", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UAE AutoParts Hub — Used car spare parts in the UAE | قطع غيار سيارات مستعملة الإمارات",
    template: "%s | UAE AutoParts Hub",
  },
  description:
    "Search used car spare parts from scrapyards, dismantlers and licensed suppliers across Sharjah, Dubai, Abu Dhabi and all UAE emirates. Compare prices in AED and contact suppliers on WhatsApp. ابحث عن قطع غيار سيارات مستعملة في الإمارات.",
  keywords: [
    "used car spare parts UAE", "used Mercedes parts Sharjah", "Toyota used spare parts Dubai", "used engines UAE", "used gearbox Sharjah",
    "قطع غيار سيارات مستعملة الإمارات", "قطع غيار مرسيدس مستعملة الشارقة",
  ],
  alternates: { canonical: "/", languages: { en: "/", ar: "/" } },
  openGraph: { type: "website", siteName: "UAE AutoParts Hub", locale: "en_AE", alternateLocale: ["ar_AE"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15254f" },
    { media: "(prefers-color-scheme: dark)", color: "#070f24" },
  ],
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "UAE AutoParts Hub",
  url: SITE_URL,
  inLanguage: ["en", "ar"],
  potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/search/?q={query}`, "query-input": "required name=query" },
};

// Applies saved theme/language before paint to avoid a flash.
const bootScript = `try{var t=localStorage.getItem('uaeph-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');var l=localStorage.getItem('uaeph-lang');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl'}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${jakarta.variable} ${plexAr.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </head>
      <body className="min-h-screen">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
          <DemoBanner />
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
