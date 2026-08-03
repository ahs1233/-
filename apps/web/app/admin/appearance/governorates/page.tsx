"use client";

import Link from "next/link";
import { Store, Megaphone, ImageIcon, MapPin, Pencil } from "lucide-react";
import { Card } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export default function GovernoratesGrid() {
  const list = trpc.admin.govList.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-brand-800">المحافظات</h1>
        <p className="text-sm text-neutral-500">كلّ محافظةٍ تجربةٌ مختلفة — افتح البطاقة لتحرير صورتها وشعورها وأسواقها.</p>
      </div>

      {list.isLoading && <p className="text-sm text-neutral-400">…جارٍ التحميل</p>}
      {list.isError && <p className="text-sm text-danger">تعذّر تحميل المحافظات</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.data?.map((g) => (
          <Link key={g.id} href={`/admin/appearance/governorates/${g.id}`}>
            <Card className={`group h-full overflow-hidden transition hover:border-gold-300 hover:shadow-md ${g.enabled ? "" : "opacity-70"}`}>
              <div className="relative h-24 bg-gradient-to-br from-brand-600 to-brand-800">
                {g.heroImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.heroImageUrl} alt="" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-white drop-shadow">
                    <MapPin className="h-3.5 w-3.5 text-gold-300" /> {g.nameAr}
                  </span>
                  {!g.enabled && <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">مخفيّة</span>}
                </div>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {g.souks.length} سوق</span>
                  <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {g.heroImageUrl ? 1 : 0}</span>
                  <span className="inline-flex items-center gap-1"><Megaphone className="h-3 w-3" /> {g.adCount}</span>
                  <span className="inline-flex items-center gap-1"><Store className="h-3 w-3" /> {g.vendorCount}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 group-hover:text-gold-700">
                  <Pencil className="h-3.5 w-3.5" /> تحرير
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
