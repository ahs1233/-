import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
