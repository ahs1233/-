import Link from "next/link";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";

// يعتمد على قاعدة البيانات لكل طلب — لا تُولَّد ثابتةً وقت البناء
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // مرونة وقت الإقلاع: إن لم تكن قاعدة البيانات جاهزة بعد، تُفتح الصفحة برسالة
  // ودّية بدل خطأ 500 (مفيد قبل ربط Neon أول مرة).
  let categories: { id: string; nameAr: string; slug: string }[] = [];
  let products: { items: ProductCardData[] } = { items: [] };
  let dbReady = true;
  try {
    const api = await getServerApi();
    [categories, products] = await Promise.all([
      api.catalog.categories(),
      api.catalog.products({ sort: "newest", limit: 20 }),
    ]);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-gradient-to-l from-brand-500 to-brand-600 p-5 text-white">
        <h1 className="text-2xl font-bold">سوق العراق بين يديك</h1>
        <p className="mt-1 text-sm opacity-90">تسوّق من تجار موثوقين — والدفع عند الاستلام.</p>
      </section>

      {!dbReady && (
        <div className="rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-600">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد. أكمل خطوة قاعدة البيانات في دليل النشر.
        </div>
      )}

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
