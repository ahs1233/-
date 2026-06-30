import Link from "next/link";
import { ShieldCheck, Truck, BadgeCheck, ChevronLeft, Store, LayoutGrid } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";
import { CategoryIcon } from "@/src/components/category-icon";
import { BrandMark } from "@/src/components/brand-logo";

export const dynamic = "force-dynamic";

type Category = { id: string; nameAr: string; slug: string; icon: string | null };

export default async function HomePage() {
  const gov = getGovernorate();
  let categories: Category[] = [];
  let products: { items: ProductCardData[] } = { items: [] };
  let dbReady = true;
  try {
    const api = await getServerApi();
    [categories, products] = await Promise.all([
      api.catalog.categories(),
      api.catalog.products({ sort: "newest", limit: 24, governorateId: gov?.id }),
    ]);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-7">
      {/* البطل */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-brand-700 via-brand-600 to-petrol p-6 text-white shadow-lg ring-1 ring-gold-500/30">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1.5px, transparent 1.5px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
          }}
        />
        <BrandMark className="pointer-events-none absolute -bottom-6 -start-6 h-40 w-40 opacity-10" />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/50 bg-gold-400/15 px-3 py-1 text-xs font-semibold text-gold-100 backdrop-blur">
            <BadgeCheck className="h-3.5 w-3.5" /> ندعم المنتج العراقي
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
            {gov ? `سوق ${gov.name} بين يديك` : "كل ما تحتاجه من تجّار محافظتك"}
          </h1>
          <p className="mt-1 max-w-md text-sm text-white/90">
            تسوّق من متاجر موثوقة في {gov ? `محافظة ${gov.name}` : "محافظتك"}، والدفع عند الاستلام.
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

      <div className="grid grid-cols-2 gap-3">
        <Link href="/stores" className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 font-medium text-neutral-800 shadow-sm transition hover:border-brand-300">
          <Store className="h-5 w-5 text-brand-600" /> تصفّح المتاجر
        </Link>
        <Link href="/categories" className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 font-medium text-neutral-800 shadow-sm transition hover:border-brand-300">
          <LayoutGrid className="h-5 w-5 text-brand-600" /> كل الفئات
        </Link>
      </div>

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
