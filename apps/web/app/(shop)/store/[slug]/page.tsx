import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Store, MapPin, BadgeCheck } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard } from "@/src/components/product-card";
import { decodeSlug } from "@/src/lib/slug";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://one-theta-81.vercel.app";

async function getStore(slug: string) {
  const api = await getServerApi();
  return api.catalog.storeBySlug({ slug: decodeSlug(slug) });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const data = await getStore(params.slug);
    if (!data) return { title: "متجر غير موجود" };
    const description =
      data.vendor.description?.slice(0, 160) ??
      `تسوّق من ${data.vendor.storeName}${data.vendor.governorate ? ` في ${data.vendor.governorate.nameAr}` : ""} — الدفع عند الاستلام في السوگ.`;
    const url = `${BASE}/store/${encodeURIComponent(data.vendor.slug)}`;
    return {
      title: data.vendor.storeName,
      description,
      alternates: { canonical: url },
      openGraph: { title: data.vendor.storeName, description, url, type: "website", siteName: "السوگ", locale: "ar_IQ" },
    };
  } catch {
    return { title: "السوگ" };
  }
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const data = await getStore(params.slug);
  if (!data) notFound();
  const { vendor, products } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: vendor.storeName,
    description: vendor.description ?? undefined,
    url: `${BASE}/store/${encodeURIComponent(vendor.slug)}`,
    ...(vendor.governorate
      ? { address: { "@type": "PostalAddress", addressRegion: vendor.governorate.nameAr, addressCountry: "IQ" } }
      : {}),
  };

  return (
    <div className="space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-bl from-brand-500 to-brand-700" />
        <div className="flex items-start gap-3 p-4">
          <span className="-mt-10 grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-brand-50 text-brand-600 shadow">
            {vendor.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img loading="lazy" decoding="async" src={vendor.logoUrl} alt={vendor.storeName} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-8 w-8" />
            )}
          </span>
          <div className="flex-1 pt-1">
            <h1 className="flex items-center gap-1.5 text-xl font-bold text-neutral-900">
              {vendor.storeName}
              <BadgeCheck className="h-5 w-5 text-brand-500" />
            </h1>
            {vendor.governorate && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-neutral-500">
                <MapPin className="h-3.5 w-3.5" /> {vendor.governorate.nameAr}
              </p>
            )}
            {vendor.description && <p className="mt-1.5 text-sm text-neutral-600">{vendor.description}</p>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">منتجات المتجر ({products.length})</h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
            لا توجد منتجات في هذا المتجر بعد.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
