import { PrismaClient } from "@prisma/client";

/**
 * Singleton لعميل Prisma — يمنع استنزاف اتصالات قاعدة البيانات أثناء
 * إعادة التحميل الساخن في التطوير (Next.js يعيد تقييم الوحدات).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// إعادة تصدير الأنواع والـ enums لاستهلاكها في الطبقات الأخرى
export * from "@prisma/client";
export { Prisma } from "@prisma/client";
