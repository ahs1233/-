/**
 * راوتر الكتالوج — قراءة عامة للفئات والمنتجات والمتاجر.
 * البحث العربي: نطبّع الاستعلام ونطابقه على عمود titleNorm (contains).
 * يعرض فقط المنتجات ACTIVE من بائعين APPROVED.
 */
import { z } from "zod";
import { Prisma } from "@al-souq/db";
import { normalizeArabic } from "@al-souq/utils";
import { productListQuerySchema } from "@al-souq/validators";
import { router, publicProcedure } from "../trpc";

// ── مخططات الإخراج (مطلوبة لتوليد OpenAPI للـ native) ──
const productCardOut = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  price: z.number(),
  ratingAvg: z.number(),
  ratingCount: z.number(),
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
    }),
    products: z.array(productCardOut),
  })
  .nullable();

function serializeProduct(p: {
  id: string;
  title: string;
  slug: string;
  basePrice: Prisma.Decimal;
  ratingAvg: Prisma.Decimal;
  ratingCount: number;
  images: { url: string }[];
  vendor: { storeName: string; slug: string };
}) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: Number(p.basePrice),
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
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

  products: publicProcedure
    .meta({ openapi: { method: "GET", path: "/catalog/products", tags: ["catalog"] } })
    .input(productListQuerySchema)
    .output(z.object({ items: z.array(productCardOut), nextCursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ProductWhereInput = {
        status: "ACTIVE",
        vendor: { status: "APPROVED" },
      };
      if (input.q) where.titleNorm = { contains: normalizeArabic(input.q) };
      if (input.categoryId) where.categoryId = input.categoryId;
      if (input.vendorId) where.vendorId = input.vendorId;
      if (input.minPrice !== undefined || input.maxPrice !== undefined) {
        where.basePrice = {};
        if (input.minPrice !== undefined) where.basePrice.gte = new Prisma.Decimal(input.minPrice);
        if (input.maxPrice !== undefined) where.basePrice.lte = new Prisma.Decimal(input.maxPrice);
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput =
        input.sort === "price_asc"
          ? { basePrice: "asc" }
          : input.sort === "price_desc"
            ? { basePrice: "desc" }
            : input.sort === "rating"
              ? { ratingAvg: "desc" }
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
          ratingAvg: true,
          ratingCount: true,
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
          ratingAvg: true,
          ratingCount: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          vendor: { select: { storeName: true, slug: true } },
        },
      });
      return { vendor, products: products.map(serializeProduct) };
    }),
});
