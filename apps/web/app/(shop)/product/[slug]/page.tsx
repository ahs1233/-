import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerApi } from "@/src/trpc/server";
import { ProductDetail } from "@/src/components/product/product-detail";
import { decodeSlug } from "@/src/lib/slug";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://one-theta-81.vercel.app";

async function getProduct(slug: string) {
  const api = await getServerApi();
  return api.catalog.productBySlug({ slug: decodeSlug(slug) });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const p = await getProduct(params.slug);
    if (!p) return { title: "منتج غير موجود" };
    const description =
      p.description?.slice(0, 160) ?? `${p.title} من ${p.vendor.storeName} — الدفع عند الاستلام في السوگ.`;
    const image = p.images[0]?.url;
    const url = `${BASE}/product/${encodeURIComponent(p.slug)}`;
    return {
      title: p.title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title: p.title,
        description,
        url,
        type: "website",
        siteName: "السوگ",
        locale: "ar_IQ",
        ...(image && !image.startsWith("data:") ? { images: [{ url: image }] } : {}),
      },
    };
  } catch {
    return { title: "السوگ" };
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  // بيانات منظّمة Schema.org — تحسّن ظهور المنتج في نتائج البحث
  const available = product.variants.some((v) => v.available > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.images.map((i) => i.url).filter((u) => !u.startsWith("data:")),
    brand: { "@type": "Brand", name: product.vendor.storeName },
    offers: {
      "@type": "Offer",
      price: product.basePrice,
      priceCurrency: "IQD",
      availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${BASE}/product/${encodeURIComponent(product.slug)}`,
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetail product={product} />
    </>
  );
}
