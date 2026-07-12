import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { DEFAULT_LOCALE, getDir } from "@al-souq/i18n";
import { Providers } from "./providers";
import { getServerApi } from "@/src/trpc/server";
import { buildThemeCss, DEFAULT_COLORS, type AppearanceColors } from "@/src/lib/theme";
import "./globals.css";

// ثيم المظهر من لوحة الإدارة — يُحقَن كمتغيّرات CSS فيتغيّر التطبيق كلّه حيّاً.
async function getThemeCss(): Promise<string> {
  try {
    const api = await getServerApi();
    const a = await api.appearance.get();
    return buildThemeCss(a.colors as AppearanceColors);
  } catch {
    return buildThemeCss(DEFAULT_COLORS);
  }
}

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
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2740",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dir = getDir(DEFAULT_LOCALE);
  const themeCss = await getThemeCss();
  return (
    <html lang={DEFAULT_LOCALE} dir={dir} className={tajawal.variable}>
      <head>
        <style id="app-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
