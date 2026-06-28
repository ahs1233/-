/**
 * Design Tokens — مصدر واحد للحقيقة للتصميم عبر المنصات.
 * تُستهلك من tailwind-preset (الويب) ومن تطبيق React Native لاحقاً دون تغيير.
 * القيم مجرّدة (لا تعتمد على Tailwind) لتكون محمولة.
 */

const colors = {
  // الهوية: أخضر السوق (ثقة) + ذهبي دافئ (دفء عراقي)
  brand: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#16a34a", // اللون الأساسي
    600: "#15803d",
    700: "#166534",
    800: "#14532d",
    900: "#052e16",
  },
  gold: {
    400: "#f5c451",
    500: "#e3a72f",
    600: "#c4860f",
  },
  neutral: {
    50: "#fafafa",
    100: "#f4f4f5",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#18181b",
  },
  // دلالات حالة الطلب
  status: {
    pending: "#a1a1aa",
    confirmed: "#3b82f6",
    preparing: "#8b5cf6",
    shipped: "#f59e0b",
    delivered: "#10b981",
    completed: "#16a34a",
    cancelled: "#ef4444",
    returned: "#f97316",
  },
  danger: "#dc2626",
  success: "#16a34a",
  warning: "#d97706",
  info: "#2563eb",
};

const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
};

const radii = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
};

const typography = {
  // خط عربي حديث وواضح؛ Cairo/Tajawal مناسبان للـ RTL
  fontFamily: {
    sans: ["Tajawal", "Cairo", "system-ui", "sans-serif"],
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
  },
};

module.exports = { colors, spacing, radii, typography };
