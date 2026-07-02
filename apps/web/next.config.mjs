import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const isDev = process.env.NODE_ENV !== "production";

// سياسة أمان المحتوى (CSP). Next يحقن سكربتات/أنماط inline للترطيب، لذا نسمح بها.
// في التطوير نسمح بـ eval و websockets لعمل HMR.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' https:${isDev ? " ws: wss:" : ""}`,
  "manifest-src 'self'",
  "worker-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // إخراج مستقل (standalone) لصورة Docker صغيرة
  output: "standalone",
  // ينسخ محرّك Prisma بجانب حزمة الخادم (إصلاح monorepo على Vercel/Lambda)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
  // حزم الـ monorepo الداخلية تُترجم مباشرة من مصدر TS (بلا خطوة بناء منفصلة)
  transpilePackages: [
    "@al-souq/api",
    "@al-souq/auth",
    "@al-souq/db",
    "@al-souq/domain",
    "@al-souq/i18n",
    "@al-souq/storage",
    "@al-souq/ui",
    "@al-souq/utils",
    "@al-souq/validators",
  ],
  experimental: {
    // Prisma وحزم الخادم لا تُجمَّع ضمن حزمة المتصفح
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "web-push"],
  },
  images: {
    // مصدر الصور مقيَّد بمضيف التخزين/الـ CDN فقط (بدل فتحه لأي مضيف).
    remotePatterns: process.env.NEXT_PUBLIC_IMAGE_HOST
      ? [{ protocol: "https", hostname: process.env.NEXT_PUBLIC_IMAGE_HOST }]
      : [],
  },
};

export default nextConfig;
