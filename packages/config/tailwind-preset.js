/**
 * Tailwind preset مشترك — يبني على design-tokens ويضيف دعم RTL.
 * تستورده تطبيقات الويب عبر `presets: [require('@al-souq/config/tailwind-preset')]`.
 */
const tokens = require("./design-tokens");

// يحوّل مقياس ألوانٍ إلى متغيّرات CSS (قنوات RGB) ليصبح قابلاً للتغيير وقت التشغيل
// من لوحة الإدارة، مع الحفاظ على دعم الشفافية (bg-brand-500/40).
function cssVarScale(name, scale) {
  return Object.fromEntries(
    Object.keys(scale).map((k) => [k, `rgb(var(--c-${name}-${k}) / <alpha-value>)`]),
  );
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: cssVarScale("brand", tokens.colors.brand),
        gold: cssVarScale("gold", tokens.colors.gold),
        sand: cssVarScale("sand", tokens.colors.sand),
        clay: tokens.colors.clay,
        petrol: tokens.colors.petrol,
        neutral: tokens.colors.neutral,
        status: tokens.colors.status,
        danger: tokens.colors.danger,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        info: tokens.colors.info,
      },
      borderRadius: tokens.radii,
      fontFamily: tokens.typography.fontFamily,
      fontSize: tokens.typography.fontSize,
    },
  },
  // tailwindcss-rtl يضيف أدوات منطقية (ms-/me-) تعمل صحيحاً مع dir=rtl
  plugins: [require("tailwindcss-rtl")],
};
