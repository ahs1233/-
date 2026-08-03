import { Mail } from "lucide-react";

export const metadata = { title: "رسائلي — السوگ" };

export default function MessagesPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-card2 text-gold-400">
        <Mail className="h-8 w-8" />
      </span>
      <h1 className="text-xl font-extrabold text-neutral-100">رسائلي</h1>
      <p className="max-w-xs text-sm text-neutral-400">
        قريباً — راسِل المتاجر مباشرةً واسأل عن المنتجات قبل الشراء.
      </p>
    </div>
  );
}
