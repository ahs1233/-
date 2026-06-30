/**
 * Tailwind preset مشترك — يبني على design-tokens ويضيف دعم RTL.
 * تستورده تطبيقات الويب عبر `presets: [require('@al-souq/config/tailwind-preset')]`.
 */
const tokens = require("./design-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: tokens.colors.brand,
        gold: tokens.colors.gold,
        sand: tokens.colors.sand,
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
