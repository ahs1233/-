import type { Metadata } from "next";
import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { StoresList, type StoreListItem } from "@/src/components/stores/stores-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المتاجر المميّزة — السوگ" };

export default async function StoresPage() {
  const gov = getGovernorate();
  let stores: StoreListItem[] = [];
  let fallback = false;
  try {
    const api = await getServerApi();
    // متاجر محافظتك أولاً؛ وإن لم توجد بعد نعرض متاجر بقية العراق حتى لا تكون الصفحة فارغة.
    stores = await api.catalog.stores({ governorateId: gov?.id });
    if (stores.length === 0 && gov) {
      stores = await api.catalog.stores({});
      fallback = stores.length > 0;
    }
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <SectionPageHeader title="المتاجر المميّزة" subtitle={`أفضل متاجر ${gov?.name ?? "العراق"}`} />
      {fallback && (
        <p className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-3 text-sm text-gold-300">
          لا توجد متاجر في {gov?.name} بعد — نعرض لك متاجر من محافظات أخرى.
        </p>
      )}
      <StoresList stores={stores} />
    </div>
  );
}
