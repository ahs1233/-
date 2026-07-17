/**
 * راوتر الكتالوج — قراءة عامة للفئات والمنتجات والمتاجر.
 * البحث العربي: نطبّع الاستعلام ونطابقه على عمود titleNorm (contains).
 * يعرض فقط المنتجات ACTIVE من بائعين APPROVED.
 */
import { z } from "zod";
import { Prisma } from "@al-souq/db";
import { normalizeArabic, tokenize } from "@al-souq/utils";
import { productListQuerySchema } from "@al-souq/validators";
import { router, publicProcedure } from "../trpc";

// ── مخططات الإخراج (مطلوبة لتوليد OpenAPI للـ native) ──
const productCardOut = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  ratingAvg: z.number(),
  ratingCount: z.number(),
  available: z.number(),
  image: z.string().nullable(),
  vendor: z.object({ storeName: z.string(), slug: z.string() }),
});

const categoriesOut = z.array(
  z.object({
    id: z.string(),
    nameAr: z.string(),
    slug: z.string(),
    icon: z.string().nullable(),
    children: z.array(z.object({ id: z.string(), nameAr: z.string(), slug: z.string() })),
  }),
);

const productDetailOut = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    basePrice: z.number(),
    compareAtPrice: z.number().nullable(),
    ratingAvg: z.number(),
    ratingCount: z.number(),
    images: z.array(z.object({ url: z.string(), alt: z.string().nullable() })),
    variants: z.array(
      z.object({
        id: z.string(),
        sku: z.string().nullable(),
        attributes: z.unknown(),
        price: z.number(),
        available: z.number(),
      }),
    ),
    vendor: z.object({
      id: z.string(),
      storeName: z.string(),
      slug: z.string(),
      governorate: z.object({ nameAr: z.string() }).nullable(),
    }),
    category: z.object({ id: z.string(), nameAr: z.string(), slug: z.string() }),
  })
  .nullable();

const storeOut = z
  .object({
    vendor: z.object({
      id: z.string(),
      storeName: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      logoUrl: z.string().nullable(),
      bannerUrl: z.string().nullable(),
      governorate: z.object({ nameAr: z.string() }).nullable(),
      channel: z.string(),
      instagramUrl: z.string().nullable(),
      facebookUrl: z.string().nullable(),
      tiktokUrl: z.string().nullable(),
      ratingAvg: z.number(),
      ratingCount: z.number(),
      productCount: z.number(),
      memberSince: z.string(),
    }),
    products: z.array(productCardOut),
  })
  .nullable();

function serializeProduct(p: {
  id: string;
  title: string;
  slug: string;
  basePrice: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  ratingAvg: Prisma.Decimal;
  ratingCount: number;
  images: { url: string }[];
  variants?: { stock: number; reservedStock: number }[];
  vendor: { storeName: string; slug: string };
}) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: Number(p.basePrice),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    available: (p.variants ?? []).reduce((s, v) => s + Math.max(0, v.stock - v.reservedStock), 0),
    image: p.images[0]?.url ?? null,
    vendor: { storeName: p.vendor.storeName, slug: p.vendor.slug },
  };
}

