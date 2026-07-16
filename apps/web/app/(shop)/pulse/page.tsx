import type { Metadata } from "next";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { PulseFeed } from "@/src/components/home/pulse-feed";
import type { PulseEvent } from "@al-souq/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "نبض السوق — السوگ" };

export default async function PulsePage() {
  const gov = getGovernorate();
  let events: PulseEvent[] = [];
  try {
    const api = await getServerApi();
    const extras = await api.discovery.homeExtras({ governorateId: gov?.id });
    events = extras.pulse;
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <SectionPageHeader title={`نبض ${gov?.name ?? "السوق"}`} subtitle="ليست منتجات — بل حياةُ السوق اليوم" live />
      <PulseFeed events={events} />
    </div>
  );
}
