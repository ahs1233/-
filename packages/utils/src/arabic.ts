/**
 * تطبيع النص العربي للبحث.
 * يوحّد الأشكال المتعددة للحروف بحيث يطابق المستخدمُ النتائجَ بصرف النظر عن
 * التشكيل أو شكل الألف/الياء/التاء. يُستخدم لبناء عمود `titleNorm` ولتطبيع
 * استعلامات البحث قبل المطابقة.
 */

// علامات التشكيل (الحركات) — تُزال بالكامل
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

// تطويل الكلمات (ـــ)
const TATWEEL = /ـ/g;

/**
 * يطبّع نصاً عربياً:
 *  - إزالة التشكيل والتطويل
 *  - توحيد الألف (أ إ آ ٱ → ا)
 *  - توحيد الياء (ى → ي) والألف المقصورة
 *  - توحيد التاء المربوطة (ة → ه)
 *  - توحيد الهمزات (ؤ → و، ئ → ي)
 *  - تحويل الأرقام العربية-الهندية إلى لاتينية
 *  - تقليص المسافات وتحويل لحالة صغيرة (للحروف اللاتينية المختلطة)
 */
export function normalizeArabic(input: string): string {
  if (!input) return "";
  let s = input.normalize("NFKC");
  s = s.replace(DIACRITICS, "");
  s = s.replace(TATWEEL, "");
  s = s
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ → ا
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي"); // ئ → ي
  s = arabicDigitsToLatin(s);
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** يحوّل الأرقام العربية-الهندية والفارسية إلى أرقام لاتينية. */
export function arabicDigitsToLatin(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const ar = AR_DIGITS.indexOf(d);
    if (ar > -1) return String(ar);
    const fa = FA_DIGITS.indexOf(d);
    return fa > -1 ? String(fa) : d;
  });
}

/** يولّد slug من نص عربي/لاتيني صالح للروابط. */
export function slugify(input: string): string {
  const norm = normalizeArabic(input);
  return norm
    .replace(/[^\p{L}\p{N}]+/gu, "-") // أي شيء ليس حرفاً أو رقماً → شرطة
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** يقسّم نصاً مطبّعاً إلى رموز (tokens) للبحث. */
export function tokenize(input: string): string[] {
  return normalizeArabic(input)
    .split(" ")
    .filter((t) => t.length > 0);
}
