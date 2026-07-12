/**
 * راوتر المظهر — قراءةٌ عامّة لثيم التطبيق (ألوان + ترتيب أقسام الرئيسية)
 * التي يضبطها الأدمن من لوحة «المظهر». التعديل في راوتر admin (صلاحية settings).
 */
import { router, publicProcedure } from "../trpc";

const DEFAULTS = {
  colors: { primary: "#1a2740", accent: "#c1974e", surface: "#f4ecd9" },
  homeOrder: ["services", "souks", "pulse", "banner", "best_selling", "new", "stores", "featured", "categories"],
};

export type Appearance = typeof DEFAULTS;

export const appearanceRouter = router({
  get: publicProcedure.query(async ({ ctx }): Promise<Appearance> => {
    const row = await ctx.prisma.platformSetting.findUnique({ where: { key: "appearance" } });
    const v = row?.value as Partial<Appearance> | undefined;
    if (!v || typeof v !== "object") return DEFAULTS;
    return {
      colors: { ...DEFAULTS.colors, ...(v.colors ?? {}) },
      homeOrder: Array.isArray(v.homeOrder) && v.homeOrder.length ? v.homeOrder : DEFAULTS.homeOrder,
    };
  }),
});
