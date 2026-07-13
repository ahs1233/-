import { z } from "zod";
import { normalizeIraqiPhone } from "@al-souq/utils";

/** رقم هاتف عراقي — يُطبّع إلى E.164 ويرفض غير الصالح. */
export const iraqiPhone = z
  .string()
  .trim()
  .transform((val, ctx) => {
    const norm = normalizeIraqiPhone(val);
    if (!norm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "رقم هاتف عراقي غير صالح" });
      return z.NEVER;
    }
    return norm;
  });

// ─────────────────────────── Auth ───────────────────────────

export const requestOtpSchema = z.object({
  phone: iraqiPhone,
  purpose: z.enum(["login", "verify"]).default("login"),
});

export const verifyOtpSchema = z.object({
  phone: iraqiPhone,
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "الرمز يجب أن يكون أرقاماً"),
});

export const completeProfileSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جداً").max(60),
  email: z.string().email("بريد غير صالح").optional().or(z.literal("")),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// ─────────────────────────── Address ───────────────────────────

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(60),
  phone: iraqiPhone,
  governorateId: z.string().cuid(),
  areaId: z.string().cuid(),
  line: z.string().trim().min(3, "أدخل أقرب نقطة دالة").max(200),
  isDefault: z.boolean().default(false),
});

// ─────────────────────────── Vendor ───────────────────────────

export const vendorRegisterSchema = z.object({
  storeName: z.string().trim().min(2, "اسم المتجر قصير").max(80),
  description: z.string().trim().max(500).optional(),
  governorateId: z.string().cuid(),
});

export const vendorReviewSchema = z.object({
  vendorId: z.string().cuid(),
  decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
  note: z.string().trim().max(300).optional(),
});

export const vendorSettingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  governorateId: z.string().cuid().optional(),
  // تفاصيل التسوية (طريقة استلام البائع لمستحقاته)
  payoutMethod: z.string().trim().max(40).optional(),
  payoutAccount: z.string().trim().max(80).optional(),
});

export const updateStockSchema = z.object({
  variantId: z.string().cuid(),
  stock: z.number().int().min(0).max(1_000_000),
});

export const orderStatusUpdateSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(200).optional(),
});

export const presignUploadSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  purpose: z.enum(["product", "logo", "banner", "gov", "ad"]).default("product"),
});

// ─────────────────────────── Admin ───────────────────────────

