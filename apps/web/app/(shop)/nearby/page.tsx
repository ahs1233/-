import type { Metadata } from "next";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { NearbyClient } from "@/src/components/nearby/nearby-client";
import type { NearbyStore } from "@al-souq/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "قريب منك — السوگ" };

export default async function NearbyPage() {
  const gov = getGovernorate();
  let stores: NearbyStore[] = [];
  try {
    const api = await getServerApi();
    stores = await api.discovery.nearbyStores({ governorateId: gov?.id });
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <SectionPageHeader title="قريب منك" subtitle={`متاجر ${gov?.name ?? "العراق"} على الخريطة`} />
      <NearbyClient stores={stores} govName={gov?.name} />
    </div>
  );
}
