import { notFound } from "next/navigation";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard } from "@/src/components/product-card";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: { slug: string } }) {
  const api = await getServerApi();
  const data = await api.catalog.storeBySlug({ slug: params.slug });
  if (!data) notFound();
  const { vendor, products } = data;

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-gradient-to-l from-brand-600 to-brand-700 p-5 text-white">
        <h1 className="text-2xl font-bold">{vendor.storeName}</h1>
        {vendor.governorate && <p className="text-sm opacity-90">{vendor.governorate.nameAr}</p>}
        {vendor.description && <p className="mt-2 text-sm opacity-90">{vendor.description}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">منتجات المتجر</h2>
        {products.length === 0 ? (
          <p className="text-neutral-500">لا توجد منتجات.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
