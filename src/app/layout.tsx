import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GridBackground } from "@/components/GridBackground";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GoogleTagManager } from "@/components/GoogleTagManager";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.pitchinpublic.io").replace(/\/$/, "");
const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
const siteName = "Pitch in Public";
const siteTitle = "Pitch in Public | Daily pitch practice";
const siteDescription =
  "Mobile-first pitch practice for founders. Record your pitch, get constructive feedback, and sharpen your best take.";
const brandKeywords = [
  "pitch practice",
  "founder pitch",
  "startup pitch",
  "elevator pitch",
  "founder feedback",
  "pitch competition",
  "startup events",
  "build in public",
  "founder community",
  "daily pitch practice",
];
const ogImages = [
  {
    url: `${appUrl}/og-pip-v2.png`,
    width: 1200,
    height: 630,
    alt: "Pitch in Public - Sharpen Your Pitch",
  },
  {
    url: `${appUrl}/og-square-v2.png`,
    width: 1200,
    height: 1200,
    alt: "Pitch in Public - Daily 60-second pitch practice for founders",
  },
];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#05070A",
};

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  applicationName: siteName,
  keywords: brandKeywords,
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "business",
  classification: "Founder pitch practice and constructive startup feedback",
  metadataBase: new URL(appUrl),
  alternates: {
    canonical: appUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pitch in Public",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: appUrl,
    title: siteTitle,
    description: siteDescription,
    siteName,
    images: ogImages,
    locale: "en_US",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
    "theme-color": "#05070A",
    "color-scheme": "dark",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: `${appUrl}/og-pip-v2.png`,
        alt: "Pitch in Public - Sharpen Your Pitch",
      },
    ],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteName,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: appUrl,
  image: `${appUrl}/og-pip-v2.png`,
  description: siteDescription,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Founders, startup builders, pitch competition organizers, and founder communities",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full bg-background">
      <body
        className="h-full min-h-screen overflow-x-hidden bg-background font-body text-slate-100 antialiased"
      >
        <GoogleTagManager gtmId={gtmId} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <GridBackground />
        <ErrorBoundary>
          <AuthProvider>
            <main className="relative z-10 min-h-screen bg-transparent">{children}</main>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
