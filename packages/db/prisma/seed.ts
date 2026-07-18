/**
 * بذور بيانات واقعية للسوق العراقي.
 * يشمل: 18 محافظة + مناطق، فئات، أدمن، بائعين معتمدين، ومنتجات بأسعار IQD.
 * idempotent قدر الإمكان عبر upsert على المفاتيح الفريدة.
 */
import {
  PrismaClient,
  Prisma,
  Role,
  VendorStatus,
  ProductStatus,
  OrderStatus,
  PayoutStatus,
  ReviewStatus,
} from "@prisma/client";
import { normalizeArabic, slugify } from "@al-souq/utils";
import {
  calculateCommission,
  resolveCommissionRate,
  buildOrderNumber,
  orderNumberPrefix,
  parseOrderSequence,
} from "@al-souq/domain";

const PLATFORM_RATE = 0.1;

const prisma = new PrismaClient();

// ── المحافظات العراقية الـ18 ──
const GOVERNORATES: { nameAr: string; code: string; areas: string[] }[] = [
  { nameAr: "بغداد", code: "BGD", areas: ["الكرادة", "المنصور", "الكاظمية", "الأعظمية", "زيونة", "الدورة", "الشعلة", "مدينة الصدر"] },
  { nameAr: "البصرة", code: "BSR", areas: ["العشار", "الجزائر", "الزبير", "أبو الخصيب", "القبلة"] },
  { nameAr: "نينوى", code: "NNW", areas: ["الموصل الأيمن", "الموصل الأيسر", "تلعفر", "بعشيقة"] },
  { nameAr: "أربيل", code: "ARB", areas: ["عنكاوا", "وسط أربيل", "كويسنجق"] },
  { nameAr: "النجف", code: "NJF", areas: ["مركز النجف", "الكوفة", "المشخاب"] },
  { nameAr: "كربلاء", code: "KBL", areas: ["مركز كربلاء", "الحسينية", "عين التمر"] },
  { nameAr: "ذي قار", code: "DHQ", areas: ["الناصرية", "الشطرة", "سوق الشيوخ"] },
  { nameAr: "السليمانية", code: "SUL", areas: ["مركز السليمانية", "رانية", "حلبجة"] },
  { nameAr: "الأنبار", code: "ANB", areas: ["الرمادي", "الفلوجة", "هيت"] },
  { nameAr: "ديالى", code: "DYL", areas: ["بعقوبة", "المقدادية", "خانقين"] },
  { nameAr: "بابل", code: "BBL", areas: ["الحلة", "المسيب", "الهاشمية"] },
  { nameAr: "كركوك", code: "KRK", areas: ["مركز كركوك", "الحويجة", "داقوق"] },
  { nameAr: "واسط", code: "WST", areas: ["الكوت", "الصويرة", "العزيزية"] },
  { nameAr: "صلاح الدين", code: "SAL", areas: ["تكريت", "سامراء", "بيجي"] },
  { nameAr: "المثنى", code: "MTH", areas: ["السماوة", "الرميثة", "الخضر"] },
  { nameAr: "القادسية", code: "QAD", areas: ["الديوانية", "عفك", "الشامية"] },
  { nameAr: "ميسان", code: "MYS", areas: ["العمارة", "المجر الكبير", "علي الغربي"] },
  { nameAr: "دهوك", code: "DHK", areas: ["مركز دهوك", "زاخو", "العمادية"] },
];

// ── عرض المحافظات: الشعور + صورة البطل + الأسواق (كلّ محافظةٍ تجربةٌ مختلفة) ──
// مفتاحُها الكود المستقرّ (لا الاسم) كي يبقى البذر متينَ التوافق.
type SoukTile = { label: string; q: string; img?: string; emoji?: string };
const PRESENTATION: Record<string, { tagline: string; heroImageUrl: string; souks: SoukTile[] }> = {
  BGD: {
    tagline: "قباب وأزقّة وفوانيس عند المغرب",
    heroImageUrl: "/hero-souk.jpg",
    souks: [
      { label: "الشورجة", q: "الشورجة", img: "/souks/souk-shorja.jpg" },
      { label: "شارع المتنبّي", q: "كتب", img: "/souks/souk-books.jpg" },
      { label: "سوق الصفافير", q: "نحاس", img: "/souks/souk-lantern.jpg" },
      { label: "خان مرجان", q: "حرفي", img: "/souks/souk-craft.jpg" },
      { label: "سوق العطّارين", q: "عطور", img: "/souks/souk-spice.jpg" },
      { label: "سوق العبايات", q: "عباية", img: "/souks/souk-abaya.jpg" },
    ],
  },
  BSR: {
    tagline: "شطّ العرب والنخيل والموانئ",
    heroImageUrl: "/gov/basra.jpg",
    souks: [
      { label: "التمور", q: "تمر", emoji: "🌴" },
      { label: "الأسماك", q: "سمك", emoji: "🐟" },
      { label: "العطّارون", q: "عطار", emoji: "🧴" },
      { label: "الأقمشة", q: "قماش", emoji: "🧵" },
    ],
  },
  NJF: {
    tagline: "الكتب والعطور والسجّاد والذهب",
    heroImageUrl: "/gov/najaf.jpg",
    souks: [
      { label: "المكتبات", q: "كتب", emoji: "📚" },
      { label: "العطور", q: "عطور", emoji: "🫧" },
      { label: "السجّاد", q: "سجاد", emoji: "🧶" },
      { label: "الذهب", q: "ذهب", emoji: "💍" },
    ],
  },
  ARB: {
    tagline: "القلعة والبازار والأسواق التقليديّة",
    heroImageUrl: "/gov/erbil.jpg",
    souks: [
      { label: "القلعة", q: "تراث", emoji: "🏯" },
      { label: "الأقمشة", q: "قماش", emoji: "🧵" },
      { label: "الحلويّات", q: "حلويات", emoji: "🍬" },
      { label: "البازار", q: "بازار", emoji: "🛍️" },
    ],
  },
  NNW: {
    tagline: "الحجر التراثيّ والأسواق القديمة",
    heroImageUrl: "/gov/mosul.jpg",
    souks: [
      { label: "النسيج", q: "نسيج", emoji: "🧵" },
      { label: "الحبوب", q: "حبوب", emoji: "🌾" },
      { label: "الصاغة", q: "ذهب", emoji: "💍" },
      { label: "العطّارون", q: "عطار", emoji: "🧴" },
    ],
  },
};

// ── الفئات ──
const CATEGORIES: { nameAr: string; icon: string; children: string[] }[] = [
  { nameAr: "أزياء رجالية", icon: "shirt", children: ["دشاديش", "قمصان", "أحذية رجالية", "عبايات رجالية"] },
  { nameAr: "أزياء نسائية", icon: "dress", children: ["عبايات", "فساتين", "أحذية نسائية", "حقائب"] },
  { nameAr: "إلكترونيات", icon: "smartphone", children: ["هواتف", "إكسسوارات هواتف", "سماعات", "شواحن"] },
  { nameAr: "منزل ومطبخ", icon: "home", children: ["أواني طبخ", "مفروشات", "أجهزة منزلية"] },
  { nameAr: "مستلزمات أطفال", icon: "baby", children: ["ملابس أطفال", "ألعاب", "مستلزمات رضّع"] },
  { nameAr: "عطور وتجميل", icon: "sparkles", children: ["عطور", "مكياج", "العناية بالبشرة"] },
  { nameAr: "بقالة وأطعمة", icon: "shopping-basket", children: ["تمور", "مكسرات", "بهارات", "حلويات"] },
  { nameAr: "كتب ومستلزمات", icon: "book-open", children: ["كتب", "قرطاسية", "مجلات"] },
  { nameAr: "مطاعم", icon: "utensils", children: ["أكل شرقي", "حلويات ومعجنات", "وجبات سريعة"] },
  { nameAr: "صحة", icon: "heart-pulse", children: ["صيدليات", "مستلزمات طبية"] },
  { nameAr: "أثاث وستائر", icon: "sofa", children: ["أثاث", "ستائر"] },
  { nameAr: "أجهزة كهربائية", icon: "plug", children: ["ثلاجات وغسّالات", "تكييف وتبريد", "أجهزة صغيرة"] },
  { nameAr: "كهربائيات وإنشائية", icon: "wrench", children: ["كهربائيات", "مواد إنشائية", "مواد تنظيف"] },
  { nameAr: "ديكور منزلي", icon: "lamp", children: ["إكسسوارات ديكور"] },
  { nameAr: "إكسسوارات سيارات", icon: "car", children: ["إكسسوارات داخلية", "أنظمة صوت وشاشات"] },
];

