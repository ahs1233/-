import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";
import { ProductCard } from "@/src/components/product-card";

export const dynamic = "force-dynamic";

type SP = { q?: string; sort?: string; minPrice?: string; maxPrice?: string };

const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "price_asc", label: "الأرخص" },
  { value: "price_desc", label: "الأغلى" },
  { value: "rating", label: "الأعلى تقييماً" },
];

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const api = await getServerApi();
  const gov = getGovernorate();
  const sort = (["newest", "price_asc", "price_desc", "rating"].includes(searchParams.sort ?? "")
    ? searchParams.sort
    : "newest") as "newest" | "price_asc" | "price_desc" | "rating";

  const results = await api.catalog.products({
    q: searchParams.q || undefined,
    sort,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    governorateId: gov?.id,
    limit: 40,
  });

  return (
    <div className="space-y-4">
      <form className="space-y-2" action="/search">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="ابحث عن منتج"
          className="h-11 w-full rounded-lg border border-neutral-300 px-3 outline-none focus:border-brand-400"
        />
        <div className="flex gap-2">
          <input
            name="minPrice"
            inputMode="numeric"
            defaultValue={searchParams.minPrice}
            placeholder="من (د.ع)"
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
          />
          <input
            name="maxPrice"
            inputMode="numeric"
            defaultValue={searchParams.maxPrice}
            placeholder="إلى (د.ع)"
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
          />
          <select name="sort" defaultValue={sort} className="h-10 rounded-lg border border-neutral-300 px-2 text-sm">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-lg bg-brand-500 px-4 text-sm text-white">بحث</button>
        </div>
      </form>

      {searchParams.q && (
        <p className="text-sm text-neutral-500">
          نتائج البحث عن «{searchParams.q}»: {results.items.length}
        </p>
      )}

      {results.items.length === 0 ? (
        <p className="text-neutral-500">لا توجد نتائج مطابقة.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
