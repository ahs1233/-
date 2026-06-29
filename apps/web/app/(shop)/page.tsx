import Link from "next/link";
import { ShieldCheck, Truck, BadgeCheck, ChevronLeft } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";
import { CategoryIcon } from "@/src/components/category-icon";

export const dynamic = "force-dynamic";

type Category = { id: string; nameAr: string; slug: string; icon: string | null };

export default async function HomePage() {
  let categories: Category[] = [];
  let products: { items: ProductCardData[] } = { items: [] };
  let dbReady = true;
  try {
    const api = await getServerApi();
    [categories, products] = await Promise.all([
      api.catalog.categories(),
      api.catalog.products({ sort: "newest", limit: 24 }),
    ]);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-7">
      {/* البطل */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-brand-600 via-brand-500 to-brand-700 p-6 text-white shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1.5px, transparent 1.5px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
            <BadgeCheck className="h-3.5 w-3.5" /> سوق العراق الموثوق
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
            كل ما تحتاجه من تجّار محافظتك
          </h1>
          <p className="mt-1 max-w-md text-sm text-white/90">
            تسوّق من متاجر موثوقة في عموم العراق، والدفع عند الاستلام — بساطة وأمان.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Feature icon={<Truck className="h-4 w-4" />} text="دفع عند الاستلام" />
            <Feature icon={<ShieldCheck className="h-4 w-4" />} text="تجّار موثوقون" />
            <Feature icon={<BadgeCheck className="h-4 w-4" />} text="منتجات عراقية" />
          </div>
        </div>
      </section>

      {!dbReady && (
        <div className="rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-600">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      {/* الفئات */}
      {categories.length > 0 && (
        <section>
          <SectionHeader title="تسوّق حسب الفئة" href="/categories" />
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {categories.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2">
                <span className="grid h-16 w-16 place-items-center rounded-2xl border border-neutral-200 bg-white text-brand-600 shadow-sm transition group-hover:border-brand-300 group-hover:bg-brand-50">
                  <CategoryIcon name={c.icon} className="h-6 w-6" />
                </span>
                <span className="line-clamp-1 text-center text-[11px] text-neutral-600">{c.nameAr}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* المنتجات */}
      <section>
        <SectionHeader title="أحدث المنتجات" />
        {products.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
            لا توجد منتجات بعد.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
      {icon}
      {text}
    </span>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-sm text-brand-600 hover:text-brand-700">
          الكل <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
