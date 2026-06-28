import Link from "next/link";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard } from "@/src/components/product-card";

// يعتمد على قاعدة البيانات لكل طلب — لا تُولَّد ثابتةً وقت البناء
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const api = await getServerApi();
  const [categories, products] = await Promise.all([
    api.catalog.categories(),
    api.catalog.products({ sort: "newest", limit: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-gradient-to-l from-brand-500 to-brand-600 p-5 text-white">
        <h1 className="text-2xl font-bold">سوق العراق بين يديك</h1>
        <p className="mt-1 text-sm opacity-90">تسوّق من تجار موثوقين — والدفع عند الاستلام.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">الفئات</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="flex-shrink-0 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:border-brand-400"
            >
              {c.nameAr}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">أحدث المنتجات</h2>
        {products.items.length === 0 ? (
          <p className="text-neutral-500">لا توجد منتجات بعد.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
