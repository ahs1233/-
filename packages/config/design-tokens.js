/**
 * Design Tokens — مصدر واحد للحقيقة للتصميم عبر المنصات.
 * تُستهلك من tailwind-preset (الويب) ومن تطبيق React Native لاحقاً دون تغيير.
 * القيم مجرّدة (لا تعتمد على Tailwind) لتكون محمولة.
 */

const colors = {
  // الهوية: نيليّ بغداديّ (أساسي) + ذهبيّ + عاجيّ — لوحة «السوگ» المعتمدة
  brand: {
    50: "#eef1f7",
    100: "#d4dced",
    200: "#aebdd8",
    300: "#8296bd",
    400: "#556d9a",
    500: "#2f4266", // النيليّ — اللون الأساسي (بديل التركوازي)
    600: "#243450",
    700: "#1a2740", // نيليّ عميق (رؤوس/أبطال)
    800: "#131d31",
    900: "#0e1626", // فحميّ نيليّ (أعمق نقطة)
  },
  // الذهبيّ الشمبانيا (الهوية + الأزرار + الأسعار) — مُلتقَط من التصميم المعتمد
  gold: {
    50: "#f8efd6",
    100: "#efe0bb",
    200: "#e4cd97",
    300: "#d8b978",
    400: "#cca75f",
    500: "#c1974e", // الذهب المعتمد (زرّ «دخول المتجر»)
    600: "#a2793a",
    700: "#7f5d2b",
  },
  // العاجيّ (الأسطح) — أدفأ، مطابقٌ للخلفية المعتمدة
  sand: {
    50: "#f4ecd9", // عاجي دافئ (خلفية التطبيق)
    100: "#ece0c8",
    200: "#e2d3b4", // طيني رملي
    300: "#d5c19c",
  },
  clay: "#c65a3a", // طيني حجري (تنبيه/خصم)
  petrol: "#2e7d5b", // أخضر نفطي
  neutral: {
    50: "#faf8f3",
    100: "#f1ede4",
    200: "#e3ddd0",
    300: "#cabfad",
    400: "#9c9384",
    500: "#736b5e",
    600: "#544e44",
    700: "#3c382f",
    800: "#2a2720",
    900: "#1a1813",
  },
  // دلالات حالة الطلب
  status: {
    pending: "#9c9384",
    confirmed: "#0fa3a3",
    preparing: "#b87d4a",
    shipped: "#d99036",
    delivered: "#2e7d5b",
    completed: "#0a6e6e",
    cancelled: "#c65a3a",
    returned: "#d99036",
  },
  danger: "#c0392b",
  success: "#2e7d5b",
  warning: "#d99036",
  info: "#0fa3a3",
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
