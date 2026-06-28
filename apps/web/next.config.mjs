/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // حزم الـ monorepo الداخلية تُترجم مباشرة من مصدر TS (بلا خطوة بناء منفصلة)
  transpilePackages: [
    "@al-souq/api",
    "@al-souq/auth",
    "@al-souq/db",
    "@al-souq/domain",
    "@al-souq/i18n",
    "@al-souq/ui",
    "@al-souq/utils",
    "@al-souq/validators",
  ],
  experimental: {
    // Prisma وحزم الخادم لا تُجمَّع ضمن حزمة المتصفح
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
