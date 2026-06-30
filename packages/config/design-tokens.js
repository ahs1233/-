/**
 * Design Tokens — مصدر واحد للحقيقة للتصميم عبر المنصات.
 * تُستهلك من tailwind-preset (الويب) ومن تطبيق React Native لاحقاً دون تغيير.
 * القيم مجرّدة (لا تعتمد على Tailwind) لتكون محمولة.
 */

const colors = {
  // الهوية السومرية: تركوازي سومري (أساسي) + برونزي ذهبي + ألوان طينية ترابية
  brand: {
    50: "#e7f7f7",
    100: "#c4ecec",
    200: "#9adede",
    300: "#5fc9c9",
    400: "#27b3b3",
    500: "#0fa3a3", // التركوازي السومري — اللون الأساسي
    600: "#0c8a8a",
    700: "#0a6e6e",
    800: "#085656",
    900: "#063f3f",
  },
  // البرونزي الذهبي (الهوية + التقييمات)
  gold: {
    50: "#f6efe4",
    100: "#ecdcc4",
    200: "#dec19b",
    300: "#d4ad7f",
    400: "#c99a6a",
    500: "#b87d4a",
    600: "#9a6638",
    700: "#7c5029",
  },
  // ألوان ترابية داعمة من الطراز العراقي
  sand: {
    50: "#f7f4ee", // عاجي فاتح (الخلفية)
    100: "#efe9dd",
    200: "#e7dcc6", // طيني رملي
    300: "#d8c7a8",
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
