/**
 * طبقة التدويل (i18n).
 * العربية هي الأساس و RTL افتراضي. البنية جاهزة لإضافة الإنجليزية والكردية:
 * أضف ملف locale جديداً يطابق نوع Messages وسجّله في LOCALES.
 */
import { ar, type Messages } from "./locales/ar";

export type Locale = "ar" | "en" | "ku";

export interface LocaleConfig {
  code: Locale;
  name: string;
  dir: "rtl" | "ltr";
  messages: Messages;
}

export const DEFAULT_LOCALE: Locale = "ar";

// en/ku يرثان العربية مؤقتاً حتى تُترجم (fallback صريح، لا نص مفقود).
export const LOCALES: Record<Locale, LocaleConfig> = {
  ar: { code: "ar", name: "العربية", dir: "rtl", messages: ar },
  en: { code: "en", name: "English", dir: "ltr", messages: ar },
  ku: { code: "ku", name: "کوردی", dir: "rtl", messages: ar },
};

export function getLocale(locale: Locale = DEFAULT_LOCALE): LocaleConfig {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

export function getDir(locale: Locale = DEFAULT_LOCALE): "rtl" | "ltr" {
  return getLocale(locale).dir;
}

export type { Messages };
export { ar };
