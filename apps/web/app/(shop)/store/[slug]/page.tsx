import { notFound } from "next/navigation";
import { Store, MapPin, BadgeCheck } from "lucide-react";
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
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-bl from-brand-500 to-brand-700" />
        <div className="flex items-start gap-3 p-4">
          <span className="-mt-10 grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-brand-50 text-brand-600 shadow">
            {vendor.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={vendor.logoUrl} alt={vendor.storeName} className="h-full w-full object-cover" />
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
