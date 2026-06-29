"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, X, Check } from "lucide-react";
import { trpc } from "@/src/trpc/react";

/**
 * شريط اختيار المحافظة + النافذة. يعزل السوق: كل اختيار يصفّي المنتجات والمتاجر.
 * عند أول زيارة (بلا اختيار) تُفتح النافذة إجبارياً.
 */
export function GovernorateBar({ current }: { current: { id: string; name: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const governorates = trpc.geo.governorates.useQuery(undefined, { enabled: open });

  // فرض الاختيار عند أول زيارة
  useEffect(() => {
    if (!current) setOpen(true);
  }, [current]);

  function select(id: string, name: string) {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `al_gov=${id}; path=/; max-age=${maxAge}; samesite=lax`;
    document.cookie = `al_gov_name=${encodeURIComponent(name)}; path=/; max-age=${maxAge}; samesite=lax`;
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 bg-brand-50 px-4 py-2 text-sm text-brand-700 transition hover:bg-brand-100"
      >
        <MapPin className="h-4 w-4 text-brand-600" />
        <span className="text-neutral-500">تسوّق في:</span>
        <span className="font-bold">{current?.name ?? "اختر محافظتك"}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => current && setOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 p-4">
              <h2 className="flex items-center gap-2 font-bold">
                <MapPin className="h-5 w-5 text-brand-600" /> اختر محافظتك
              </h2>
              {current && (
                <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <p className="px-4 pt-3 text-xs text-neutral-500">سنعرض لك متاجر ومنتجات محافظتك فقط.</p>
            <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto p-4">
              {governorates.isLoading && <p className="col-span-2 text-center text-sm text-neutral-400">جارٍ التحميل…</p>}
              {governorates.data?.map((g) => (
                <button
                  key={g.id}
                  onClick={() => select(g.id, g.nameAr)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-sm transition ${
                    current?.id === g.id
                      ? "border-brand-500 bg-brand-50 font-bold text-brand-700"
                      : "border-neutral-200 hover:border-brand-300 hover:bg-neutral-50"
                  }`}
                >
                  {g.nameAr}
                  {current?.id === g.id && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
