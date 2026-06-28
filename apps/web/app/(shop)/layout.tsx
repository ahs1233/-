import { Header } from "@/src/components/header";
import { BottomNav } from "@/src/components/bottom-nav";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container-app flex-1 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