async function main() {
  console.log("⏳ بدء بذر البيانات...");

  // المحافظات والمناطق
  const govByName: Record<string, string> = {};
  for (let i = 0; i < GOVERNORATES.length; i++) {
    const g = GOVERNORATES[i]!;
    const pres = PRESENTATION[g.code];
    const gov = await prisma.governorate.upsert({
      where: { code: g.code },
      // لا نلمس العرض في التحديث كي تبقى تعديلات الأدمن (تبويب المحافظات) محفوظة.
      update: { sortOrder: i },
      create: {
        nameAr: g.nameAr,
        code: g.code,
        sortOrder: i,
        ...(pres ? { tagline: pres.tagline, heroImageUrl: pres.heroImageUrl, souks: pres.souks } : {}),
      },
    });
    govByName[g.nameAr] = gov.id;
    for (const areaName of g.areas) {
      await prisma.area.upsert({
        where: { governorateId_nameAr: { governorateId: gov.id, nameAr: areaName } },
        update: {},
        create: { nameAr: areaName, governorateId: gov.id },
      });
    }
  }
  console.log(`✅ ${GOVERNORATES.length} محافظة + مناطقها`);

  // الفئات (أب → أبناء)
  const catBySlug: Record<string, string> = {};
  const catNameBySlug: Record<string, string> = {}; // للصورة البديلة المُوسومة بالفئة
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i]!;
    const parentSlug = slugify(c.nameAr);
    const parent = await prisma.category.upsert({
      where: { slug: parentSlug },
      update: { sortOrder: i, icon: c.icon },
      create: { nameAr: c.nameAr, slug: parentSlug, icon: c.icon, sortOrder: i },
    });
    catBySlug[parentSlug] = parent.id;
    catNameBySlug[parentSlug] = c.nameAr;
    for (let j = 0; j < c.children.length; j++) {
      const childName = c.children[j]!;
      const childSlug = slugify(childName);
      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: { parentId: parent.id, sortOrder: j },
        create: { nameAr: childName, slug: childSlug, parentId: parent.id, sortOrder: j },
      });
      catBySlug[childSlug] = child.id;
      catNameBySlug[childSlug] = childName;
    }
  }

  // صورةٌ بديلةٌ مُوحّدة العلامة (SVG) — تُستبدل بصورٍ حقيقيّة لاحقاً.
  const ph = (title: string, cat: string, kind?: "logo" | "banner") =>
    `/api/ph?t=${encodeURIComponent(title)}&c=${encodeURIComponent(cat)}${kind ? `&k=${kind}` : ""}`;
  console.log(`✅ الفئات`);

  // الأدمن
  await prisma.user.upsert({
    where: { phone: "+9647700000000" },
    update: { role: Role.ADMIN, phoneVerified: true },
    create: {
      phone: "+9647700000000",
      name: "مدير المنصة",
      role: Role.ADMIN,
      phoneVerified: true,
    },
  });
  console.log(`✅ حساب الأدمن (+9647700000000)`);

  // إعدادات المنصة
  await prisma.platformSetting.upsert({
    where: { key: "commission_rate" },
    update: {},
    create: { key: "commission_rate", value: 0.1 },
  });

  // البائعون + منتجاتهم
  const vendorsSeed = [
    {
      phone: "+9647701111111",
      name: "أبو مصطفى",
      storeName: "متجر أبو مصطفى للأقمشة",
      gov: "بغداد",
      catSlug: slugify("دشاديش"),
      products: [
        { title: "دشداشة رجالية قطن صيفي", price: 35000, stock: 40, variants: [["L", 35000, 15], ["XL", 36000, 15], ["XXL", 37000, 10]] },
        { title: "عباية رجالية مطرزة", price: 60000, stock: 20, variants: [["وسط", 60000, 10], ["كبير", 62000, 10]] },
      ],
    },
    {
      phone: "+9647703333333",
      name: "حيدر",
      storeName: "موبايلات بغداد",
      gov: "بغداد",
      // متجرٌ إلكترونيّ (صفحة إنستغرام/تيك توك) — يظهر في «بغداد الإلكتروني»، لا في السوق الواقعيّ.
      channel: "online",
      instagramUrl: "https://instagram.com/mobilat_baghdad",
      tiktokUrl: "https://tiktok.com/@mobilat_baghdad",
      catSlug: slugify("اكسسوارات-هواتف"),
      products: [
        { title: "حافظة جلد آيفون 15", price: 12000, stock: 100, variants: [["أسود", 12000, 50], ["بني", 12000, 50]] },
        { title: "شاحن سريع 25 واط أصلي", price: 18000, stock: 60, variants: [] },
        { title: "سماعة بلوتوث لاسلكية", price: 22000, stock: 45, variants: [] },
      ],
    },
    {
      phone: "+9647703131313",
      name: "رند",
      storeName: "بوتيك رند أونلاين",
      gov: "بغداد",
      // صفحةُ أزياءٍ على إنستغرام وتيك توك — عالم «بغداد الإلكتروني».
      channel: "online",
      instagramUrl: "https://instagram.com/rand_boutique",
      tiktokUrl: "https://tiktok.com/@rand_boutique",
      catSlug: slugify("عبايات"),
      products: [
        { title: "عباية كلوش أونلاين حصريّة", price: 55000, stock: 25, variants: [["54", 55000, 8], ["56", 56000, 9], ["58", 57000, 8]] },
        { title: "طقم سهرة مطرّز", price: 95000, stock: 10, variants: [["S", 95000, 3], ["M", 95000, 4], ["L", 97000, 3]] },
      ],
    },
    {
      phone: "+9647704444444",
      name: "أبو علي",
      storeName: "تمور وخيرات البصرة",
      gov: "البصرة",
      catSlug: slugify("تمور"),
      products: [
        { title: "تمر برحي بصري ممتاز 1 كغم", price: 8000, stock: 200, variants: [] },
        { title: "تمر زهدي معبأ 5 كغم", price: 30000, stock: 80, variants: [] },
      ],
    },
    // ── توسعةٌ عبر المحافظات — سوقٌ عراقيّ حيّ ──
    {
      phone: "+9647705555555",
      name: "أبو كرّار",
      storeName: "عطّار بغداد",
      gov: "بغداد",
      catSlug: slugify("عطور"),
      products: [
        { title: "دهن عود هندي أصيل 12مل", price: 25000, stock: 60, variants: [] },
        { title: "مسك أبيض معتّق", price: 15000, stock: 90, variants: [] },
        { title: "بخور عود كمبودي فاخر", price: 30000, stock: 40, variants: [] },
      ],
    },
    {
      phone: "+9647706666666",
      name: "أبو حسين",
      storeName: "بيت النحاس البغدادي",
      gov: "بغداد",
      catSlug: slugify("أواني طبخ"),
      products: [
        { title: "دلّة قهوة نحاسية مشغولة يدوياً", price: 45000, stock: 25, variants: [] },
        { title: "طقم استكانات شاي ٦ قطع", price: 20000, stock: 70, variants: [] },
        { title: "صينية نحاس مزخرفة كبيرة", price: 35000, stock: 30, variants: [] },
        { title: "طقم صحون بورسلان", price: 95000, compareAt: 120000, rating: [4.7, 64] as [number, number], sold: 350, stock: 28, variants: [] },
      ],
    },
    {
      phone: "+9647707777777",
      name: "دار العباءة",
      storeName: "دار العباءة البغدادية",
      gov: "بغداد",
      catSlug: slugify("عبايات"),
      products: [
        { title: "عباية كلوش سوداء كريستال", price: 55000, stock: 35, variants: [["54", 55000, 12], ["56", 56000, 12], ["58", 57000, 11]] },
        { title: "عباية مطرّزة يدوياً", price: 90000, stock: 14, variants: [["وسط", 90000, 7], ["كبير", 92000, 7]] },
      ],
    },
    {
      phone: "+9647708333333",
      name: "حلويات أربيل",
      storeName: "حلويات أربيل التقليديّة",
      gov: "أربيل",
      catSlug: slugify("حلويات"),
      products: [
        { title: "بقلاوة بالجوز علبة كيلو", price: 12000, stock: 100, variants: [] },
        { title: "كليجة عيديّة بالتمر", price: 10000, stock: 80, variants: [] },
      ],
    },
    {
      phone: "+9647708444444",
      name: "عطّارية الموصل",
      storeName: "عطّارية الموصل للبهارات",
      gov: "نينوى",
      catSlug: slugify("بهارات"),
      products: [
        { title: "بهار موصليّ مشكّل 250غم", price: 6000, stock: 150, variants: [] },
        { title: "سمّاق أحمر فاخر", price: 4000, stock: 200, variants: [] },
      ],
    },
    {
      phone: "+9647708555555",
      name: "مكسرات الخليج",
      storeName: "مكسّرات الخليج البصريّة",
      gov: "البصرة",
      catSlug: slugify("مكسرات"),
      products: [
        { title: "فستق حلبيّ محمّص 500غم", price: 25000, stock: 90, variants: [] },
        { title: "لوز مقشّر نيّئ 500غم", price: 20000, stock: 90, variants: [] },
      ],
    },
    {
      phone: "+9647708666666",
      name: "سجّاد كربلاء",
      storeName: "سجّاد كربلاء اليدويّ",
      gov: "كربلاء",
      catSlug: slugify("مفروشات"),
      products: [
        { title: "سجّادة صلاة مخمل فاخرة", price: 15000, stock: 70, variants: [] },
        { title: "سجّادة عجميّة يدويّة", price: 120000, stock: 10, variants: [] },
      ],
    },
    {
      phone: "+9647708777777",
      name: "موبايل مول",
      storeName: "موبايل مول الكرادة",
      gov: "بغداد",
      catSlug: slugify("هواتف"),
      products: [
        { title: "باور بانك 20000 مللي أمبير", price: 18000, stock: 80, variants: [] },
        { title: "حامل موبايل للسيارة مغناطيسي", price: 7000, stock: 120, variants: [] },
        { title: "سماعة سلكية بميكروفون", price: 8000, stock: 100, variants: [] },
      ],
    },

    // ══════════ المتاجر القانونيّة (مصدر الحقيقة للشاشات — لا تُغيَّر أسماؤها) ══════════
    // متاجر موثّقة (مميّزة) — مؤسَّسة منذ فترة (ageDays كبير كي لا تُعدّ «جديدة»).
    {
      phone: "+9647710000001", name: "دار الأناقة", storeName: "دار الأناقة", gov: "بغداد",
      catSlug: slugify("أزياء رجالية"), verified: true, ageDays: 90, rating: [4.8, 320] as [number, number],
      products: [
        { title: "ساعة رجالية فاخرة", price: 125000, compareAt: 166000, rating: [4.8, 96] as [number, number], sold: 400, stock: 40, variants: [] },
        { title: "حذاء رياضي جديد", price: 45000, ageDays: 1, stock: 30, variants: [["42", 45000, 10], ["43", 45000, 10], ["44", 45000, 10]] as [string, number, number][] },
        { title: "شنطة جلد طبيعي", price: 95000, ageDays: 2, stock: 25, variants: [] },
        { title: "قميص رسميّ قطن", price: 40000, sold: 60, stock: 50, variants: [["M", 40000, 20], ["L", 41000, 20], ["XL", 42000, 10]] as [string, number, number][] },
        { title: "بدلة كلاسيك صوف", price: 180000, sold: 20, stock: 12, variants: [], out: true },
      ],
    },
    {
      phone: "+9647710000002", name: "بيت العطور", storeName: "بيت العطور", gov: "بغداد",
      catSlug: slugify("عطور"), verified: true, ageDays: 90, rating: [4.7, 210] as [number, number],
      products: [
        { title: "عطر فرنسي أصلي", price: 85000, rating: [4.9, 74] as [number, number], sold: 500, stock: 60, variants: [] },
        { title: "دهن عود هندي فاخر", price: 120000, sold: 40, stock: 30, variants: [] },
        { title: "مسك أبيض معتّق", price: 30000, sold: 55, stock: 90, variants: [] },
        { title: "بخور كمبودي راقٍ", price: 45000, sold: 25, stock: 40, variants: [], out: true },
        { title: "عطر شرقيّ مركّز", price: 65000, sold: 30, stock: 45, variants: [] },
      ],
    },
    {
      phone: "+9647710000003", name: "مكتبة المتنبي", storeName: "مكتبة المتنبي", gov: "بغداد",
      catSlug: slugify("كتب"), verified: true, ageDays: 90, rating: [4.6, 180] as [number, number],
      products: [
        { title: "رواية أدبيّة عراقيّة", price: 15000, sold: 70, stock: 100, variants: [] },
        { title: "كتاب تاريخ العراق", price: 25000, sold: 45, stock: 60, variants: [] },
        { title: "دفتر جلد فاخر", price: 8000, sold: 90, stock: 120, variants: [] },
        { title: "قلم حبر فاخر", price: 12000, sold: 50, stock: 80, variants: [] },
        { title: "مجلّة ثقافيّة شهريّة", price: 5000, sold: 30, stock: 150, variants: [], out: true },
      ],
    },
    {
      phone: "+9647710000004", name: "مطعم دجلة", storeName: "مطعم دجلة", gov: "بغداد",
      catSlug: slugify("أكل شرقي"), verified: true, ageDays: 90, rating: [4.8, 410] as [number, number],
      products: [
        { title: "وجبة مشاوي مشكّلة", price: 25000, sold: 200, stock: 100, variants: [] },
        { title: "قوزي عراقيّ", price: 30000, sold: 120, stock: 80, variants: [] },
        { title: "تمن وقيمة", price: 12000, sold: 160, stock: 120, variants: [] },
        { title: "دولمة عراقيّة", price: 15000, sold: 90, stock: 70, variants: [], out: true },
        { title: "كباب عراقيّ", price: 20000, sold: 140, stock: 90, variants: [] },
      ],
    },
    // متاجر جديدة (ageDays صغير + ٥ منتجات فأكثر كي تظهر في «المتاجر الجديدة»).
    {
      phone: "+9647710000005", name: "متجر القمة", storeName: "متجر القمة", gov: "بغداد",
      catSlug: slugify("إلكترونيات"), ageDays: 1, rating: [4.6, 45] as [number, number],
      products: [
        { title: "iPhone 15 Pro Max", price: 1650000, rating: [4.8, 128] as [number, number], sold: 450, stock: 15, variants: [] },
        { title: "iPhone 15 Pro", price: 1350000, compareAt: 1600000, rating: [4.7, 40] as [number, number], sold: 90, stock: 12, variants: [] },
        { title: "لاب توب ASUS", price: 950000, ageDays: 1, stock: 8, variants: [] },
        { title: "سماعات لاسلكية", price: 65000, ageDays: 2, stock: 50, variants: [] },
        { title: "ساعة ذكية حديثة", price: 150000, compareAt: 200000, rating: [4.5, 20] as [number, number], ageDays: 0, sold: 35, stock: 30, variants: [] },
      ],
    },
    {
      phone: "+9647710000006", name: "أزياء البغدادية", storeName: "أزياء البغدادية", gov: "بغداد",
      catSlug: slugify("أزياء نسائية"), ageDays: 2, rating: [4.7, 28] as [number, number],
      products: [
        { title: "فستان سهرة أنيق", price: 120000, sold: 30, stock: 20, variants: [["S", 120000, 6], ["M", 120000, 8], ["L", 122000, 6]] as [string, number, number][] },
        { title: "عباية مطرّزة عصريّة", price: 90000, sold: 25, stock: 25, variants: [] },
        { title: "حقيبة يد نسائيّة", price: 55000, sold: 40, stock: 35, variants: [] },
        { title: "حذاء كعب أنيق", price: 65000, sold: 20, stock: 30, variants: [], out: true },
        { title: "طقم إكسسوارات", price: 25000, sold: 50, stock: 60, variants: [] },
      ],
    },
    {
      phone: "+9647710000007", name: "بيت الحلويات", storeName: "بيت الحلويات", gov: "بغداد",
      catSlug: slugify("حلويات ومعجنات"), ageDays: 3, rating: [4.5, 22] as [number, number],
      products: [
        { title: "بقلاوة بالجوز علبة كيلو", price: 15000, sold: 80, stock: 100, variants: [] },
        { title: "كليجة عيديّة بالتمر", price: 10000, sold: 60, stock: 90, variants: [] },
        { title: "كنافة نابلسيّة", price: 12000, sold: 70, stock: 80, variants: [] },
        { title: "زلابية عراقيّة", price: 8000, sold: 55, stock: 120, variants: [] },
        { title: "حلقوم بالفستق", price: 9000, sold: 40, stock: 100, variants: [], out: true },
      ],
    },
    {
      phone: "+9647710000008", name: "مكتبة النافذة", storeName: "مكتبة النافذة", gov: "بغداد",
      catSlug: slugify("كتب"), ageDays: 3, rating: [4.6, 18] as [number, number],
      products: [
        { title: "كتب أطفال مصوّرة", price: 10000, sold: 45, stock: 100, variants: [] },
        { title: "أطلس مصوّر للعالم", price: 30000, sold: 20, stock: 40, variants: [] },
        { title: "قرطاسيّة مدرسيّة", price: 15000, sold: 65, stock: 120, variants: [] },
        { title: "ألوان خشبيّة ٢٤ لون", price: 8000, sold: 50, stock: 90, variants: [] },
        { title: "دفتر رسم فنّي", price: 6000, sold: 35, stock: 110, variants: [], out: true },
      ],
    },
    // متاجر لها موقعٌ على الخريطة (قريب منك) — مؤسَّسة (ageDays كبير).
    {
      phone: "+9647710000009", name: "سوبر ماركت الزوراء", storeName: "سوبر ماركت الزوراء", gov: "بغداد",
      catSlug: slugify("بقالة وأطعمة"), ageDays: 50, rating: [4.5, 40] as [number, number], lat: 33.3210, lng: 44.3610,
      products: [
        { title: "سلّة تسوّق أسبوعيّة", price: 50000, sold: 40, stock: 60, variants: [] },
        { title: "زيت طبخ ٥ لتر", price: 12000, sold: 80, stock: 100, variants: [] },
        { title: "رز عنبر ١٠ كغم", price: 25000, sold: 60, stock: 70, variants: [] },
        { title: "شاي سيلانيّ فاخر", price: 8000, sold: 90, stock: 120, variants: [] },
      ],
    },
    {
      phone: "+9647710000010", name: "صيدلية الحياة", storeName: "صيدلية الحياة", gov: "بغداد",
      catSlug: slugify("صيدليات"), ageDays: 50, rating: [4.7, 35] as [number, number], lat: 33.3085, lng: 44.3660,
      products: [
        { title: "فيتامين سي ١٠٠٠", price: 9000, sold: 70, stock: 150, variants: [] },
        { title: "كمّامات طبّيّة علبة", price: 5000, sold: 120, stock: 200, variants: [] },
        { title: "جهاز قياس ضغط", price: 45000, sold: 25, stock: 30, variants: [], out: true },
        { title: "معقّم يدين ٥٠٠مل", price: 4000, sold: 100, stock: 180, variants: [] },
      ],
    },
    {
      phone: "+9647710000011", name: "مطعم بيت أمي", storeName: "مطعم بيت أمي", gov: "بغداد",
      catSlug: slugify("مطاعم"), ageDays: 50, rating: [4.6, 30] as [number, number], lat: 33.3160, lng: 44.3540,
      products: [
        { title: "وجبة بيتيّة منزليّة", price: 15000, sold: 110, stock: 80, variants: [] },
        { title: "شوربة عدس", price: 5000, sold: 90, stock: 120, variants: [] },
        { title: "كبّة موصليّة", price: 12000, sold: 70, stock: 90, variants: [] },
        { title: "مقلوبة دجاج", price: 18000, sold: 60, stock: 70, variants: [] },
      ],
    },

    // ══════════ متاجر النجف (بيانات شبه حقيقيّة — كلّ متجرٍ بأقسامٍ داخليّة حسب نوعه وخدماته) ══════════
    // الغذائية
    { phone: "+9647720000001", name: "أسواق شمسة", storeName: "أسواق شمسة", gov: "النجف", catSlug: slugify("بقالة وأطعمة"), products: [
      { title: "سلّة تسوّق شهريّة", section: "معلّبات وحبوب", price: 75000, stock: 40, variants: [] }, { title: "معلّبات متنوّعة", section: "معلّبات وحبوب", price: 5000, stock: 200, variants: [] }, { title: "حبوب ومعكرونة", section: "معلّبات وحبوب", price: 4000, stock: 200, variants: [] },
      { title: "عصائر طبيعيّة", section: "مشروبات وعصائر", price: 3000, stock: 250, variants: [] }, { title: "مشروبات غازيّة", section: "مشروبات وعصائر", price: 2000, stock: 300, variants: [] } ] },
    { phone: "+9647720000002", name: "وجه الشمس للتسوق", storeName: "وجه الشمس للتسوق", gov: "النجف", catSlug: slugify("بقالة وأطعمة"), products: [
      { title: "زيت وسمن طبخ", section: "زيوت وسمن", price: 15000, stock: 120, variants: [] }, { title: "زيت زيتون بكر", section: "زيوت وسمن", price: 22000, stock: 60, variants: [] },
      { title: "حبوب ومعكرونة", section: "حبوب ومعلّبات", price: 4000, stock: 200, variants: [] }, { title: "معلّبات خضار", section: "حبوب ومعلّبات", price: 3500, stock: 180, variants: [] } ] },
    { phone: "+9647720000003", name: "متجر ماز", storeName: "متجر ماز", gov: "النجف", catSlug: slugify("بقالة وأطعمة"), products: [
      { title: "مكسّرات مشكّلة", section: "مكسّرات وحلويات", price: 20000, stock: 80, variants: [] }, { title: "حلويات متنوّعة", section: "مكسّرات وحلويات", price: 12000, stock: 90, variants: [] },
      { title: "عصائر ومشروبات", section: "مشروبات", price: 3000, stock: 250, variants: [] }, { title: "مياه معدنيّة قارورة", section: "مشروبات", price: 1000, stock: 400, variants: [] } ] },
    // المنزل — الأثاث والستائر
    { phone: "+9647720000004", name: "ايدل هوم", storeName: "ايدل هوم", gov: "النجف", catSlug: slugify("أثاث وستائر"), products: [
      { title: "كنبة زاوية مودرن", section: "كنب وجلسات", price: 650000, stock: 12, variants: [] }, { title: "ركنة قماش عصريّة", section: "كنب وجلسات", price: 700000, stock: 8, variants: [] },
      { title: "طاولة طعام خشب", section: "طاولات", price: 300000, stock: 15, variants: [] }, { title: "طاولة قهوة زجاج", section: "طاولات", price: 120000, stock: 20, variants: [] } ] },
    { phone: "+9647720000005", name: "العالمية للأثاث", storeName: "العالمية للأثاث", gov: "النجف", catSlug: slugify("أثاث وستائر"), products: [
      { title: "غرفة نوم كاملة", section: "غرف نوم", price: 1200000, stock: 6, variants: [] }, { title: "سرير مزدوج فاخر", section: "غرف نوم", price: 550000, stock: 10, variants: [] },
      { title: "دولاب ملابس", section: "دواليب", price: 400000, stock: 10, variants: [] }, { title: "دولاب أطفال ملوّن", section: "دواليب", price: 280000, stock: 12, variants: [] } ] },
    { phone: "+9647720000006", name: "هوم سنتر", storeName: "هوم سنتر", gov: "النجف", catSlug: slugify("أثاث وستائر"), products: [
      { title: "ركنة قماش عائليّة", section: "كنب وركنات", price: 550000, stock: 8, variants: [] }, { title: "كنبة ثلاثيّة", section: "كنب وركنات", price: 380000, stock: 12, variants: [] },
      { title: "طاولة تلفزيون", section: "طاولات تلفزيون", price: 180000, stock: 20, variants: [] }, { title: "مكتبة خشب جانبيّة", section: "طاولات تلفزيون", price: 150000, stock: 18, variants: [] } ] },
    { phone: "+9647720000007", name: "الصباح للستائر", storeName: "الصباح للستائر", gov: "النجف", catSlug: slugify("أثاث وستائر"), products: [
      { title: "ستائر بلاك أوت", section: "ستائر", price: 90000, stock: 40, variants: [] }, { title: "ستائر تركيّة مطرّزة", section: "ستائر", price: 120000, stock: 30, variants: [] },
      { title: "مفارش سرير قطن", section: "مفروشات", price: 45000, stock: 50, variants: [] }, { title: "شراشف قطن مصريّ", section: "مفروشات", price: 35000, stock: 60, variants: [] } ] },
    // المنزل — الأجهزة الكهربائية
    { phone: "+9647720000008", name: "الطفيلي", storeName: "الطفيلي للأجهزة", gov: "النجف", catSlug: slugify("أجهزة كهربائية"), products: [
      { title: "ثلاجة نوفروست", section: "ثلاجات وغسّالات", price: 750000, stock: 15, variants: [] }, { title: "غسّالة أوتوماتيك", section: "ثلاجات وغسّالات", price: 500000, stock: 18, variants: [] },
      { title: "خدمة صيانة ثلاجات", section: "خدمة الصيانة", price: 25000, stock: 100, variants: [] }, { title: "خدمة صيانة غسّالات", section: "خدمة الصيانة", price: 25000, stock: 100, variants: [] } ] },
    { phone: "+9647720000009", name: "سامسونج", storeName: "سامسونج النجف", gov: "النجف", catSlug: slugify("أجهزة كهربائية"), verified: true, rating: [4.7, 130] as [number, number], products: [
      { title: "تلفزيون سامسونج ٥٥ بوصة", section: "شاشات وتلفزيونات", price: 850000, sold: 60, stock: 20, variants: [] }, { title: "تلفزيون سامسونج ٤٣ بوصة", section: "شاشات وتلفزيونات", price: 550000, sold: 35, stock: 25, variants: [] },
      { title: "مايكرويف سامسونج", section: "أجهزة مطبخ", price: 150000, sold: 40, stock: 30, variants: [] }, { title: "غسّالة صحون سامسونج", section: "أجهزة مطبخ", price: 620000, sold: 15, stock: 12, variants: [] } ] },
    { phone: "+9647720000010", name: "علي الرماحي", storeName: "علي الرماحي للأجهزة", gov: "النجف", catSlug: slugify("أجهزة كهربائية"), products: [
      { title: "مكيّف سبليت ١.٥ طن", section: "تكييف وتبريد", price: 600000, stock: 25, variants: [] }, { title: "مكيّف صحراويّ", section: "تكييف وتبريد", price: 220000, stock: 30, variants: [] },
      { title: "سخّان ماء كهربائيّ", section: "سخّانات", price: 120000, stock: 35, variants: [] }, { title: "سخّان ماء غاز", section: "سخّانات", price: 140000, stock: 28, variants: [] } ] },
    { phone: "+9647720000011", name: "سمارت هوم", storeName: "سمارت هوم", gov: "النجف", catSlug: slugify("أجهزة كهربائية"), products: [
      { title: "خلّاط عصير", section: "أجهزة صغيرة", price: 45000, stock: 60, variants: [] }, { title: "غلّاية كهربائيّة", section: "أجهزة صغيرة", price: 30000, stock: 70, variants: [] },
      { title: "مكنسة كهربائيّة", section: "عناية منزليّة", price: 90000, stock: 40, variants: [] }, { title: "مكواة بخار", section: "عناية منزليّة", price: 35000, stock: 55, variants: [] } ] },
    // المنزل — الكهربائيات والإنشائية ومواد التنضيف
    { phone: "+9647720000012", name: "ابو فاطمة للكهربائيات", storeName: "أبو فاطمة للكهربائيات", gov: "النجف", catSlug: slugify("كهربائيات وإنشائية"), products: [
      { title: "أسلاك كهرباء لفّة", section: "كهربائيات", price: 25000, stock: 80, variants: [] }, { title: "مفاتيح وقوابس", section: "كهربائيات", price: 3000, stock: 200, variants: [] },
      { title: "لمبات ليد موفّرة", section: "إنارة", price: 5000, stock: 200, variants: [] }, { title: "كشّافات إنارة LED", section: "إنارة", price: 18000, stock: 90, variants: [] } ] },
    { phone: "+9647720000013", name: "الأمير للمواد الانشائية", storeName: "الأمير للمواد الإنشائية", gov: "النجف", catSlug: slugify("كهربائيات وإنشائية"), products: [
      { title: "إسمنت كيس ٥٠ كغم", section: "مواد بناء", price: 12000, stock: 150, variants: [] }, { title: "حديد تسليح", section: "مواد بناء", price: 15000, stock: 120, variants: [] },
      { title: "أنابيب PVC", section: "سباكة", price: 8000, stock: 120, variants: [] }, { title: "وصلات سباكة", section: "سباكة", price: 2500, stock: 250, variants: [] } ] },
    { phone: "+9647720000014", name: "بركات ام البنين", storeName: "بركات أمّ البنين", gov: "النجف", catSlug: slugify("كهربائيات وإنشائية"), products: [
      { title: "مواد تنظيف متنوّعة", section: "مواد تنظيف", price: 6000, stock: 180, variants: [] }, { title: "مساحيق غسيل", section: "مواد تنظيف", price: 9000, stock: 150, variants: [] },
      { title: "مكانس وممسحات", section: "أدوات منزليّة", price: 7000, stock: 120, variants: [] }, { title: "قفازات وأكياس", section: "أدوات منزليّة", price: 2000, stock: 300, variants: [] } ] },
    // المنزل — ديكور منزلي
    { phone: "+9647720000015", name: "الروان للمنزلية", storeName: "الروان للمنزليّة", gov: "النجف", catSlug: slugify("ديكور منزلي"), products: [
      { title: "طقم أدوات مائدة", section: "أدوات مائدة", price: 35000, stock: 50, variants: [] }, { title: "طقم صحون بورسلان", section: "أدوات مائدة", price: 65000, stock: 30, variants: [] },
      { title: "مزهريّات ديكور", section: "ديكور طاولات", price: 20000, stock: 70, variants: [] }, { title: "شمعدانات نحاسيّة", section: "ديكور طاولات", price: 25000, stock: 45, variants: [] } ] },
    { phone: "+9647720000016", name: "ديكورك", storeName: "ديكورك", gov: "النجف", catSlug: slugify("ديكور منزلي"), products: [
      { title: "لوحات جداريّة", section: "لوحات جداريّة", price: 40000, stock: 40, variants: [] }, { title: "ساعات حائط مودرن", section: "لوحات جداريّة", price: 30000, stock: 35, variants: [] },
      { title: "إضاءة ديكور", section: "إضاءة ديكور", price: 60000, stock: 35, variants: [] }, { title: "أباجورات جانبيّة", section: "إضاءة ديكور", price: 45000, stock: 40, variants: [] } ] },
    { phone: "+9647720000017", name: "دعافيس", storeName: "دعافيس", gov: "النجف", catSlug: slugify("ديكور منزلي"), products: [
      { title: "سجّاد مودرن", section: "سجّاد", price: 150000, stock: 25, variants: [] }, { title: "سجّاد تركيّ", section: "سجّاد", price: 220000, stock: 15, variants: [] },
      { title: "وسائد ديكور", section: "وسائد ومفارش", price: 15000, stock: 90, variants: [] }, { title: "مفارش أرضيّة", section: "وسائد ومفارش", price: 40000, stock: 50, variants: [] } ] },
    // التقنية (بيع + خدمات: هواتف/صيانة/إكسسوارات/طاقة شمسية/كاميرات/بلي ستيشن/حاسبات)
    { phone: "+9647720000018", name: "متجر بوابة السعد", storeName: "بوّابة السعد", gov: "النجف", catSlug: slugify("إلكترونيات"), products: [
      { title: "شاشة حماية زجاجيّة", section: "إكسسوارات", price: 5000, stock: 200, variants: [] }, { title: "كفرات موبايل", section: "إكسسوارات", price: 7000, stock: 180, variants: [] },
      { title: "شاحن سريع أصليّ", section: "شواحن وكوابل", price: 15000, stock: 120, variants: [] }, { title: "كيبل شحن Type-C", section: "شواحن وكوابل", price: 6000, stock: 200, variants: [] } ] },
    { phone: "+9647720000019", name: "الشريك للموبايلات", storeName: "الشريك للموبايلات", gov: "النجف", catSlug: slugify("إلكترونيات"), products: [
      { title: "سامسونج جالكسي A54", section: "هواتف", price: 350000, sold: 40, stock: 20, variants: [] }, { title: "سامسونج جالكسي A15", section: "هواتف", price: 220000, sold: 30, stock: 25, variants: [] },
      { title: "ساعة ذكيّة", section: "إكسسوارات", price: 90000, stock: 40, variants: [] }, { title: "سماعات بلوتوث", section: "إكسسوارات", price: 35000, stock: 60, variants: [] },
      { title: "تبديل شاشة موبايل", section: "خدمة الصيانة", price: 40000, stock: 100, variants: [] }, { title: "صيانة برمجيّة", section: "خدمة الصيانة", price: 15000, stock: 100, variants: [] } ] },
    { phone: "+9647720000020", name: "شاومي نجف", storeName: "شاومي النجف", gov: "النجف", catSlug: slugify("إلكترونيات"), verified: true, rating: [4.6, 90] as [number, number], products: [
      { title: "شاومي ريدمي نوت ١٣", section: "هواتف", price: 320000, sold: 70, stock: 25, variants: [] }, { title: "شاومي ريدمي 13C", section: "هواتف", price: 190000, sold: 45, stock: 30, variants: [] },
      { title: "باور بانك شاومي", section: "أجهزة ذكيّة", price: 25000, sold: 50, stock: 80, variants: [] }, { title: "سوار رياضي شاومي", section: "أجهزة ذكيّة", price: 45000, sold: 35, stock: 60, variants: [] } ] },
    { phone: "+9647720000021", name: "ابل ستور", storeName: "آبل ستور النجف", gov: "النجف", catSlug: slugify("إلكترونيات"), verified: true, rating: [4.8, 160] as [number, number], products: [
      { title: "آيفون ١٤", section: "آيفون", price: 1250000, sold: 55, stock: 12, variants: [] }, { title: "آيفون ١٥ برو", section: "آيفون", price: 1750000, sold: 30, stock: 8, variants: [] },
      { title: "آيربودز", section: "إكسسوارات آبل", price: 180000, sold: 60, stock: 40, variants: [] }, { title: "شاحن آبل أصليّ", section: "إكسسوارات آبل", price: 45000, sold: 50, stock: 70, variants: [] } ] },
    { phone: "+9647720000022", name: "اي تيك", storeName: "آي تيك", gov: "النجف", catSlug: slugify("إلكترونيات"), products: [
      { title: "كاميرا مراقبة", section: "كاميرات مراقبة", price: 120000, stock: 30, variants: [] }, { title: "نظام كاميرات ٤ عدسات", section: "كاميرات مراقبة", price: 350000, stock: 15, variants: [] },
      { title: "راوتر واي فاي", section: "شبكات وإنترنت", price: 45000, stock: 50, variants: [] }, { title: "مقوّي إشارة", section: "شبكات وإنترنت", price: 30000, stock: 45, variants: [] },
      { title: "لوح طاقة شمسيّة", section: "طاقة شمسية", price: 180000, stock: 20, variants: [] }, { title: "بطاريّة تخزين شمسيّة", section: "طاقة شمسية", price: 400000, stock: 10, variants: [] } ] },
    { phone: "+9647720000023", name: "الاول للحاسبات", storeName: "الأوّل للحاسبات", gov: "النجف", catSlug: slugify("إلكترونيات"), products: [
      { title: "لابتوب HP", section: "لابتوبات", price: 780000, sold: 30, stock: 15, variants: [] }, { title: "لابتوب Lenovo", section: "لابتوبات", price: 690000, sold: 22, stock: 18, variants: [] },
      { title: "ماوس وكيبورد", section: "إكسسوارات حاسوب", price: 30000, stock: 60, variants: [] }, { title: "شاشة كمبيوتر", section: "إكسسوارات حاسوب", price: 160000, stock: 25, variants: [] },
      { title: "صيانة لابتوب", section: "خدمة الصيانة", price: 20000, stock: 100, variants: [] }, { title: "تنصيب برامج وأنظمة", section: "خدمة الصيانة", price: 10000, stock: 100, variants: [] } ] },
    { phone: "+9647720000024", name: "الجزيرة للمستلزمات التقنية", storeName: "الجزيرة للتقنية", gov: "النجف", catSlug: slugify("إلكترونيات"), products: [
      { title: "بلي ستيشن ٥", section: "بلي ستيشن", price: 950000, sold: 45, stock: 10, variants: [] }, { title: "يد تحكّم إضافيّة", section: "بلي ستيشن", price: 90000, stock: 40, variants: [] },
      { title: "أقراص ألعاب PS5", section: "ألعاب وأقراص", price: 65000, sold: 80, stock: 60, variants: [] }, { title: "بطاقات شحن ألعاب", section: "ألعاب وأقراص", price: 25000, sold: 120, stock: 100, variants: [] } ] },
    // الملابس
    { phone: "+9647720000025", name: "عزوز", storeName: "عزّوز للأزياء", gov: "النجف", catSlug: slugify("أزياء رجالية"), products: [
      { title: "قميص رجاليّ", section: "قمصان", price: 35000, stock: 60, variants: [] }, { title: "تيشيرت بولو", section: "قمصان", price: 25000, stock: 80, variants: [] },
      { title: "بنطلون جينز", section: "بناطيل", price: 40000, stock: 50, variants: [] }, { title: "بنطلون قماش", section: "بناطيل", price: 38000, stock: 45, variants: [] } ] },
    { phone: "+9647720000026", name: "قفطان", storeName: "قفطان", gov: "النجف", catSlug: slugify("أزياء رجالية"), products: [
      { title: "قفطان مطرّز", section: "قفاطين", price: 85000, stock: 30, variants: [] }, { title: "قفطان صيفيّ", section: "قفاطين", price: 65000, stock: 35, variants: [] },
      { title: "عباءة رجاليّة", section: "عبي رجاليّة", price: 60000, stock: 35, variants: [] }, { title: "بشت عربيّ", section: "عبي رجاليّة", price: 150000, stock: 15, variants: [] } ] },
    { phone: "+9647720000027", name: "دشاديش ابن بشيش", storeName: "دشاديش ابن بشيش", gov: "النجف", catSlug: slugify("أزياء رجالية"), products: [
      { title: "دشداشة نجفيّة", section: "دشاديش", price: 45000, stock: 50, variants: [] }, { title: "دشداشة صيفيّة", section: "دشاديش", price: 38000, stock: 55, variants: [] },
      { title: "غترة وعقال", section: "إكسسوارات رجاليّة", price: 25000, stock: 70, variants: [] }, { title: "طاقيّة قطن", section: "إكسسوارات رجاليّة", price: 8000, stock: 120, variants: [] } ] },
    { phone: "+9647720000028", name: "متجر انزو", storeName: "متجر أنزو", gov: "النجف", catSlug: slugify("أزياء رجالية"), products: [
      { title: "تيشيرت قطن", section: "تيشيرتات", price: 20000, stock: 90, variants: [] }, { title: "تيشيرت رياضيّ", section: "تيشيرتات", price: 22000, stock: 80, variants: [] },
      { title: "جاكيت شتويّ", section: "جاكيتات", price: 70000, stock: 30, variants: [] }, { title: "هودي بقبّعة", section: "جاكيتات", price: 45000, stock: 50, variants: [] } ] },
    { phone: "+9647720000029", name: "الصافي", storeName: "الصافي للأزياء", gov: "النجف", catSlug: slugify("أزياء رجالية"), products: [
      { title: "بدلة رسميّة", section: "بدلات", price: 200000, stock: 20, variants: [] }, { title: "بدلة زفاف", section: "بدلات", price: 320000, stock: 10, variants: [] },
      { title: "حذاء جلد", section: "أحذية", price: 90000, stock: 40, variants: [] }, { title: "حذاء كلاسيك", section: "أحذية", price: 75000, stock: 45, variants: [] } ] },
    // إكسسوارات السيارات
    { phone: "+9647720000030", name: "البغدادي", storeName: "البغدادي لإكسسوارات السيّارات", gov: "النجف", catSlug: slugify("إكسسوارات سيارات"), products: [
      { title: "مساند مقاعد جلد", section: "إكسسوارات داخليّة", price: 80000, stock: 30, variants: [] }, { title: "دعّاسات أرضيّة", section: "إكسسوارات داخليّة", price: 35000, stock: 60, variants: [] },
      { title: "معطّر سيّارة", section: "عناية وتنظيف", price: 5000, stock: 150, variants: [] }, { title: "شامبو غسيل سيّارات", section: "عناية وتنظيف", price: 12000, stock: 90, variants: [] } ] },
    { phone: "+9647720000031", name: "اكسسوارات بانيقيا", storeName: "بانيقيا لإكسسوارات السيّارات", gov: "النجف", catSlug: slugify("إكسسوارات سيارات"), products: [
      { title: "شاشة سيّارة أندرويد", section: "أنظمة صوت وشاشات", price: 250000, stock: 18, variants: [] }, { title: "سبيكرات صوت", section: "أنظمة صوت وشاشات", price: 120000, stock: 25, variants: [] },
      { title: "كاميرا خلفيّة", section: "كاميرات وحسّاسات", price: 60000, stock: 40, variants: [] }, { title: "حسّاسات ركن", section: "كاميرات وحسّاسات", price: 45000, stock: 50, variants: [] } ] },
    // مواد تجميل
    { phone: "+9647720000032", name: "ريحانه للتجميل", storeName: "ريحانة للتجميل", gov: "النجف", catSlug: slugify("عطور وتجميل"), products: [
      { title: "طقم مكياج", section: "مكياج", price: 65000, stock: 40, variants: [] }, { title: "أحمر شفاه", section: "مكياج", price: 15000, stock: 90, variants: [] },
      { title: "كريم عناية بالبشرة", section: "عناية بالبشرة", price: 30000, stock: 60, variants: [] }, { title: "غسول وجه", section: "عناية بالبشرة", price: 18000, stock: 80, variants: [] } ] },
    { phone: "+9647720000033", name: "ابن الحكيم", storeName: "ابن الحكيم للتجميل", gov: "النجف", catSlug: slugify("عطور وتجميل"), products: [
      { title: "عطر نسائيّ", section: "عطور", price: 55000, stock: 45, variants: [] }, { title: "عطر رجاليّ", section: "عطور", price: 60000, stock: 40, variants: [] },
      { title: "مستحضرات بشرة", section: "عناية بالبشرة", price: 25000, stock: 70, variants: [] }, { title: "كريم مرطّب", section: "عناية بالبشرة", price: 20000, stock: 85, variants: [] } ] },
  ];

  // اسم كلّ متاجر النجف المعتمدة الجديدة — لحذف ما عداها.
  const NAJAF_STORE_NAMES = vendorsSeed.filter((v) => v.gov === "النجف").map((v) => v.storeName);

  for (const v of vendorsSeed) {
    const user = await prisma.user.upsert({
      where: { phone: v.phone },
      update: { role: Role.VENDOR, phoneVerified: true },
      create: { phone: v.phone, name: v.name, role: Role.VENDOR, phoneVerified: true },
    });

    const slug = slugify(v.storeName);
    const vv = v as typeof v & {
      channel?: string; instagramUrl?: string; tiktokUrl?: string; facebookUrl?: string;
      verified?: boolean; lat?: number; lng?: number; rating?: [number, number]; ageDays?: number;
    };
    const vAge = vv.ageDays ?? 45; // المتاجر الحاليّة مؤسَّسة (لا تُعدّ «جديدة»)
    const vCreatedAt = new Date(Date.now() - vAge * 86_400_000);
    // حقولٌ قانونيّة تُفرَض في كلّ بذرة (create+update) كي تبقى الشاشات متّسقة.
    const vCatName = catNameBySlug[v.catSlug] ?? v.storeName;
    const canonicalVendorFields = {
      channel: vv.channel ?? "physical",
      instagramUrl: vv.instagramUrl ?? null,
      tiktokUrl: vv.tiktokUrl ?? null,
      facebookUrl: vv.facebookUrl ?? null,
      verified: vv.verified ?? false,
      latitude: vv.lat ?? null,
      longitude: vv.lng ?? null,
      logoUrl: ph(v.storeName, vCatName, "logo"),
      bannerUrl: ph(v.storeName, vCatName, "banner"),
      ...(vv.rating ? { ratingAvg: new Prisma.Decimal(vv.rating[0]), ratingCount: vv.rating[1] } : {}),
    };
    const vendor = await prisma.vendorProfile.upsert({
      where: { userId: user.id },
      update: { status: VendorStatus.APPROVED, ...canonicalVendorFields },
      create: {
        userId: user.id,
        storeName: v.storeName,
        slug,
        slugNorm: normalizeArabic(v.storeName),
        status: VendorStatus.APPROVED,
        approvedAt: vCreatedAt,
        createdAt: vCreatedAt,
        governorateId: govByName[v.gov],
        ...canonicalVendorFields,
      },
    });

    const categoryId = catBySlug[v.catSlug];
    if (!categoryId) {
      console.warn(`⚠️ فئة غير موجودة: ${v.catSlug}`);
      continue;
    }

    // أقسام المتجر الداخليّة — تُشتقّ من وسم section على المنتجات (بترتيب أوّل ظهور).
    const sectionNames: string[] = [];
    for (const p of v.products) {
      const sec = (p as { section?: string }).section;
      if (sec && !sectionNames.includes(sec)) sectionNames.push(sec);
    }
    const sectionIdByName: Record<string, string> = {};
    for (let si = 0; si < sectionNames.length; si++) {
      const name = sectionNames[si]!;
      const secSlug = slugify(name);
      const sec = await prisma.vendorSection.upsert({
        where: { vendorId_slug: { vendorId: vendor.id, slug: secSlug } },
        update: { nameAr: name, sortOrder: si },
        create: { vendorId: vendor.id, nameAr: name, slug: secSlug, sortOrder: si },
      });
      sectionIdByName[name] = sec.id;
    }
    // إزالة أقسامٍ لم تعُد مُعرَّفة (تُفرَّغ منتجاتها تلقائياً عبر SetNull).
    await prisma.vendorSection.deleteMany({
      where: { vendorId: vendor.id, slug: { notIn: sectionNames.map((n) => slugify(n)) } },
    });

    for (const p of v.products) {
      const pp = p as typeof p & { compareAt?: number; rating?: [number, number]; sold?: number; ageDays?: number; out?: boolean; section?: string };
      const pSlug = slugify(p.title) + "-" + vendor.id.slice(-4);
      const pAge = pp.ageDays ?? 20; // المنتجات الحاليّة ليست «جديدة» افتراضياً (نافذة الجديد ٧ أيام)
      const pCreatedAt = new Date(Date.now() - pAge * 86_400_000);
      // حقولٌ قانونيّة تُفرَض (create+update): السعر، الخصم، المبيعات، التقييم، وقت الإنشاء.
      const canonicalProductFields = {
        basePrice: new Prisma.Decimal(p.price),
        compareAtPrice: pp.compareAt != null ? new Prisma.Decimal(pp.compareAt) : null,
        soldCount: pp.sold ?? 0,
        createdAt: pCreatedAt,
        sectionId: pp.section ? (sectionIdByName[pp.section] ?? null) : null,
        ...(pp.rating ? { ratingAvg: new Prisma.Decimal(pp.rating[0]), ratingCount: pp.rating[1] } : {}),
      };
      const product = await prisma.product.upsert({
        where: { slug: pSlug },
        update: canonicalProductFields,
        create: {
          vendorId: vendor.id,
          categoryId,
          title: p.title,
          titleNorm: normalizeArabic(p.title),
          slug: pSlug,
          description: `${p.title} — منتج عراقي بجودة ممتازة من ${v.storeName}.`,
          status: ProductStatus.ACTIVE,
          ...canonicalProductFields,
        },
      });

      // صورةُ المنتج: بديلٌ مُوسومٌ بالاسم والفئة (يُستبدل بصورةٍ حقيقيّة عند الرفع).
      const phUrl = ph(p.title, catNameBySlug[v.catSlug] ?? p.title);
      const firstImg = await prisma.productImage.findFirst({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } });
      if (!firstImg) {
        await prisma.productImage.create({ data: { productId: product.id, url: phUrl, alt: p.title, sortOrder: 0 } });
      } else if (firstImg.url.startsWith("/placeholder") || firstImg.url.startsWith("/api/ph")) {
        // نُحدّث البدائل فقط — لا نلمس صورةً حقيقيّة رفعها البائع (https).
        await prisma.productImage.update({ where: { id: firstImg.id }, data: { url: phUrl, alt: p.title } });
      }

      // المتغيّرات (أو متغيّر افتراضي واحد إن لم تُحدَّد)
      const existingVariants = await prisma.productVariant.count({ where: { productId: product.id } });
      if (existingVariants === 0) {
        if (p.variants.length === 0) {
          await prisma.productVariant.create({
            data: { productId: product.id, sku: null, price: new Prisma.Decimal(p.price), stock: pp.out ? 0 : p.stock },
          });
        } else {
          for (const [size, price, stock] of p.variants as [string, number, number][]) {
            await prisma.productVariant.create({
              data: {
                productId: product.id,
                sku: `${pSlug}-${slugify(size)}`,
                attributes: { المقاس: size },
                price: new Prisma.Decimal(price),
                stock,
              },
            });
          }
        }
      }
      // إنفاذُ حالة «غير متوفّر» في كلّ بذرة (~١٠٪ من المنتجات) — لعرض الشارة.
      if (pp.out) {
        await prisma.productVariant.updateMany({ where: { productId: product.id }, data: { stock: 0 } });
      }
    }
    console.log(`✅ بائع: ${v.storeName} (${v.products.length} منتج)`);
  }

  // ── تنظيف النجف: حذف أيّ متجرٍ نجفيٍّ قديمٍ خارج القائمة المضبوطة (بيانات شبه حقيقيّة) ──
  // على قاعدةٍ قائمة قد تبقى متاجر نجفٍ سابقة؛ نحذفها بترتيبٍ آمنٍ للمفاتيح الأجنبيّة
  // (OrderItem → Payout → Order → VendorProfile). على بذرةٍ نظيفةٍ لا شيء يُحذف.
  const najafId = govByName["النجف"];
  if (najafId) {
    const stale = await prisma.vendorProfile.findMany({
      where: { governorateId: najafId, storeName: { notIn: NAJAF_STORE_NAMES } },
      select: { id: true },
    });
    const staleIds = stale.map((s) => s.id);
    if (staleIds.length) {
      const orders = await prisma.order.findMany({ where: { vendorId: { in: staleIds } }, select: { id: true } });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length) await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.payout.deleteMany({ where: { vendorId: { in: staleIds } } });
      await prisma.order.deleteMany({ where: { vendorId: { in: staleIds } } });
      await prisma.vendorProfile.deleteMany({ where: { id: { in: staleIds } } });
      console.log(`🗑️  حُذف ${staleIds.length} متجر نجفٍ قديمٍ خارج القائمة`);
    }
  }

  // ── بائع قيد المراجعة (لاختبار اعتماد الأدمن لاحقاً) ──
  const pendingUser = await prisma.user.upsert({
    where: { phone: "+9647705555555" },
    update: { role: Role.VENDOR, phoneVerified: true },
    create: { phone: "+9647705555555", name: "نور", role: Role.VENDOR, phoneVerified: true },
  });
  await prisma.vendorProfile.upsert({
    where: { userId: pendingUser.id },
    update: {},
    create: {
      userId: pendingUser.id,
      storeName: "متجر نور للإكسسوارات",
      slug: slugify("متجر نور للإكسسوارات"),
      slugNorm: normalizeArabic("متجر نور للإكسسوارات"),
      status: VendorStatus.PENDING,
      governorateId: govByName["أربيل"],
    },
  });
  console.log("✅ بائع قيد المراجعة (متجر نور)");

  // ── زبائن + عناوين ──
  const customersSeed = [
    { phone: "+9647708888888", name: "علي حسن", gov: "بغداد", area: "الكرادة" },
    { phone: "+9647709999999", name: "زينب كريم", gov: "النجف", area: "الكوفة" },
  ];
  const customers: { id: string; addressId: string }[] = [];
  for (const c of customersSeed) {
    const user = await prisma.user.upsert({
      where: { phone: c.phone },
      update: { name: c.name, phoneVerified: true },
      create: { phone: c.phone, name: c.name, role: Role.CUSTOMER, phoneVerified: true },
    });
    const govId = govByName[c.gov]!;
    const area = await prisma.area.findFirst({ where: { governorateId: govId, nameAr: c.area } });
    let address = await prisma.address.findFirst({ where: { userId: user.id } });
    if (!address && area) {
      address = await prisma.address.create({
        data: {
          userId: user.id,
          fullName: c.name,
          phone: c.phone,
          governorateId: govId,
          areaId: area.id,
          line: "قرب الجامع الكبير، بناية رقم 12",
          isDefault: true,
        },
      });
    }
    if (address) customers.push({ id: user.id, addressId: address.id });
  }
  console.log(`✅ ${customers.length} زبون + عناوينهم`);

  // ── مراجعات → تحديث تقييم المنتجات والبائعين ──
  const allProducts = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    select: { id: true, vendorId: true, ratingCount: true },
  });
  const reviewTexts = ["منتج ممتاز وجودة عالية", "وصل بسرعة، شكراً", "جيد لكن التغليف بسيط", "رائع وأنصح به"];
  let reviewCount = 0;
  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i]!;
    // لا نمسّ المنتجات ذات التقييم القانونيّ المضبوط مسبقاً.
    if (product.ratingCount > 0) continue;
    const numReviews = Math.min((i % 3) + 1, customers.length); // مراجعة لكل زبون متمايز
    let sum = 0;
    let count = 0;
    for (let r = 0; r < numReviews; r++) {
      const customer = customers[r % customers.length];
      if (!customer) continue;
      const rating = 3 + ((i + r) % 3); // 3..5
      const existingReview = await prisma.review.findFirst({
        where: { userId: customer.id, productId: product.id, orderId: null },
      });
      if (!existingReview) {
        await prisma.review.create({
          data: {
            userId: customer.id,
            productId: product.id,
            rating,
            comment: reviewTexts[(i + r) % reviewTexts.length],
            status: ReviewStatus.PUBLISHED,
          },
        });
      }
      sum += rating;
      count += 1;
      reviewCount += 1;
    }
    if (count > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: { ratingAvg: new Prisma.Decimal((sum / count).toFixed(2)), ratingCount: count },
      });
    }
  }
  // تقييمُ المتجر (تجربة الشراء) — تقييمٌ مستقلٌّ عن تقييم المنتجات.
  const storeReviewTexts = ["تعامل ممتاز والتوصيل سريع", "بائع أمين وبضاعته مطابقة", "خدمة طيّبة، أنصح بالشراء منه", "رائع والردّ سريع"];
  const vendorsAll = await prisma.vendorProfile.findMany({ select: { id: true, ratingCount: true } });
  let storeReviewCount = 0;
  for (let i = 0; i < vendorsAll.length; i++) {
    const v = vendorsAll[i]!;
    // المتاجر القانونيّة لها تقييمٌ مضبوط — لا نُعيد حسابه.
    if (v.ratingCount > 0) continue;
    const numReviews = Math.min((i % 3) + 1, customers.length);
    let sum = 0;
    let count = 0;
    for (let r = 0; r < numReviews; r++) {
      const customer = customers[r % customers.length];
      if (!customer) continue;
      const rating = 3 + ((i + r) % 3); // 3..5
      await prisma.storeReview.upsert({
        where: { userId_vendorId: { userId: customer.id, vendorId: v.id } },
        update: {},
        create: {
          userId: customer.id,
          vendorId: v.id,
          rating,
          comment: storeReviewTexts[(i + r) % storeReviewTexts.length],
          status: ReviewStatus.PUBLISHED,
        },
      });
      sum += rating;
      count += 1;
      storeReviewCount += 1;
    }
    await prisma.vendorProfile.update({
      where: { id: v.id },
      data: {
        ratingAvg: count > 0 ? new Prisma.Decimal((sum / count).toFixed(2)) : new Prisma.Decimal(0),
        ratingCount: count,
      },
    });
  }
  console.log(`✅ ${storeReviewCount} تقييم متجر`);
  console.log(`✅ ${reviewCount} مراجعة + تحديث التقييمات`);

  // ── مفضلة ──
  if (customers[0]) {
    for (const p of allProducts.slice(0, 3)) {
      await prisma.favorite.upsert({
        where: { userId_productId: { userId: customers[0].id, productId: p.id } },
        update: {},
        create: { userId: customers[0].id, productId: p.id },
      });
    }
    console.log("✅ مفضلة لعميل");
  }

  // ── طلبات نموذجية (لملء لوحات البائع/الأدمن) ──
  await seedSampleOrders(customers);

  // ── المحتوى التحريريّ («اكتشف اليوم» ← مقال/نصيحة اليوم) — يُدار من «المظهر ← المحتوى» ──
  const ARTICLES = [
    {
      slug: "best-grill-spots-baghdad", kind: "article", sortOrder: 0,
      title: "أفضل الأماكن للشواء في بغداد",
      excerpt: "من أبو نوّاس إلى الزوراء — جولةٌ في أشهى مشاوي العاصمة.",
      coverUrl: `/api/ph?t=${encodeURIComponent("أفضل أماكن الشواء")}&c=${encodeURIComponent("مطاعم")}&k=banner`,
      body: [
        "لا يكتمل مساءٌ بغداديٌّ دون رائحة الفحم ومسحوب الكباب على ضفاف دجلة. جمعنا لك أبرز الوجهات التي يقصدها أهل بغداد لتجربة شواءٍ أصيلة.",
        "١) كورنيش أبو نوّاس: المسكوف على الطريقة البغداديّة، يُشوى ببطءٍ على الحطب حتّى يتحوّل إلى ذهبٍ مقرمش.",
        "٢) منطقة الزوراء: مطاعم عائليّة تقدّم القوزي والكباب مع تمنٍ مبخّرٍ وسلطةٍ عراقيّة.",
        "٣) الكرادة: خياراتٌ عصريّة تمزج النكهة التراثيّة بأجواءٍ شبابيّة.",
        "نصيحتنا: اطلب المشاوي المشكّلة لتجرّب أكثر من نوعٍ في جلسةٍ واحدة، ولا تنسَ العنبة والطرشي.",
      ],
    },
    {
      slug: "how-to-choose-phone", kind: "tip", sortOrder: 1,
      title: "كيف تختار هاتفك الجديد؟",
      excerpt: "خمس نقاطٍ عمليّة قبل أن تدفع — من البطاريّة إلى ما بعد البيع.",
      coverUrl: `/api/ph?t=${encodeURIComponent("كيف تختار هاتفك")}&c=${encodeURIComponent("إلكترونيات")}&k=banner`,
      body: [
        "شراء هاتفٍ جديد قرارٌ يدوم سنتين أو أكثر. قبل أن تدفع، وازن هذه النقاط:",
        "١) البطاريّة: ابحث عن ٤٥٠٠ ملّي أمبير فأكثر إن كنت كثير الاستخدام.",
        "٢) الكاميرا: الأرقام لا تكفي — اقرأ تجارب المستخدمين وشاهد عيّناتٍ حقيقيّة.",
        "٣) التخزين: ١٢٨ غيغابايت حدٌّ أدنى مريح؛ ٢٥٦ إن كنت تصوّر كثيراً.",
        "٤) التحديثات: اختر علامةً تدعم هاتفك ببرمجيّاتٍ لسنواتٍ قادمة.",
        "٥) ما بعد البيع: اشترِ من متجرٍ موثّقٍ يوفّر ضماناً وصيانةً محليّة — والدفع عند الاستلام يمنحك طمأنينةً إضافيّة.",
      ],
    },
  ];
  for (const a of ARTICLES) {
    await prisma.article.upsert({ where: { slug: a.slug }, update: {}, create: a });
  }
  console.log(`✅ ${ARTICLES.length} مقال (اكتشف اليوم)`);

  console.log("🎉 اكتمل البذر بنجاح.");
}

