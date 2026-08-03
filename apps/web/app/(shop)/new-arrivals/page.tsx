import type { Metadata } from "next";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { FilteredProducts } from "@/src/components/product/filtered-products";
import type { DiscoveryProductCard } from "@al-souq/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "وصل حديثاً — السوگ" };

export default async function NewArrivalsPage() {
  const gov = getGovernorate();
  let items: DiscoveryProductCard[] = [];
  try {
    const api = await getServerApi();
    const sections = await api.discovery.home({ governorateId: gov?.id });
    const s = sections.find((x) => x.key === "new");
    if (s && s.kind === "products") items = s.items;
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <SectionPageHeader title="وصل حديثاً" subtitle={`أحدث ما نزل في ${gov?.name ?? "العراق"}`} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد منتجات جديدة بعد.</p>
      ) : (
        <FilteredProducts items={items} variant="grid" newBadge />
      )}
    </div>
  );
}
