/**
 * محرّك المظهر — يبني متغيّرات CSS لكامل مقاييس الألوان من ثلاثة ألوانٍ مرساة
 * (الأساسيّ النيليّ، اللمسة الذهبيّة، سطح عاجيّ) يعدّلها الأدمن من لوحة المظهر.
 */

export interface AppearanceColors {
  primary: string; // النيليّ (brand-700)
  accent: string; // الذهبيّ (gold-500)
  surface: string; // العاجيّ (sand-50)
}

export const DEFAULT_COLORS: AppearanceColors = {
  primary: "#1a2740",
  accent: "#c1974e",
  surface: "#f4ecd9",
};

export const DEFAULT_HOME_ORDER = [
  "services",
  "souks",
  "pulse",
  "banner",
  "best_selling",
  "new",
  "stores",
  "featured",
  "categories",
] as const;
export type HomeSectionKey = (typeof DEFAULT_HOME_ORDER)[number];

export interface Appearance {
  colors: AppearanceColors;
  homeOrder: string[];
}

export const DEFAULT_APPEARANCE: Appearance = {
  colors: DEFAULT_COLORS,
  homeOrder: [...DEFAULT_HOME_ORDER],
};

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

// خطوات الاشتقاق لكلّ مقياس (نسبة تفتيح موجبة / تغميق سالب حول اللون المرساة).
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

/** يبني كتلة `selector{…}` من ألوان المظهر — تُحقَن في التخطيط (‏:root) أو معاينةٍ مُنطاقة. */
export function buildThemeCss(colors: AppearanceColors, selector = ":root"): string {
  const primary = clampHex(colors.primary) ?? clampHex(DEFAULT_COLORS.primary)!;
  const accent = clampHex(colors.accent) ?? clampHex(DEFAULT_COLORS.accent)!;
  const surface = clampHex(colors.surface) ?? clampHex(DEFAULT_COLORS.surface)!;
  return `${selector}{${rampVars("brand", primary, BRAND_STEPS)}${rampVars("gold", accent, GOLD_STEPS)}${rampVars("sand", surface, SAND_STEPS)}}`;
}

export function isValidHex(hex: string): boolean {
  return clampHex(hex) !== null;
}
