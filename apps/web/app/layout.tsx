import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { DEFAULT_LOCALE, getDir } from "@al-souq/i18n";
import { Providers } from "./providers";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "السوگ — سوق العراق", template: "%s | السوگ" },
  description: "منصة تسوّق عراقية تجمع التجار وبائعي السوشيال ميديا في مكان واحد، مع الدفع عند الاستلام.",
  manifest: "/manifest.webmanifest",
  applicationName: "السوگ",
  appleWebApp: { capable: true, title: "السوگ", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0fa3a3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const dir = getDir(DEFAULT_LOCALE);
  return (
    <html lang={DEFAULT_LOCALE} dir={dir} className={tajawal.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
