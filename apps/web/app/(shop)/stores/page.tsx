import Link from "next/link";
import { Store, Star, ChevronLeft } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const api = await getServerApi();
  const gov = getGovernorate();
  const stores = await api.catalog.stores({ governorateId: gov?.id });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">
        متاجر {gov ? gov.name : "العراق"}
      </h1>

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
          لا توجد متاجر في هذه المحافظة بعد.
        </div>
      ) : (
        <ul className="space-y-3">
          {stores.map((s) => (
            <Link key={s.id} href={`/store/${s.slug}`}>
              <li className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md">
                <span className="grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-600">
                  {s.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.logoUrl} alt={s.storeName} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-neutral-900">{s.storeName}</p>
                  <p className="text-xs text-neutral-500">
                    {s.productCount} منتج
                    {s.governorate ? ` · ${s.governorate}` : ""}
                  </p>
                  {s.ratingCount > 0 && (
                    <p className="flex items-center gap-1 text-xs text-gold-600">
                      <Star className="h-3 w-3 fill-gold-500 text-gold-500" /> {s.ratingAvg.toFixed(1)} ({s.ratingCount})
                    </p>
                  )}
                </div>
                <ChevronLeft className="h-5 w-5 text-neutral-300" />
              </li>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );
}