export const catalogRouter = router({
  categories: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/categories", tags: ["catalog"] } })
    .input(z.void())
    .output(categoriesOut)
    .query(async ({ ctx }) => {
      return ctx.prisma.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          nameAr: true,
          slug: true,
          icon: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, nameAr: true, slug: true },
          },
        },
      });
    }),

  // اقتراحات بحث فورية (منتجات + فئات مطابقة)
  suggest: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/suggest", tags: ["catalog"] } })
    .input(z.object({ q: z.string().min(1).max(60), governorateId: z.string().cuid().optional() }))
    .output(
      z.object({
        products: z.array(z.object({ title: z.string(), slug: z.string() })),
        categories: z.array(z.object({ nameAr: z.string(), slug: z.string() })),
      }),
    )
    .query(async ({ ctx, input }) => {
      const norm = normalizeArabic(input.q);
      if (!norm) return { products: [], categories: [] };
      const [products, categories] = await Promise.all([
        ctx.prisma.product.findMany({
          where: {
            status: "ACTIVE",
            vendor: { status: "APPROVED", ...(input.governorateId ? { governorateId: input.governorateId } : {}) },
            titleNorm: { contains: norm },
          },
          take: 6,
          orderBy: { soldCount: "desc" },
          select: { title: true, slug: true },
        }),
        ctx.prisma.category.findMany({
          where: { isActive: true },
          take: 20,
          select: { nameAr: true, slug: true },
        }),
      ]);
      // ترشيح الفئات بالتطبيع في الذاكرة (أسماء قليلة)
      const cats = categories.filter((c) => normalizeArabic(c.nameAr).includes(norm)).slice(0, 4);
      return { products, categories: cats };
    }),

  categoryBySlug: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/categories/{slug}", tags: ["catalog"] } })
    .input(z.object({ slug: z.string() }))
    .output(
      z
        .object({
          id: z.string(),
          nameAr: z.string(),
          slug: z.string(),
          icon: z.string().nullable(),
          imageUrl: z.string().nullable(),
          parent: z.object({ nameAr: z.string(), slug: z.string() }).nullable(),
          childIds: z.array(z.string()),
          // الفئات الفرعيّة (أقسام هذا «السوق») — لعرضها كبوّاباتٍ مستقلّة.
          children: z.array(z.object({ id: z.string(), nameAr: z.string(), slug: z.string(), icon: z.string().nullable(), imageUrl: z.string().nullable() })),
        })
        .nullable(),
    )
    .query(async ({ ctx, input }) => {
      const cat = await ctx.prisma.category.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          nameAr: true,
          slug: true,
          icon: true,
          imageUrl: true,
          parent: { select: { nameAr: true, slug: true } },
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, nameAr: true, slug: true, icon: true, imageUrl: true },
          },
        },
      });
      if (!cat) return null;
      return {
        id: cat.id,
        nameAr: cat.nameAr,
        slug: cat.slug,
        icon: cat.icon,
        imageUrl: cat.imageUrl,
        parent: cat.parent ? { nameAr: cat.parent.nameAr, slug: cat.parent.slug } : null,
        childIds: cat.children.map((c) => c.id),
        children: cat.children.map((c) => ({ id: c.id, nameAr: c.nameAr, slug: c.slug, icon: c.icon, imageUrl: c.imageUrl })),
      };
    }),

  products: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/products", tags: ["catalog"] } })
    .input(productListQuerySchema)
    .output(z.object({ items: z.array(productCardOut), nextCursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ProductWhereInput = {
        status: "ACTIVE",
        vendor: { status: "APPROVED", ...(input.governorateId ? { governorateId: input.governorateId } : {}) },
      };
      if (input.q) {
        // بحث عربي متعدّد الكلمات: كل كلمة مطبّعة يجب أن تَرِد (AND)
        const tokens = tokenize(input.q);
        if (tokens.length > 0) {
          where.AND = tokens.map((t) => ({ titleNorm: { contains: t } }));
        }
      }
      if (input.categoryId) {
        // فئة أب → اشمل منتجات فئاتها الفرعية أيضاً
        const children = await ctx.prisma.category.findMany({
          where: { parentId: input.categoryId },
          select: { id: true },
        });
        where.categoryId = { in: [input.categoryId, ...children.map((c) => c.id)] };
      }
      if (input.vendorId) where.vendorId = input.vendorId;
      if (input.minPrice !== undefined || input.maxPrice !== undefined) {
        where.basePrice = {};
        if (input.minPrice !== undefined) where.basePrice.gte = new Prisma.Decimal(input.minPrice);
        if (input.maxPrice !== undefined) where.basePrice.lte = new Prisma.Decimal(input.maxPrice);
      }

      // ترتيب النتائج: للسعر/التقييم صريح؛ وإلا للبحث نرتّب بالصلة (الأكثر مبيعاً
      // ثم الأعلى تقييماً) وللتصفّح العام بالأحدث.
      const orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] =
        input.sort === "price_asc"
          ? { basePrice: "asc" }
          : input.sort === "price_desc"
            ? { basePrice: "desc" }
            : input.sort === "rating"
              ? { ratingAvg: "desc" }
              : input.q
                ? [{ soldCount: "desc" }, { ratingAvg: "desc" }, { createdAt: "desc" }]
                : { createdAt: "desc" };

      const items = await ctx.prisma.product.findMany({
        where,
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          compareAtPrice: true,
          ratingAvg: true,
          ratingCount: true,
          variants: { where: { isActive: true }, select: { stock: true, reservedStock: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          vendor: { select: { storeName: true, slug: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items: items.map(serializeProduct), nextCursor };
    }),

  productBySlug: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/products/{slug}", tags: ["catalog"] } })
    .input(z.object({ slug: z.string() }))
    .output(productDetailOut)
    .query(async ({ ctx, input }) => {
      const p = await ctx.prisma.product.findFirst({
        where: { slug: input.slug, status: "ACTIVE" },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          variants: { where: { isActive: true } },
          vendor: { select: { id: true, storeName: true, slug: true, governorate: { select: { nameAr: true } } } },
          category: { select: { id: true, nameAr: true, slug: true } },
        },
      });
      if (!p) return null;
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        basePrice: Number(p.basePrice),
        compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          attributes: v.attributes,
          price: Number(v.price),
          available: Math.max(0, v.stock - v.reservedStock),
        })),
        vendor: p.vendor,
        category: p.category,
      };
    }),

  storeBySlug: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/stores/{slug}", tags: ["catalog"] } })
    .input(z.object({ slug: z.string() }))
    .output(storeOut)
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendorProfile.findFirst({
        where: { slug: input.slug, status: "APPROVED" },
        select: {
          id: true,
          storeName: true,
          slug: true,
          description: true,
          logoUrl: true,
          bannerUrl: true,
          governorate: { select: { nameAr: true } },
          channel: true,
          instagramUrl: true,
          facebookUrl: true,
          tiktokUrl: true,
          ratingAvg: true,
          ratingCount: true,
          createdAt: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
      });
      if (!vendor) return null;
      const products = await ctx.prisma.product.findMany({
        where: { vendorId: vendor.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          compareAtPrice: true,
          ratingAvg: true,
          ratingCount: true,
          variants: { where: { isActive: true }, select: { stock: true, reservedStock: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          vendor: { select: { storeName: true, slug: true } },
        },
      });
      const { createdAt, _count, ratingAvg, ...rest } = vendor;
      return {
        vendor: {
          ...rest,
          ratingAvg: Number(ratingAvg),
          productCount: _count.products,
          memberSince: createdAt.toISOString(),
        },
        products: products.map(serializeProduct),
      };
    }),

  // قائمة المتاجر (اختياري حسب المحافظة) — لتصفّح سوق كل محافظة
  stores: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/stores", tags: ["catalog"] } })
    .input(z.object({ governorateId: z.string().cuid().optional() }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          storeName: z.string(),
          slug: z.string(),
          logoUrl: z.string().nullable(),
          bannerUrl: z.string().nullable(),
          verified: z.boolean(),
          category: z.string().nullable(),
          governorate: z.string().nullable(),
          ratingAvg: z.number(),
          ratingCount: z.number(),
          productCount: z.number(),
          salesCount: z.number(),
          createdAt: z.string(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const vendorWhere = { status: "APPROVED" as const, ...(input.governorateId ? { governorateId: input.governorateId } : {}) };
      const [vendors, salesGroups] = await Promise.all([
        ctx.prisma.vendorProfile.findMany({
          where: vendorWhere,
          orderBy: { ratingAvg: "desc" },
          take: 60,
          select: {
            id: true,
            storeName: true,
            slug: true,
            logoUrl: true,
            bannerUrl: true,
            verified: true,
            ratingAvg: true,
            ratingCount: true,
            createdAt: true,
            governorate: { select: { nameAr: true } },
            _count: { select: { products: { where: { status: "ACTIVE" } } } },
            // فئةُ المتجر = فئة أكثر منتجاته مبيعاً (عليا إن وُجدت).
            products: { where: { status: "ACTIVE" }, orderBy: { soldCount: "desc" }, take: 1, select: { category: { select: { nameAr: true, parent: { select: { nameAr: true } } } } } },
          },
        }),
        // مبيعات كلّ متجر = مجموع مبيعات منتجاته — لفرز «الأكثر مبيعاً».
        ctx.prisma.product.groupBy({ by: ["vendorId"], where: { vendor: vendorWhere }, _sum: { soldCount: true } }),
      ]);
      const salesByVendor = new Map(salesGroups.map((g) => [g.vendorId, g._sum.soldCount ?? 0]));
      return vendors.map((v) => ({
        id: v.id,
        storeName: v.storeName,
        slug: v.slug,
        logoUrl: v.logoUrl,
        bannerUrl: v.bannerUrl,
        verified: v.verified,
        category: v.products[0]?.category.parent?.nameAr ?? v.products[0]?.category.nameAr ?? null,
        governorate: v.governorate?.nameAr ?? null,
        ratingAvg: Number(v.ratingAvg),
        ratingCount: v.ratingCount,
        productCount: v._count.products,
        salesCount: salesByVendor.get(v.id) ?? 0,
        createdAt: v.createdAt.toISOString(),
      }));
    }),
});
