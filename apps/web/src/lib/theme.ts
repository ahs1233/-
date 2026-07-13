/**
 * محرّك المظهر — يبني متغيّرات CSS لكامل مقاييس الألوان من أربعة ألوانٍ مرساة
 * (نيليّ أساسيّ، ذهبيّ، سطح عاجيّ، أخضر حيّ) يضبطها الأدمن من لوحة المظهر،
 * ويوفّر قوالبَ جاهزة وفحص تباينٍ للوصول.
 */

export interface AppearanceColors {
  primary: string; // النيليّ (brand-700)
  accent: string; // الذهبيّ (gold-500)
  surface: string; // العاجيّ (sand-50)
  live: string; // الأخضر الحيّ (petrol)
}

export const DEFAULT_COLORS: AppearanceColors = {
  primary: "#1a2740",
  accent: "#c1974e",
  surface: "#f4ecd9",
  live: "#2e7d5b",
};

export interface ThemePreset {
  id: string;
  name: string;
  colors: AppearanceColors;
}

export const PRESETS: ThemePreset[] = [
  { id: "baghdad", name: "بغداديّ نيليّ", colors: { primary: "#1a2740", accent: "#c1974e", surface: "#f4ecd9", live: "#2e7d5b" } },
  { id: "night", name: "ليل السوق", colors: { primary: "#0f1b2d", accent: "#d4af37", surface: "#efe7d6", live: "#3f7d63" } },
  { id: "sumerian", name: "تركوازيّ سومريّ", colors: { primary: "#0a6e6e", accent: "#c08f2b", surface: "#f2efe4", live: "#2e7d5b" } },
  { id: "clay", name: "طينيّ دافئ", colors: { primary: "#3e2f21", accent: "#c1974e", surface: "#f3ead9", live: "#6b7d3e" } },
  { id: "date", name: "تمريّ", colors: { primary: "#2a1a12", accent: "#b8860b", surface: "#f5efe3", live: "#4e7c5a" } },
];

/* ── الأقسام والخدمات: مفاتيحُها المرجعيّة وتراتيبها الافتراضيّة ── */
export interface SectionCfg { key: string; visible: boolean; }
export type ServiceStatus = "active" | "beta" | "soon" | "hidden";
export interface ServiceCfg { key: string; status: ServiceStatus; visible?: boolean; soon?: boolean; }

/** حالات الخدمة الأربع بتسمياتها وألوانها (للوحة الإدارة). */
export const SERVICE_STATUS_META: Record<ServiceStatus, { label: string; dot: string; chip: string }> = {
  active: { label: "مُفعّل", dot: "bg-petrol", chip: "bg-petrol/10 text-petrol" },
  beta: { label: "تجريبيّ", dot: "bg-amber-400", chip: "bg-amber-100 text-amber-700" },
  soon: { label: "قريباً", dot: "bg-gold-500", chip: "bg-gold-100 text-gold-700" },
  hidden: { label: "مخفيّ", dot: "bg-neutral-400", chip: "bg-neutral-200 text-neutral-500" },
};
export const SERVICE_STATUS_ORDER: ServiceStatus[] = ["active", "beta", "soon", "hidden"];

/** يستنبط الحالة الرباعيّة من status أو رايتَي visible/soon القديمتَين. */
export function serviceStatusOf(s: { status?: ServiceStatus; visible?: boolean; soon?: boolean }): ServiceStatus {
  if (s.status) return s.status;
  if (s.visible === false) return "hidden";
  if (s.soon) return "soon";
  return "active";
}

export const SECTION_LABELS: Record<string, string> = {
  souks: "أسواق المحافظة",
  pulse: "نبض السوق",
  banner: "لافتة العروض",
  products: "المنتجات (تبويبات)",
  stores: "متاجر مميّزة",
  categories: "تسوّق حسب الفئة",
  // مفاتيح قديمة (تبقى مدعومة إن كانت محفوظة)
  services: "شبكة الخدمات",
  best_selling: "الأكثر شراءً",
  new: "وصل حديثاً",
  featured: "جهة موصى بها",
};

// الترتيب الافتراضيّ = رحلةٌ في المدينة (أسواق ← نبض ← عروض ← منتجات ← متاجر ← فئات).
export const DEFAULT_SECTIONS: SectionCfg[] = [
  "souks", "pulse", "banner", "products", "stores", "categories",
].map((key) => ({ key, visible: true }));

