"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, X, Check } from "lucide-react";
import { trpc } from "@/src/trpc/react";

/**
 * زرّ اختيار المحافظة (حبّة) للترويسة الداكنة + نافذة الاختيار.
 * عند أوّل زيارة (بلا اختيار) تُفتح النافذة إجبارياً — يعزل السوق بالمحافظة.
 */
export function GovPill({ current }: { current: { id: string; name: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const governorates = trpc.geo.governorates.useQuery(undefined, { enabled: open });

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
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line bg-card2 px-3 py-2 text-sm font-bold text-neutral-100 transition hover:border-gold-500/40"
      >
        <MapPin className="h-4 w-4 text-gold-400" />
        <span className="max-w-[5rem] truncate">{current?.name ?? "المحافظة"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => current && setOpen(false)}>
          <div className="bg-card max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-3xl border border-line text-neutral-100 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="flex items-center gap-2 font-bold">
                <MapPin className="h-5 w-5 text-gold-400" /> اختر محافظتك
              </h2>
              {current && (
                <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-200">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <p className="px-4 pt-3 text-xs text-neutral-400">سنعرض لك متاجر ومنتجات محافظتك فقط.</p>
            <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto p-4">
              {governorates.isLoading && <p className="col-span-2 text-center text-sm text-neutral-500">جارٍ التحميل…</p>}
              {governorates.data?.map((g) => (
                <button
                  key={g.id}
                  onClick={() => select(g.id, g.nameAr)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-sm transition ${
                    current?.id === g.id
                      ? "border-gold-500 bg-gold-500/10 font-bold text-gold-300"
                      : "border-line bg-card2 hover:border-gold-500/40"
                  }`}
                >
                  {g.nameAr}
                  {current?.id === g.id && <Check className="h-4 w-4 text-gold-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
