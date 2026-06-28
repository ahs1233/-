/**
 * بذور بيانات واقعية للسوق العراقي.
 * يشمل: 18 محافظة + مناطق، فئات، أدمن، بائعين معتمدين، ومنتجات بأسعار IQD.
 * idempotent قدر الإمكان عبر upsert على المفاتيح الفريدة.
 */
import { PrismaClient, Prisma, Role, VendorStatus, ProductStatus } from "@prisma/client";
import { normalizeArabic, slugify } from "@al-souq/utils";

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

// ── الفئات ──
const CATEGORIES: { nameAr: string; icon: string; children: string[] }[] = [
  { nameAr: "أزياء رجالية", icon: "shirt", children: ["دشاديش", "قمصان", "أحذية رجالية", "عبايات رجالية"] },
  { nameAr: "أزياء نسائية", icon: "dress", children: ["عبايات", "فساتين", "أحذية نسائية", "حقائب"] },
  { nameAr: "إلكترونيات", icon: "smartphone", children: ["هواتف", "إكسسوارات هواتف", "سماعات", "شواحن"] },
  { nameAr: "منزل ومطبخ", icon: "home", children: ["أواني طبخ", "مفروشات", "أجهزة منزلية"] },
  { nameAr: "مستلزمات أطفال", icon: "baby", children: ["ملابس أطفال", "ألعاب", "مستلزمات رضّع"] },
  { nameAr: "عطور وتجميل", icon: "sparkles", children: ["عطور", "مكياج", "العناية بالبشرة"] },
  { nameAr: "بقالة وأطعمة", icon: "shopping-basket", children: ["تمور", "مكسرات", "بهارات", "حلويات"] },
];

async function main() {
  console.log("⏳ بدء بذر البيانات...");

  // المحافظات والمناطق
  const govByName: Record<string, string> = {};
  for (let i = 0; i < GOVERNORATES.length; i++) {
    const g = GOVERNORATES[i]!;
    const gov = await prisma.governorate.upsert({
      where: { code: g.code },
      update: { sortOrder: i },
      create: { nameAr: g.nameAr, code: g.code, sortOrder: i },
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
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i]!;
    const parentSlug = slugify(c.nameAr);
    const parent = await prisma.category.upsert({
      where: { slug: parentSlug },
      update: { sortOrder: i, icon: c.icon },
      create: { nameAr: c.nameAr, slug: parentSlug, icon: c.icon, sortOrder: i },
    });
    catBySlug[parentSlug] = parent.id;
    for (let j = 0; j < c.children.length; j++) {
      const childName = c.children[j]!;
      const childSlug = slugify(childName);
      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: { parentId: parent.id, sortOrder: j },
        create: { nameAr: childName, slug: childSlug, parentId: parent.id, sortOrder: j },
      });
      catBySlug[childSlug] = child.id;
    }
  }
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
      phone: "+9647702222222",
      name: "أم زينب",
      storeName: "بوتيك أم زينب",
      gov: "النجف",
      catSlug: slugify("عبايات"),
      products: [
        { title: "عباية كم واسع سوداء", price: 45000, stock: 30, variants: [["54", 45000, 10], ["56", 46000, 10], ["58", 47000, 10]] },
        { title: "فستان سهرة مخمل", price: 85000, stock: 12, variants: [["S", 85000, 4], ["M", 85000, 4], ["L", 87000, 4]] },
      ],
    },
    {
      phone: "+9647703333333",
      name: "حيدر",
      storeName: "موبايلات بغداد",
      gov: "بغداد",
      catSlug: slugify("اكسسوارات-هواتف"),
      products: [
        { title: "حافظة جلد آيفون 15", price: 12000, stock: 100, variants: [["أسود", 12000, 50], ["بني", 12000, 50]] },
        { title: "شاحن سريع 25 واط أصلي", price: 18000, stock: 60, variants: [] },
        { title: "سماعة بلوتوث لاسلكية", price: 22000, stock: 45, variants: [] },
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
  ];

  for (const v of vendorsSeed) {
    const user = await prisma.user.upsert({
      where: { phone: v.phone },
      update: { role: Role.VENDOR, phoneVerified: true },
      create: { phone: v.phone, name: v.name, role: Role.VENDOR, phoneVerified: true },
    });

    const slug = slugify(v.storeName);
    const vendor = await prisma.vendorProfile.upsert({
      where: { userId: user.id },
      update: { status: VendorStatus.APPROVED },
      create: {
        userId: user.id,
        storeName: v.storeName,
        slug,
        slugNorm: normalizeArabic(v.storeName),
        status: VendorStatus.APPROVED,
        approvedAt: new Date(),
        governorateId: govByName[v.gov],
      },
    });

    const categoryId = catBySlug[v.catSlug];
    if (!categoryId) {
      console.warn(`⚠️ فئة غير موجودة: ${v.catSlug}`);
      continue;
    }

    for (const p of v.products) {
      const pSlug = slugify(p.title) + "-" + vendor.id.slice(-4);
      const product = await prisma.product.upsert({
        where: { slug: pSlug },
        update: {},
        create: {
          vendorId: vendor.id,
          categoryId,
          title: p.title,
          titleNorm: normalizeArabic(p.title),
          slug: pSlug,
          description: `${p.title} — منتج عراقي بجودة ممتازة من ${v.storeName}.`,
          basePrice: new Prisma.Decimal(p.price),
          status: ProductStatus.ACTIVE,
        },
      });

      // الصور (روابط placeholder تُستبدل برفع حقيقي لاحقاً في لوحة البائع)
      const existingImages = await prisma.productImage.count({ where: { productId: product.id } });
      if (existingImages === 0) {
        await prisma.productImage.create({
          data: { productId: product.id, url: `/placeholder-product.svg`, alt: p.title, sortOrder: 0 },
        });
      }

      // المتغيّرات (أو متغيّر افتراضي واحد إن لم تُحدَّد)
      const existingVariants = await prisma.productVariant.count({ where: { productId: product.id } });
      if (existingVariants === 0) {
        if (p.variants.length === 0) {
          await prisma.productVariant.create({
            data: { productId: product.id, sku: null, price: new Prisma.Decimal(p.price), stock: p.stock },
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
    }
    console.log(`✅ بائع: ${v.storeName} (${v.products.length} منتج)`);
  }

  console.log("🎉 اكتمل البذر بنجاح.");
}

main()
  .catch((e) => {
    console.error("❌ فشل البذر:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
