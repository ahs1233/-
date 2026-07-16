import type { Metadata } from "next";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { StoreRailCard, type StoreRailData } from "@/src/components/home/store-rail-card";
import { SectionPageHeader } from "@/src/components/section-page-header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المتاجر الجديدة — السوگ" };

export default async function NewStoresPage() {
  const gov = getGovernorate();
  let items: StoreRailData[] = [];
  try {
    const api = await getServerApi();
    const sections = await api.discovery.home({ governorateId: gov?.id });
    const s = sections.find((x) => x.key === "new_stores");
    if (s && s.kind === "stores") items = s.items;
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <SectionPageHeader title="المتاجر الجديدة" subtitle={`افتتحت حديثاً في ${gov?.name ?? "العراق"}`} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد متاجر جديدة بعد.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((s) => (
            <StoreRailCard key={s.id} store={s} />
          ))}
        </div>
      )}
    </div>
  );
}
