import { Header } from "@/src/components/header";
import { BottomNav } from "@/src/components/bottom-nav";
import { GovernorateBar } from "@/src/components/governorate/control";
import { getGovernorate } from "@/src/lib/governorate";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const gov = getGovernorate();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <GovernorateBar current={gov} />
      <main className="container-app flex-1 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
