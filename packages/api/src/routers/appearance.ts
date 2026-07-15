/**
 * راوتر المظهر — قراءةٌ عامّة لثيم التطبيق ومحتواه الذي يضبطه الأدمن من لوحة
 * «المظهر»:
 *   • get       → ألوان + أقسام + خدمات + تجاوزات العناوين/التسميات (للثيم والترتيب).
 *   • content   → عرض المحافظة الحاليّة (شعور/بطل/أسواق) + الإعلانات الفعّالة.
 * التعديل كلّه في راوتر admin (صلاحية settings).
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export interface SectionCfg {
  key: string;
  visible: boolean;
}
export type ServiceStatus = "active" | "beta" | "soon" | "hidden";
export interface ServiceCfg {
  key: string;
  visible: boolean;
  soon: boolean;
  status: ServiceStatus;
}

/** يستنبط الحالة الرباعيّة الرسميّة من status أو من رايتَي visible/soon القديمتَين. */
export function normalizeServiceStatus(s: { visible?: boolean; soon?: boolean; status?: string }): ServiceStatus {
  if (s.status === "active" || s.status === "beta" || s.status === "soon" || s.status === "hidden") return s.status;
  if (s.visible === false) return "hidden";
  if (s.soon) return "soon";
  return "active";
}
export interface Appearance {
  colors: { primary: string; accent: string; surface: string; live: string };
  sections: SectionCfg[];
  services: ServiceCfg[];
  sectionTitles: Record<string, string>;
  serviceLabels: Record<string, string>;
}

// التخطيط الموحّد لأيّ سوق: الأقسام ← الإعلانات ← المتاجر ← أفضل المنتجات ← أفضل المتاجر ← النبض.
const DEFAULT_SECTION_KEYS = ["categories", "banner", "stores", "products", "top_stores", "pulse"];
// مفاتيح تخطيطاتٍ قديمة — وجودها يعني أنّ الإعداد المحفوظ سابقٌ للتخطيط الجديد (يُرقَّى تلقائياً).
const LEGACY_SECTION_KEYS = new Set(["services", "best_selling", "new", "featured", "souks"]);

const DEFAULTS: Appearance = {
  colors: { primary: "#1a2740", accent: "#c1974e", surface: "#f4ecd9", live: "#2e7d5b" },
  sections: DEFAULT_SECTION_KEYS.map((key) => ({ key, visible: true })),
  services: [
    { key: "stores", soon: false },
    { key: "offers", soon: false },
    { key: "mutanabbi", soon: false },
    { key: "restaurants", soon: true },
    { key: "veg", soon: true },
    { key: "butchers", soon: true },
    { key: "pharmacy", soon: true },
    { key: "cafes", soon: true },
    { key: "oud", soon: true },
    { key: "delivery", soon: true },
    { key: "realestate", soon: true },
    { key: "cars", soon: true },
  ].map((s) => ({ ...s, visible: true, status: (s.soon ? "soon" : "active") as ServiceStatus })),
  sectionTitles: {},
  serviceLabels: {},
};

/* ── أنواع محتوى المحافظة والإعلانات (تُستهلَك في الرئيسية) ── */
export interface SoukTile {
  label: string;
  q: string;
  img?: string;
  emoji?: string;
  color?: string;
  status?: "active" | "hidden";
}
export interface GovPresentation {
  tagline: string | null;
  heroImageUrl: string | null;
  souks: SoukTile[] | null;
  enabled: boolean;
}
export interface AdItem {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string;
  placement: string;
}
export interface AppContent {
  governorate: GovPresentation | null;
  ads: AdItem[];
}

export const appearanceRouter = router({
  get: publicProcedure.query(async ({ ctx }): Promise<Appearance> => {
    const row = await ctx.prisma.platformSetting.findUnique({ where: { key: "appearance" } });
    const v = row?.value as Record<string, unknown> | undefined;
    if (!v || typeof v !== "object") return DEFAULTS;

    // ترحيل توافقيّ: صيغة قديمة كانت تحمل homeOrder + ألوان بلا live.
    const colors =
      v.colors && typeof v.colors === "object"
        ? { ...DEFAULTS.colors, ...(v.colors as object) }
        : DEFAULTS.colors;

    let sections = DEFAULTS.sections;
    if (Array.isArray(v.sections) && v.sections.length) {
      const stored = v.sections as SectionCfg[];
      // ترحيلٌ تلقائيّ: إعدادٌ محفوظٌ بمفاتيح التخطيط القديم يُرقَّى إلى رحلة المدينة الجديدة.
      const isLegacy = stored.some((s) => LEGACY_SECTION_KEYS.has(s.key));
      sections = isLegacy ? DEFAULTS.sections : stored;
    } else if (Array.isArray(v.homeOrder) && v.homeOrder.length) {
      sections = (v.homeOrder as string[]).map((key) => ({ key, visible: true }));
    }

    // تطبيع الخدمات إلى الحالة الرباعيّة الرسميّة (مع الحفاظ على visible/soon للتوافق).
    const rawServices =
      Array.isArray(v.services) && v.services.length
        ? (v.services as { key: string; visible?: boolean; soon?: boolean; status?: string }[])
        : DEFAULTS.services;
    const services: ServiceCfg[] = rawServices.map((s) => {
      const status = normalizeServiceStatus(s);
      return { key: s.key, status, visible: status !== "hidden", soon: status === "soon" };
    });

    const sectionTitles =
      v.sectionTitles && typeof v.sectionTitles === "object" ? (v.sectionTitles as Record<string, string>) : {};
    const serviceLabels =
      v.serviceLabels && typeof v.serviceLabels === "object" ? (v.serviceLabels as Record<string, string>) : {};

    return { colors, sections, services, sectionTitles, serviceLabels };
  }),

  /** عرض المحافظة الحاليّة + الإعلانات الفعّالة لها (وللعراق كلّه). */
  content: publicProcedure
    .input(z.object({ governorateId: z.string().optional() }).optional())
    .query(async ({ ctx, input }): Promise<AppContent> => {
      const govId = input?.governorateId;
      const now = new Date();

      const [gov, ads] = await Promise.all([
        govId
          ? ctx.prisma.governorate.findUnique({
              where: { id: govId },
              select: { tagline: true, heroImageUrl: true, souks: true, enabled: true },
            })
          : Promise.resolve(null),
        ctx.prisma.ad.findMany({
          where: {
            active: true,
            // إعلانات هذه المحافظة + الإعلانات العامّة (كلّ العراق).
            OR: [{ governorateId: govId ?? undefined }, { governorateId: null }],
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: 8,
          select: { id: true, title: true, subtitle: true, imageUrl: true, linkUrl: true, placement: true },
        }),
      ]);

      const souks = (gov?.souks as SoukTile[] | null) ?? null;
      return {
        governorate: gov
          ? {
              tagline: gov.tagline,
              heroImageUrl: gov.heroImageUrl,
              // نُخفي الأسواق ذات الحالة "hidden" عن الواجهة.
              souks: souks ? souks.filter((s) => s.status !== "hidden") : null,
              enabled: gov.enabled,
            }
          : null,
        ads,
      };
    }),
});
