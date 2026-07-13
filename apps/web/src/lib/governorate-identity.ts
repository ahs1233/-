/**
 * هويّة المحافظة — كلّ محافظةٍ تُغيّر التجربة نفسها، لا الصورة فقط.
 * الشعور والأسواق يختلفان: بغداد (الشورجة/المتنبّي/الكاظميّة/النحاسيّات) تختلف
 * عن البصرة (التمور/الأسماك/شطّ العرب) عن النجف (الكتب/العطور/السجّاد/الذهب).
 *
 * البلاطة إمّا صورةٌ حقيقيّة (متوفّرة لبغداد الآن) أو بلاطةٌ مضيئة برمزٍ حِرفيّ
 * (لبقيّة المحافظات حتى تُلتقَط أصولها) — فيبقى التمييز صادقاً بلا صورٍ مضلّلة.
 */
export interface SoukTile {
  label: string;
  q: string;
  img?: string;
  emoji?: string;
  color?: string;
  status?: "active" | "hidden";
}

export interface GovIdentity {
  feel: string;
  hero: string;
  souks: SoukTile[];
}

const BAGHDAD: GovIdentity = {
  feel: "قباب وأزقّة وفوانيس عند المغرب",
  hero: "/hero-souk.jpg",
  // أماكنُ حقيقيّة تولّد فضولاً — لا مجرّد فئات.
  souks: [
    { label: "الشورجة", q: "الشورجة", img: "/souks/souk-shorja.jpg" },
    { label: "شارع المتنبّي", q: "كتب", img: "/souks/souk-books.jpg" },
    { label: "سوق الصفافير", q: "نحاس", img: "/souks/souk-lantern.jpg" },
    { label: "خان مرجان", q: "حرفي", img: "/souks/souk-craft.jpg" },
    { label: "سوق العطّارين", q: "عطور", img: "/souks/souk-spice.jpg" },
    { label: "سوق العبايات", q: "عباية", img: "/souks/souk-abaya.jpg" },
  ],
};

const GENERIC: GovIdentity = {
  feel: "أزقّةٌ وفوانيسُ وبضاعةٌ تمدّ يدها إليك",
  hero: "/hero-souk.jpg",
  souks: [
    { label: "المتاجر", q: "متجر", img: "/souks/souk-shorja.jpg" },
    { label: "الحرفيّون", q: "حرفي", img: "/souks/souk-craft.jpg" },
    { label: "النحاسيّات", q: "نحاس", img: "/souks/souk-lantern.jpg" },
    { label: "العطور", q: "عطور", img: "/souks/souk-spice.jpg" },
  ],
};

// المحافظات الأخرى — أسواقها الخاصّة كبلاطاتٍ مضيئة برموزٍ حِرفيّة (أصولٌ مصوّرة لاحقاً).
export const GOV_IDENTITY: Record<string, GovIdentity> = {
  بغداد: BAGHDAD,
  البصرة: {
    feel: "شطّ العرب والنخيل والموانئ",
    hero: "/gov/basra.jpg",
    souks: [
      { label: "التمور", q: "تمر", emoji: "🌴" },
      { label: "الأسماك", q: "سمك", emoji: "🐟" },
      { label: "العطّارون", q: "عطار", emoji: "🧴" },
      { label: "الأقمشة", q: "قماش", emoji: "🧵" },
    ],
  },
  النجف: {
    feel: "الكتب والعطور والسجّاد والذهب",
    hero: "/gov/najaf.jpg",
    souks: [
      { label: "المكتبات", q: "كتب", emoji: "📚" },
      { label: "العطور", q: "عطور", emoji: "🫧" },
      { label: "السجّاد", q: "سجاد", emoji: "🧶" },
      { label: "الذهب", q: "ذهب", emoji: "💍" },
    ],
  },
  أربيل: {
    feel: "القلعة والبازار والأسواق التقليديّة",
    hero: "/gov/erbil.jpg",
    souks: [
      { label: "القلعة", q: "تراث", emoji: "🏯" },
      { label: "الأقمشة", q: "قماش", emoji: "🧵" },
      { label: "الحلويّات", q: "حلويات", emoji: "🍬" },
      { label: "البازار", q: "بازار", emoji: "🛍️" },
    ],
  },
  الموصل: {
    feel: "الحجر التراثيّ والأسواق القديمة",
    hero: "/gov/mosul.jpg",
    souks: [
      { label: "النسيج", q: "نسيج", emoji: "🧵" },
      { label: "الحبوب", q: "حبوب", emoji: "🌾" },
      { label: "الصاغة", q: "ذهب", emoji: "💍" },
      { label: "العطّارون", q: "عطار", emoji: "🧴" },
    ],
  },
};

export function govIdentity(name?: string): GovIdentity {
  return (name && GOV_IDENTITY[name]) || GENERIC;
}

/** عرضٌ قادمٌ من قاعدة البيانات (تبويب المحافظات) — أيّ حقلٍ فارغٍ يرجع للافتراضيّ. */
export interface GovPresentationLike {
  tagline: string | null;
  heroImageUrl: string | null;
  souks: SoukTile[] | null;
}

/**
 * يدمج عرض المحافظة القادم من القاعدة فوق الهويّة الافتراضيّة في الكود.
 * فيتحكّم الأدمن بالشعور/البطل/الأسواق دون أن تنكسر المحافظات غير المضبوطة.
 */
export function resolveGovIdentity(name: string | undefined, pres: GovPresentationLike | null): GovIdentity {
  const base = govIdentity(name);
  if (!pres) return base;
  return {
    feel: pres.tagline ?? base.feel,
    hero: pres.heroImageUrl ?? base.hero,
    souks: pres.souks && pres.souks.length ? pres.souks : base.souks,
  };
}