/**
 * ينشئ طلبين نموذجيين: واحد مكتمل (مع عمولة وتسوية مدفوعة) وواحد قيد الانتظار،
 * بطريقة متّسقة مع نماذج العمولة/المخزون. يُحدّث المخزون و soldCount.
 */
async function seedSampleOrders(customers: { id: string; addressId: string }[]) {
  if (customers.length === 0) return;

  const variants = await prisma.productVariant.findMany({
    where: { stock: { gt: 0 } },
    include: { product: { include: { vendor: true } } },
    take: 4,
  });
  if (variants.length === 0) return;

  const now = new Date();
  // نبدأ التسلسل من أعلى رقمٍ قائمٍ لشهر الحال — كي لا يتضارب إعادةُ البذر
  // مع طلباتٍ سابقة (نفس أسلوب placeOrder المقاوم للحذف).
  const lastSeeded = await prisma.order.findFirst({
    where: { number: { startsWith: orderNumberPrefix(now) } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  let seq = (lastSeeded ? parseOrderSequence(lastSeeded.number) : 0) + 1;

  async function makeOrder(
    variant: (typeof variants)[number],
    customer: { id: string; addressId: string },
    quantity: number,
    targetStatus: OrderStatus,
  ) {
    const existing = await prisma.order.findFirst({
      where: { customerId: customer.id, vendorId: variant.product.vendorId, status: targetStatus },
    });
    if (existing) return existing;

    const address = await prisma.address.findUniqueOrThrow({
      where: { id: customer.addressId },
      include: { governorate: true, area: true },
    });
    const unitPrice = Number(variant.price);
    const subtotal = unitPrice * quantity;
    const deliveryFee = 5000;
    const rate = resolveCommissionRate(PLATFORM_RATE, variant.product.vendor.commissionRate ? Number(variant.product.vendor.commissionRate) : null);
    const { commissionAmount } = calculateCommission(subtotal, rate);

    const order = await prisma.order.create({
      data: {
        number: buildOrderNumber(seq++, now),
        customerId: customer.id,
        vendorId: variant.product.vendorId,
        status: targetStatus,
        subtotal: new Prisma.Decimal(subtotal),
        deliveryFee: new Prisma.Decimal(deliveryFee),
        total: new Prisma.Decimal(subtotal + deliveryFee),
        commissionRate: new Prisma.Decimal(rate),
        commissionAmount: new Prisma.Decimal(commissionAmount),
        shipTo: {
          fullName: address.fullName,
          phone: address.phone,
          governorate: address.governorate.nameAr,
          area: address.area.nameAr,
          line: address.line,
        },
        items: {
          create: [
            {
              productId: variant.productId,
              variantId: variant.id,
              titleSnapshot: variant.product.title,
              attributesSnapshot: variant.attributes ?? {},
              unitPrice: new Prisma.Decimal(unitPrice),
              quantity,
              lineTotal: new Prisma.Decimal(subtotal),
            },
          ],
        },
      },
    });

    // سجل الحالات حتى الحالة المستهدفة
    const flow: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ];
    const upto = flow.slice(0, flow.indexOf(targetStatus) + 1);
    let prev: OrderStatus | null = null;
    for (const s of upto) {
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: prev, toStatus: s, note: "بذرة" },
      });
      prev = s;
    }

    // تحديث المخزون والمبيعات
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stock: { decrement: quantity } },
    });
    await prisma.product.update({
      where: { id: variant.productId },
      data: { soldCount: { increment: quantity } },
    });

    // عمولة + تسوية للطلب المكتمل
    if (targetStatus === OrderStatus.COMPLETED) {
      const payout = await prisma.payout.create({
        data: {
          vendorId: variant.product.vendorId,
          amount: new Prisma.Decimal(subtotal - commissionAmount),
          status: PayoutStatus.PAID,
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd: now,
          paidAt: now,
        },
      });
      await prisma.commission.create({
        data: {
          orderId: order.id,
          vendorId: variant.product.vendorId,
          rate: new Prisma.Decimal(rate),
          amount: new Prisma.Decimal(commissionAmount),
          payoutId: payout.id,
        },
      });
    } else {
      await prisma.commission.create({
        data: {
          orderId: order.id,
          vendorId: variant.product.vendorId,
          rate: new Prisma.Decimal(rate),
          amount: new Prisma.Decimal(commissionAmount),
        },
      });
    }
    return order;
  }

  await makeOrder(variants[0]!, customers[0]!, 2, OrderStatus.COMPLETED);
  if (variants[1] && customers[0]) await makeOrder(variants[1], customers[0], 1, OrderStatus.PENDING);
  if (variants[2] && customers[1]) await makeOrder(variants[2], customers[1], 1, OrderStatus.SHIPPED);
  console.log("✅ طلبات نموذجية (مكتمل + قيد الانتظار + قيد الشحن) مع عمولات وتسوية");

  // ── إعلاناتٌ نموذجيّة (لافتات الرئيسية) — تُدار من لوحة «المظهر» ← الإعلانات ──
  const ADS: { title: string; subtitle: string; imageUrl: string; linkUrl: string; gov?: string; sortOrder: number }[] = [
    { title: "أسبوع النحاسيّات البغداديّة", subtitle: "دلال وصواني من قلب سوق الصفافير", imageUrl: "/souks/souk-lantern.jpg", linkUrl: "/search?q=نحاس", gov: "بغداد", sortOrder: 0 },
    { title: "موسم التمور البصريّة", subtitle: "من نخيل شطّ العرب إلى بابك", imageUrl: "/gov/basra.jpg", linkUrl: "/search?q=تمر", gov: "البصرة", sortOrder: 1 },
    { title: "عروض السوگ لكلّ العراق", subtitle: "تشكيلةٌ مختارة والدفع عند الاستلام", imageUrl: "/hero-souk.jpg", linkUrl: "/search", sortOrder: 2 },
  ];
  // idempotent: نمسح الإعلانات النموذجيّة السابقة (بعناوينها) ثم نعيد إنشاءها.
  await prisma.ad.deleteMany({ where: { title: { in: ADS.map((a) => a.title) } } });
  for (const a of ADS) {
    const gov = a.gov ? await prisma.governorate.findUnique({ where: { nameAr: a.gov }, select: { id: true } }) : null;
    await prisma.ad.create({
      data: {
        title: a.title,
        subtitle: a.subtitle,
        imageUrl: a.imageUrl,
        linkUrl: a.linkUrl,
        placement: "home_banner",
        active: true,
        sortOrder: a.sortOrder,
        governorateId: gov?.id ?? null,
      },
    });
  }
  console.log(`✅ ${ADS.length} إعلان نموذجيّ (لافتات الرئيسية)`);

  // ── الأسواق: كلّ سوقٍ عالمٌ مستقلّ داخل «السوگ» (الرئيسية = «أيّ سوقٍ تدخل؟») ──
  const MARKETS: {
    slug: string;
    nameAr: string;
    tagline: string;
    icon: string;
    kind: "stores" | "category" | "external";
    categoryName?: string;
    channel?: "physical" | "online";
    status: "live" | "soon";
    imageUrl?: string;
  }[] = [
    // كلّ سوقٍ عالمٌ مستقلّ داخل المحافظة؛ «{gov}» يُستبدل باسم المحافظة وقت العرض.
    // الأسماء بلا كلمة «سوگ» — شعار التطبيق (بجانب الاسم) هو من يحمل هويّة السوگ.
    { slug: "stores", nameAr: "{gov}", tagline: "قلب المدينة — كلّ متاجرها في مكانٍ واحد", icon: "🏙️", kind: "stores", channel: "physical", status: "live", imageUrl: "/souks/souk-shorja.jpg" },
    // «بغداد الإلكتروني» عالمُ متاجرٍ إلكترونيّة (صفحات إنستغرام/فيسبوك/تيك توك)، لا فئةُ منتجاتٍ واقعيّة.
    { slug: "electronics", nameAr: "{gov} الإلكتروني", tagline: "مشاريعُ وصفحاتٌ على إنستغرام وفيسبوك وتيك توك", icon: "💻", kind: "stores", channel: "online", status: "live" },
    { slug: "food", nameAr: "المطاعم", tagline: "مطاعم ومأكولات ومنتجات محليّة", icon: "🍽️", kind: "category", categoryName: "مطاعم", status: "live", imageUrl: "/souks/souk-spice.jpg" },
    { slug: "realestate", nameAr: "العقار", tagline: "بيع، شراء، إيجار", icon: "🏠", kind: "category", status: "soon" },
    { slug: "cars", nameAr: "السيارات", tagline: "بيع وشراء المركبات", icon: "🚗", kind: "category", status: "soon" },
    { slug: "jobs", nameAr: "الوظائف", tagline: "فرص عمل في العراق", icon: "💼", kind: "category", status: "soon" },
    { slug: "services", nameAr: "الخدمات", tagline: "حِرفيّون وخدماتٌ منزليّة", icon: "🛠️", kind: "category", status: "soon" },
    { slug: "travel", nameAr: "السفر", tagline: "طيران، فنادق ورحلات", icon: "✈️", kind: "category", status: "soon" },
    { slug: "health", nameAr: "الصحة", tagline: "صيدليات، أطباء، مختبرات", icon: "🩺", kind: "category", status: "soon" },
    { slug: "education", nameAr: "التعليم", tagline: "دورات، مدارس، جامعات", icon: "🎓", kind: "category", status: "soon" },
  ];
  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i]!;
    const cat = m.categoryName ? await prisma.category.findFirst({ where: { nameAr: m.categoryName }, select: { slug: true } }) : null;
    await prisma.market.upsert({
      where: { slug: m.slug },
      update: { sortOrder: i }, // لا نلمس بقيّة الحقول كي تبقى تعديلات الأدمن
      create: {
        slug: m.slug,
        nameAr: m.nameAr,
        tagline: m.tagline,
        icon: m.icon,
        kind: m.kind,
        categorySlug: cat?.slug ?? null,
        channel: m.channel ?? null,
        status: m.status,
        enabled: true,
        sortOrder: i,
        imageUrl: m.imageUrl ?? null,
      },
    });
  }
  console.log(`✅ ${MARKETS.length} سوق`);
}

main()
  .catch((e) => {
    console.error("❌ فشل البذر:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
