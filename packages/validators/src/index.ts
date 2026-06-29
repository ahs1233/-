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
  purpose: z.enum(["product", "logo", "banner"]).default("product"),
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
});

export const productReviewSchema = z.object({
  productId: z.string().cuid(),
  decision: z.enum(["ACTIVE", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});

export const userManageSchema = z.object({
  userId: z.string().cuid(),
  action: z.enum(["block", "unblock"]),
});

export const platformSettingsSchema = z.object({
  commissionRate: z.number().min(0).max(1).optional(),
  deliveryFee: z.number().int().min(0).max(100_000).optional(),
});

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

export const productCreateSchema = z.object({
  title: z.string().trim().min(3, "العنوان قصير").max(120),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().cuid(),
  basePrice: priceIQD,
  images: z.array(z.string().url()).max(8).default([]),
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

export const placeOrderSchema = z.object({
  addressId: z.string().cuid(),
  items: z.array(cartItemSchema).min(1, "السلة فارغة"),
  customerNote: z.string().trim().max(300).optional(),
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
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating"]).default("newest"),
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
