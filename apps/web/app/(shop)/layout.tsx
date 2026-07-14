import { redirect } from "next/navigation";
import { Header } from "@/src/components/header";
import { BottomNav } from "@/src/components/bottom-nav";
import { Footer } from "@/src/components/footer";
import { getGovernorate } from "@/src/lib/governorate";
import { getSessionRole } from "@/src/lib/session";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // فصل الواجهات حسب الدور: حساب المتجر لوحة تحكّم خاصة، لا سوق المشترين.
  const role = await getSessionRole();
  if (role === "VENDOR") redirect("/vendor");
  if (role === "ADMIN") redirect("/admin");

  const gov = getGovernorate();
  return (
    <div className="bg-page flex min-h-screen flex-col">
      <Header gov={gov} />
      <main className="container-app flex-1 py-4">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
