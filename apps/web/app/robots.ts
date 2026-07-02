import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://one-theta-81.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // مسارات خاصة/حسّاسة لا معنى لفهرستها
        disallow: ["/api/", "/admin", "/vendor", "/account", "/cart", "/checkout", "/orders", "/notifications", "/login"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