export const categoryCreateSchema = z.object({
  nameAr: z.string().trim().min(2).max(60),
  parentId: z.string().cuid().optional().nullable(),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const categoryUpdateSchema = z.object({
  id: z.string().cuid(),
  nameAr: z.string().trim().min(2).max(60).optional(),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  /** تجاوز عمولة الفئة (0..1)؛ null لإزالته والعودة لعمولة البائع/المنصّة. */
  commissionRate: z.number().min(0).max(1).nullable().optional(),
});

export const productReviewSchema = z.object({
  productId: z.string().cuid(),
  decision: z.enum(["ACTIVE", "REJECTED", "ARCHIVED"]),
  note: z.string().trim().max(300).optional(),
});

export const userManageSchema = z.object({
  userId: z.string().cuid(),
  action: z.enum(["block", "unblock"]),
});

// ─────────────────────────── Admin staff ───────────────────────────

/** إنشاء حساب موظف إداري بصلاحيات محدّدة. */
export const staffCreateSchema = z.object({
  phone: iraqiPhone,
  name: z.string().trim().min(2, "الاسم قصير").max(60),
  staffTitle: z.string().trim().max(60).optional(),
  permissions: z.array(z.string()).min(1, "اختر صلاحية واحدة على الأقل"),
  scopeGovernorateId: z.string().cuid().optional().nullable(),
});

/** تعديل صلاحيات/نطاق/مسمّى موظف. */
export const staffUpdateSchema = z.object({
  userId: z.string().cuid(),
  staffTitle: z.string().trim().max(60).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  scopeGovernorateId: z.string().cuid().nullable().optional(),
});

export const platformSettingsSchema = z.object({
  commissionRate: z.number().min(0).max(1).optional(),
  deliveryFee: z.number().int().min(0).max(100_000).optional(),
  /** رسوم توصيل خاصة لكل محافظة (تتجاوز الافتراضية) — المفتاح governorateId. */
  deliveryFeesByGov: z.record(z.string().cuid(), z.number().int().min(0).max(100_000)).optional(),
  /** حدّ أدنى لقيمة السلة (مجموع البضاعة) لإتمام الطلب. 0 = بلا حدّ. */
  minOrderValue: z.number().int().min(0).max(10_000_000).optional(),
});

// ─────────────────────── Appearance (المظهر) ───────────────────────
const hexColor = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "لونٌ سداسيّ غير صحيح");
const sectionKey = z.string().min(1).max(40);

/**
 * مرجع صورة: مسارٌ داخليّ (/…)، أو https، أو data URL (للرفع بلا تخزين كائنيّ).
 * السقف يسمح بـ data URL مُصغَّر (~2MB base64) كما يفعل رافع صور المنتجات.
 */
export const imageRef = z
  .string()
  .trim()
  .min(1)
  .max(3_000_000)
  .refine(
    (s) => s.startsWith("/") || s.startsWith("https://") || s.startsWith("data:image/"),
    "رابط صورة غير صالح",
  );

/** رابط وجهة النقر: مسارٌ داخليّ أو https. */
const linkRef = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((s) => s.startsWith("/") || s.startsWith("https://"), "رابط غير صالح");

const labelOverride = z.record(sectionKey, z.string().trim().max(40));

/** حالة الخدمة الرباعيّة: مُفعّل/تجريبيّ/قريباً/مخفيّ. */
export const serviceStatus = z.enum(["active", "beta", "soon", "hidden"]);

export const appearanceSchema = z.object({
  colors: z.object({ primary: hexColor, accent: hexColor, surface: hexColor, live: hexColor }),
  sections: z.array(z.object({ key: sectionKey, visible: z.boolean() })).max(24),
  // visible/soon تبقى للتوافق الخلفيّ؛ status هو المصدر الرسميّ للحالة الرباعيّة.
  services: z
    .array(
      z.object({
        key: sectionKey,
        visible: z.boolean().optional(),
        soon: z.boolean().optional(),
        status: serviceStatus.optional(),
      }),
    )
    .max(24),
  /** تجاوزات عناوين الأقسام (المفتاح = مفتاح القسم). */
  sectionTitles: labelOverride.optional(),
  /** تجاوزات تسميات الخدمات (المفتاح = مفتاح الخدمة). */
  serviceLabels: labelOverride.optional(),
});
export type AppearanceInput = z.infer<typeof appearanceSchema>;

// ─────────────────── Governorate presentation (تبويب المحافظات) ───────────────────
const soukTile = z.object({
  label: z.string().trim().min(1).max(40),
  q: z.string().trim().min(1).max(60),
  img: imageRef.optional(),
  emoji: z.string().trim().max(8).optional(),
  color: hexColor.optional(),
  status: z.enum(["active", "hidden"]).optional(),
});

export const governoratePresentationSchema = z.object({
  id: z.string().cuid(),
  enabled: z.boolean().optional(),
  tagline: z.string().trim().max(120).nullable().optional(),
  heroImageUrl: imageRef.nullable().optional(),
  souks: z.array(soukTile).max(12).nullable().optional(),
  sortOrder: z.number().int().min(0).max(200).optional(),
});
export type GovernoratePresentationInput = z.infer<typeof governoratePresentationSchema>;

// ─────────────────────── Ads (تبويب الإعلانات) ───────────────────────
export const adCreateSchema = z.object({
  title: z.string().trim().min(2, "العنوان قصير").max(80),
  subtitle: z.string().trim().max(120).nullable().optional(),
  imageUrl: imageRef,
  linkUrl: linkRef.default("/search"),
  placement: z.enum(["home_banner", "hero_strip"]).default("home_banner"),
  governorateId: z.string().cuid().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});
export const adUpdateSchema = adCreateSchema.partial().extend({ id: z.string().cuid() });
export const adDeleteSchema = z.object({ id: z.string().cuid() });
export type AdCreateInput = z.infer<typeof adCreateSchema>;
export type AdUpdateInput = z.infer<typeof adUpdateSchema>;

// ─────────────────────────── Product ───────────────────────────

const priceIQD = z
  .number({ invalid_type_error: "السعر مطلوب" })
  .int("السعر بالدينار بلا كسور")
  .min(250, "أقل سعر 250 د.ع")
  .max(100_000_000);

export const productVariantSchema = z.object({
  sku: z.string().trim().max(60).optional().nullable(),
  attributes: z.record(z.string()).default({}),
  price: priceIQD,
  stock: z.number().int().min(0),
});

/**
 * صورة منتج مقبولة:
 * - رابط https (تخزين كائني/CDN) بطول معقول، أو
 * - مسار نسبي داخل الموقع (placeholders)، أو
 * - data URL لصورة، بسقف حجم صارم (~260KB) — مسار احتياطي فقط ريثما يُفعَّل التخزين،
 *   يمنع حشو قاعدة البيانات بصور ضخمة.
 */
export const productImageSchema = z
  .string()
  .max(350_000, "الصورة كبيرة جداً")
  .refine(
    (v) =>
      /^https:\/\/[^\s]+$/.test(v) && v.length <= 2000
        ? true
        : /^\/[a-zA-Z0-9/_.-]+$/.test(v) && v.length <= 300
          ? true
          : /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "رابط صورة غير صالح",
  );

export const productCreateSchema = z.object({
  title: z.string().trim().min(3, "العنوان قصير").max(120),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().cuid(),
  basePrice: priceIQD,
  images: z.array(productImageSchema).max(8).default([]),
  variants: z.array(productVariantSchema).min(1, "أضف متغيّراً واحداً على الأقل"),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().cuid(),
});

// ─────────────────────────── Cart / Order ───────────────────────────

export const cartItemSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().nullable(),
  quantity: z.number().int().min(1).max(99),
});

