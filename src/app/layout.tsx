import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Source_Serif_4 } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { siteTitle } from "@/lib/brand-config";
import { Shell } from "@/components/shell";
import "../styles/tokens.css";
import "../styles/site.css";
import "../styles/base.css";
import "../styles/app.css";
import "./globals.css";
import "../styles/dialer.css";

const wordmarkSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-wordmark-serif",
});

const title = siteTitle();

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s · ${title}`,
  },
  description: "HubSpot power dialer with a live line on glass.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${wordmarkSerif.variable}`}
    >
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#315b75",
              colorBackground: "#ffffff",
              colorText: "#0b0e11",
              colorTextSecondary: "#5c646b",
              colorNeutral: "#e4e9ee",
              borderRadius: "10px",
              fontFamily: "var(--font-geist-sans)",
            },
          }}
        >
          <Shell>{children}</Shell>
        </ClerkProvider>
      </body>
    </html>
  );
}
