"use client";

import { useState } from "react";
import Link from "next/link";
import { Store, BadgeCheck, Star, ChevronLeft, Search, Boxes, Layers, Radio } from "lucide-react";
import { Card, Input, Select } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

// لوحة المدير ← المظهر ← المتاجر: قائمةٌ بكلّ المتاجر للتحكّم الكامل بشخصيّتها وأقسامها ونبضها.
export default function AdminStoresPage() {
  const govs = trpc.admin.govList.useQuery();
  const [gov, setGov] = useState("");
  const [q, setQ] = useState("");
  const list = trpc.admin.storeList.useQuery(
    { governorateId: gov || undefined, q: q.trim() || undefined },
    { retry: false },
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-brand-800">المتاجر</h1>
        <p className="text-sm text-neutral-500">تحكّمٌ كاملٌ بشخصيّة كلّ متجر: الهوية، ساعات العمل، التوصيل، الموقع، الأقسام الداخليّة، ونبض السوق.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المتجر…" className="ps-9" />
        </div>
        <Select value={gov} onChange={(e) => setGov(e.target.value)} className="w-44">
          <option value="">كلّ المحافظات</option>
          {govs.data?.map((g) => (
            <option key={g.id} value={g.id}>{g.nameAr}</option>
          ))}
        </Select>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-neutral-400">…جارٍ التحميل</p>
      ) : list.data && list.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 py-10 text-neutral-400">
          <Store className="h-8 w-8" /><p className="text-sm">لا متاجر مطابقة.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.data?.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/appearance/stores/${s.id}`} className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-brand-300">
                <span className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-600">
                  {s.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img loading="lazy" src={s.logoUrl} alt={s.storeName} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-bold text-neutral-800">
                    {s.storeName}
                    {s.verified && <BadgeCheck className="h-4 w-4 flex-shrink-0 text-brand-500" aria-label="موثّق" />}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-neutral-400">
                    {s.governorate && <span>{s.governorate}</span>}
                    {s.ratingCount > 0 && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="nums">{s.ratingAvg.toFixed(1)}</span></span>}
                    <span className="inline-flex items-center gap-0.5"><Boxes className="h-3 w-3" /><span className="nums">{s.productCount}</span></span>
                    <span className="inline-flex items-center gap-0.5"><Layers className="h-3 w-3" /><span className="nums">{s.sectionCount}</span></span>
                    <span className="inline-flex items-center gap-0.5"><Radio className="h-3 w-3" /><span className="nums">{s.activityCount}</span></span>
                  </p>
                </div>
                <ChevronLeft className="h-4 w-4 flex-shrink-0 text-neutral-300 group-hover:text-brand-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
