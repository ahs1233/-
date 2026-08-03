"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign, Plus, X } from "lucide-react";
import { Button, Card, CardBody, Input, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

// لوحة الإدارة ← المظهر ← الاشتراكات: تحرير تعريفات طبقات التجّار (اسم/سعر/مزايا).
// الطبقات الثلاث بنيويّة؛ القابل للتعديل هنا: الاسم والسعر وقائمة المزايا.

type Tier = "free" | "silver" | "gold";
const TIERS: { key: Tier; title: string; accent: string }[] = [
  { key: "free", title: "مجّاني", accent: "text-neutral-500" },
  { key: "silver", title: "فضّي", accent: "text-slate-500" },
  { key: "gold", title: "ذهبيّ", accent: "text-amber-600" },
];

type Entry = { label: string; priceIQD: number; badge: string | null; benefits: string[] };
type Config = Record<Tier, Entry>;

export default function PlansEditor() {
  const { success, error } = useToast();
  const utils = trpc.useUtils();
  const q = trpc.admin.getVendorPlans.useQuery(undefined, { retry: false });
  const save = trpc.admin.updateVendorPlans.useMutation({
    onSuccess: () => { utils.admin.getVendorPlans.invalidate(); success("حُفظت الطبقات"); },
    onError: (e) => error(e.message),
  });

  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => { if (q.data && !cfg) setCfg(q.data as Config); }, [q.data, cfg]);

  if (q.isLoading || !cfg) return <p className="text-sm text-neutral-400">…جارٍ التحميل</p>;

  const set = (t: Tier, patch: Partial<Entry>) => setCfg({ ...cfg, [t]: { ...cfg[t], ...patch } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-brand-800"><BadgeDollarSign className="h-5 w-5" /> اشتراكات التجّار</h1>
        <p className="text-sm text-neutral-500">عرّف الأسماء والأسعار والمزايا. التحصيل يدويٌّ حاليًّا؛ تُعيَّن طبقة كلّ تاجرٍ من صفحة «المتاجر».</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {TIERS.map(({ key, title, accent }) => {
          const e = cfg[key];
          return (
            <Card key={key}>
              <CardBody className="space-y-3">
                <h2 className={`font-extrabold ${accent}`}>{title}</h2>
                <label className="block text-sm font-medium text-neutral-700">الاسم المعروض
                  <Input value={e.label} onChange={(ev) => set(key, { label: ev.target.value })} maxLength={30} className="mt-1" />
                </label>
                <label className="block text-sm font-medium text-neutral-700">السعر الشهريّ (د.ع)
                  <Input inputMode="numeric" value={String(e.priceIQD)} onChange={(ev) => set(key, { priceIQD: Number(ev.target.value.replace(/\D/g, "")) || 0 })} className="mt-1 nums" />
                </label>
                <div>
                  <span className="mb-1 block text-sm font-medium text-neutral-700">المزايا</span>
                  <ul className="space-y-1.5">
                    {e.benefits.map((b, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Input value={b} maxLength={80} onChange={(ev) => set(key, { benefits: e.benefits.map((x, j) => (j === i ? ev.target.value : x)) })} />
                        <button aria-label="حذف" onClick={() => set(key, { benefits: e.benefits.filter((_, j) => j !== i) })} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-danger hover:bg-danger/10"><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                  {e.benefits.length < 12 && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => set(key, { benefits: [...e.benefits, "ميزة جديدة"] })}><Plus className="h-4 w-4" /> ميزة</Button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate(cfg)}>حفظ الطبقات</Button>
      </div>
    </div>
  );
}