export const SERVICE_LABELS: Record<string, string> = {
  stores: "سوگ المتاجر",
  offers: "العروض",
  mutanabbi: "المتنبّي",
  restaurants: "المطاعم",
  veg: "الخضار",
  butchers: "القصابون",
  pharmacy: "الصيدليات",
  cafes: "المقاهي",
  oud: "دهن العود",
  delivery: "التوصيل",
  realestate: "العقارات",
  cars: "السيارات",
};

export const DEFAULT_SERVICES: ServiceCfg[] = [
  { key: "stores", status: "active" },
  { key: "offers", status: "active" },
  { key: "mutanabbi", status: "active" },
  { key: "restaurants", status: "soon" },
  { key: "veg", status: "soon" },
  { key: "butchers", status: "soon" },
  { key: "pharmacy", status: "soon" },
  { key: "cafes", status: "soon" },
  { key: "oud", status: "soon" },
  { key: "delivery", status: "soon" },
  { key: "realestate", status: "soon" },
  { key: "cars", status: "soon" },
];

export interface Appearance {
  colors: AppearanceColors;
  sections: SectionCfg[];
  services: ServiceCfg[];
  sectionTitles: Record<string, string>;
  serviceLabels: Record<string, string>;
}

export const DEFAULT_APPEARANCE: Appearance = {
  colors: DEFAULT_COLORS,
  sections: DEFAULT_SECTIONS,
  services: DEFAULT_SERVICES,
  sectionTitles: {},
  serviceLabels: {},
};

/* ── أدوات اللون ── */
function clampHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (c: number, target: number, t: number) => Math.round(c + (target - c) * t);
const lighten = (rgb: [number, number, number], t: number): [number, number, number] =>
  [mix(rgb[0], 255, t), mix(rgb[1], 255, t), mix(rgb[2], 255, t)];
const darken = (rgb: [number, number, number], t: number): [number, number, number] =>
  [mix(rgb[0], 0, t), mix(rgb[1], 0, t), mix(rgb[2], 0, t)];
const ch = (rgb: [number, number, number]) => `${rgb[0]} ${rgb[1]} ${rgb[2]}`;

const BRAND_STEPS: Record<string, number> = {
  50: 0.94, 100: 0.87, 200: 0.76, 300: 0.62, 400: 0.45, 500: 0.28, 600: 0.12, 700: 0, 800: -0.2, 900: -0.35,
};
const GOLD_STEPS: Record<string, number> = {
  50: 0.8, 100: 0.66, 200: 0.46, 300: 0.3, 400: 0.14, 500: 0, 600: -0.15, 700: -0.3,
};
const SAND_STEPS: Record<string, number> = { 50: 0, 100: -0.05, 200: -0.11, 300: -0.19 };

function rampVars(name: string, base: [number, number, number], steps: Record<string, number>): string {
  return Object.entries(steps)
    .map(([k, t]) => `--c-${name}-${k}:${ch(t >= 0 ? lighten(base, t) : darken(base, -t))};`)
    .join("");
}

/** يبني كتلة `selector{…}` من ألوان المظهر — تُحقَن في `:root` أو معاينةٍ مُنطاقة. */
export function buildThemeCss(colors: AppearanceColors, selector = ":root"): string {
  const primary = clampHex(colors.primary) ?? clampHex(DEFAULT_COLORS.primary)!;
  const accent = clampHex(colors.accent) ?? clampHex(DEFAULT_COLORS.accent)!;
  const surface = clampHex(colors.surface) ?? clampHex(DEFAULT_COLORS.surface)!;
  const live = clampHex(colors.live) ?? clampHex(DEFAULT_COLORS.live)!;
  return `${selector}{${rampVars("brand", primary, BRAND_STEPS)}${rampVars("gold", accent, GOLD_STEPS)}${rampVars("sand", surface, SAND_STEPS)}--c-petrol:${ch(live)};}`;
}

export function isValidHex(hex: string): boolean {
  return clampHex(hex) !== null;
}

/** نسبة التباين WCAG بين لونين (١..٢١). */
export function contrastRatio(hex1: string, hex2: string): number {
  const lum = (hex: string) => {
    const rgb = clampHex(hex);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(hex1);
  const l2 = lum(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
