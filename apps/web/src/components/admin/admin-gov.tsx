"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { trpc } from "@/src/trpc/react";

/**
 * فلتر المحافظة العامّ للوحة الإدارة — يُخصّص المؤشرات والطلبات والمتاجر والمالية
 * لمحافظةٍ بعينها أو لكلّ العراق. يُحفظ في localStorage ليثبت عبر الصفحات.
 * مدير المحافظة (scope) مقيّدٌ بمحافظته فلا يظهر له المُنتقي.
 */
const Ctx = createContext<{ govId: string | null; setGovId: (id: string | null) => void }>({
  govId: null,
  setGovId: () => {},
});

export function AdminGovProvider({ children }: { children: React.ReactNode }) {
  const [govId, setGovIdState] = useState<string | null>(null);
  useEffect(() => {
    const s = localStorage.getItem("admin_gov");
    if (s) setGovIdState(s);
  }, []);
  const setGovId = (id: string | null) => {
    setGovIdState(id);
    if (id) localStorage.setItem("admin_gov", id);
    else localStorage.removeItem("admin_gov");
  };
  return <Ctx.Provider value={{ govId, setGovId }}>{children}</Ctx.Provider>;
}

export const useAdminGov = () => useContext(Ctx);

/** مُنتقي المحافظة في ترويسة الإدارة. scopeName يقفله على مدير المحافظة. */
export function AdminGovSelect({ scopeName }: { scopeName?: string | null }) {
  const { govId, setGovId } = useAdminGov();
  const govs = trpc.geo.governorates.useQuery(undefined, { retry: false, staleTime: 300_000 });

  if (scopeName) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white">
        <MapPin className="h-4 w-4 text-gold-300" /> {scopeName}
      </span>
    );
  }

  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-sm text-white">
      <MapPin className="h-4 w-4 flex-shrink-0 text-gold-300" />
      <select
        value={govId ?? ""}
        onChange={(e) => setGovId(e.target.value || null)}
        className="max-w-[9rem] bg-transparent py-1 text-sm font-medium text-white outline-none [&>option]:text-neutral-900"
        aria-label="فلتر المحافظة"
      >
        <option value="">كلّ العراق</option>
        {govs.data?.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nameAr}
          </option>
        ))}
      </select>
    </label>
  );
}