/** رمز كوبون: أحرف/أرقام/شرطة، يُطبَّع إلى حروف كبيرة. */
export const couponCode = z
  .string()
  .trim()
  .min(3, "رمز قصير")
  .max(24, "رمز طويل")
  .regex(/^[A-Za-z0-9-]+$/, "رمز غير صالح")
  .transform((v) => v.toUpperCase());

export const placeOrderSchema = z.object({
  addressId: z.string().cuid(),
  items: z.array(cartItemSchema).min(1, "السلة فارغة"),
  customerNote: z.string().trim().max(300).optional(),
  couponCode: couponCode.optional(),
});

export const validateCouponSchema = z.object({
  code: couponCode,
  items: z.array(cartItemSchema).min(1, "السلة فارغة"),
});

// ─────────────────────────── Coupons (admin) ───────────────────────────

export const couponCreateSchema = z
  .object({
    code: couponCode,
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().positive("القيمة مطلوبة"),
    minSubtotal: z.number().int().min(0).default(0),
    maxDiscount: z.number().int().min(0).optional(),
    usageLimit: z.number().int().min(1).optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((v) => (v.type === "PERCENT" ? v.value <= 100 : true), {
    message: "النسبة يجب أن تكون ٠–١٠٠",
    path: ["value"],
  });

export const couponToggleSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean(),
});

// ─────────────────────────── Review ───────────────────────────

export const reviewCreateSchema = z.object({
  productId: z.string().cuid(),
  orderId: z.string().cuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

// ─────────────────────────── Search / List ───────────────────────────

export const productListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: z.string().cuid().optional(),
  vendorId: z.string().cuid().optional(),
  governorateId: z.string().cuid().optional(), // عزل السوق حسب المحافظة

  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating"]).default("newest"),
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
