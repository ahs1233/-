"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Layers, Radio, BadgeCheck, BadgeDollarSign, Star } from "lucide-react";
import { Button, Card, CardBody, Input, Select, Textarea, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "../../_image-field";

const ACTIVITY_KINDS: { value: string; label: string }[] = [
  { value: "restock", label: "وصول دفعة" },
  { value: "new_arrival", label: "منتج جديد" },
  { value: "new_section", label: "افتتاح قسم" },
  { value: "most_visited", label: "الأكثر زيارة" },
  { value: "promo", label: "عرض" },
];
const kindLabel = (k: string) => ACTIVITY_KINDS.find((x) => x.value === k)?.label ?? k;

type Profile = {
  description: string; logoUrl: string; bannerUrl: string; verified: boolean;
  establishedYear: string; responseMins: string; opensAt: string; closesAt: string;
  deliveryInfo: string; addressText: string; ordersCount: string;
  latitude: string; longitude: string; ratingAvg: string; ratingCount: string;
};

export default function AdminStoreEditor({ params }: { params: { id: string } }) {
  const { success, error } = useToast();
  const utils = trpc.useUtils();
  const store = trpc.admin.storeGet.useQuery({ id: params.id }, { retry: false });
  const refresh = () => utils.admin.storeGet.invalidate({ id: params.id });

  const save = trpc.admin.updateStoreProfile.useMutation({ onSuccess: () => { refresh(); success("حُفظت الشخصيّة"); }, onError: (e) => error(e.message) });
  const secUpsert = trpc.admin.storeSectionUpsert.useMutation({ onSuccess: refresh, onError: (e) => error(e.message) });
  const secDelete = trpc.admin.storeSectionDelete.useMutation({ onSuccess: refresh, onError: (e) => error(e.message) });
  const secReorder = trpc.admin.storeSectionReorder.useMutation({ onSuccess: refresh, onError: (e) => error(e.message) });
  const actUpsert = trpc.admin.storeActivityUpsert.useMutation({ onSuccess: refresh, onError: (e) => error(e.message) });
  const actDelete = trpc.admin.storeActivityDelete.useMutation({ onSuccess: refresh, onError: (e) => error(e.message) });
  const setPlan = trpc.admin.setStorePlan.useMutation({ onSuccess: () => { refresh(); success("حُفظ الاشتراك"); }, onError: (e) => error(e.message) });

  const [p, setP] = useState<Profile | null>(null);
  const [newSection, setNewSection] = useState("");
  const [editSec, setEditSec] = useState<{ id: string; name: string } | null>(null);
  const [newAct, setNewAct] = useState({ kind: "restock", message: "", minutesAgo: "", sponsored: false });
  const [plan, setPlanState] = useState<{ plan: string; planExpiresAt: string; featuredUntil: string } | null>(null);

  useEffect(() => {
    const d = store.data;
    if (d && !p) {
      setP({
        description: d.description ?? "", logoUrl: d.logoUrl ?? "", bannerUrl: d.bannerUrl ?? "", verified: d.verified,
        establishedYear: d.establishedYear?.toString() ?? "", responseMins: d.responseMins?.toString() ?? "",
        opensAt: d.opensAt ?? "", closesAt: d.closesAt ?? "", deliveryInfo: d.deliveryInfo ?? "", addressText: d.addressText ?? "",
        ordersCount: d.ordersCount.toString(), latitude: d.latitude?.toString() ?? "", longitude: d.longitude?.toString() ?? "",
        ratingAvg: d.ratingAvg.toString(), ratingCount: d.ratingCount.toString(),
      });
      const iso = (s: string | null) => (s ? s.slice(0, 10) : "");
      setPlanState({ plan: d.plan, planExpiresAt: iso(d.planExpiresAt), featuredUntil: iso(d.featuredUntil) });
    }
  }, [store.data, p]);

  if (store.isLoading || !p || !plan) return <p className="text-sm text-neutral-400">…جارٍ التحميل</p>;
  if (store.isError || !store.data) return <p className="text-sm text-neutral-500">المتجر غير موجود.</p>;
  const d = store.data;

  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
  function submitProfile() {
    if (!p) return;
    save.mutate({
      id: params.id,
      description: p.description.trim() || null,
      logoUrl: p.logoUrl.trim() || null,
      bannerUrl: p.bannerUrl.trim() || null,
      verified: p.verified,
      establishedYear: numOrNull(p.establishedYear),
      responseMins: numOrNull(p.responseMins),
      opensAt: p.opensAt.trim() || null,
      closesAt: p.closesAt.trim() || null,
      deliveryInfo: p.deliveryInfo.trim() || null,
      addressText: p.addressText.trim() || null,
      ordersCount: Number(p.ordersCount || 0),
      latitude: numOrNull(p.latitude),
      longitude: numOrNull(p.longitude),
      ratingAvg: Number(p.ratingAvg || 0),
      ratingCount: Number(p.ratingCount || 0),
    });
  }

  function moveSection(i: number, dir: -1 | 1) {
    const ids = d.sections.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    secReorder.mutate({ vendorId: params.id, orderedIds: ids });
  }

  return (
    <div className="space-y-4 pb-8">
      <Link href="/admin/appearance/stores" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
        <ArrowRight className="h-4 w-4" /> كلّ المتاجر
      </Link>
      <div className="flex items-center gap-2">
        <h1 className="flex items-center gap-1.5 text-xl font-extrabold text-brand-800">
          {d.storeName}
          {d.verified && <BadgeCheck className="h-5 w-5 text-brand-500" />}
        </h1>
        <span className="text-xs text-neutral-400">{d.governorate}</span>
      </div>

      {/* ── الشخصيّة ── */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold text-neutral-800">شخصيّة المتجر</h2>
          <F label="نبذة قصيرة">
            <Textarea rows={2} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} maxLength={400} placeholder="سطرٌ أو سطران يعرّفان المتجر" />
          </F>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm font-medium text-neutral-700">الشعار</span>
              <ImageField value={p.logoUrl} onChange={(url) => setP({ ...p, logoUrl: url })} purpose="market" aspect="aspect-square" />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-neutral-700">صورة الواجهة</span>
              <ImageField value={p.bannerUrl} onChange={(url) => setP({ ...p, bannerUrl: url })} purpose="market" aspect="aspect-[16/9]" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={p.verified} onChange={(e) => setP({ ...p, verified: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            متجر موثّق (شارة ✓)
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="سنة التأسيس"><Input inputMode="numeric" value={p.establishedYear} onChange={(e) => setP({ ...p, establishedYear: e.target.value })} placeholder="2015" /></F>
            <F label="وقت الردّ (دقيقة)"><Input inputMode="numeric" value={p.responseMins} onChange={(e) => setP({ ...p, responseMins: e.target.value })} placeholder="10" /></F>
            <F label="ساعة الفتح (HH:MM)"><Input dir="ltr" value={p.opensAt} onChange={(e) => setP({ ...p, opensAt: e.target.value })} placeholder="09:00" /></F>
            <F label="ساعة الإغلاق (HH:MM)"><Input dir="ltr" value={p.closesAt} onChange={(e) => setP({ ...p, closesAt: e.target.value })} placeholder="23:00" /></F>
            <F label="عدد الطلبات"><Input inputMode="numeric" value={p.ordersCount} onChange={(e) => setP({ ...p, ordersCount: e.target.value })} placeholder="1200" /></F>
            <F label="العنوان داخل المحافظة"><Input value={p.addressText} onChange={(e) => setP({ ...p, addressText: e.target.value })} placeholder="النجف — حيّ السعد" /></F>
          </div>
          <F label="وصف التوصيل"><Input value={p.deliveryInfo} onChange={(e) => setP({ ...p, deliveryInfo: e.target.value })} placeholder="توصيل داخل النجف خلال ٢٤ ساعة" /></F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="خط العرض (Latitude)"><Input dir="ltr" inputMode="decimal" value={p.latitude} onChange={(e) => setP({ ...p, latitude: e.target.value })} placeholder="31.999" /></F>
            <F label="خط الطول (Longitude)"><Input dir="ltr" inputMode="decimal" value={p.longitude} onChange={(e) => setP({ ...p, longitude: e.target.value })} placeholder="44.315" /></F>
            <F label="التقييم (0–5)"><Input dir="ltr" inputMode="decimal" value={p.ratingAvg} onChange={(e) => setP({ ...p, ratingAvg: e.target.value })} placeholder="4.7" /></F>
            <F label="عدد التقييمات"><Input inputMode="numeric" value={p.ratingCount} onChange={(e) => setP({ ...p, ratingCount: e.target.value })} placeholder="130" /></F>
          </div>
          <div className="flex justify-end">
            <Button loading={save.isPending} onClick={submitProfile}>حفظ الشخصيّة</Button>
          </div>
        </CardBody>
      </Card>

      {/* ── الاشتراك والظهور المدفوع ── */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 font-bold text-neutral-800"><BadgeDollarSign className="h-4 w-4 text-brand-600" /> الاشتراك والظهور</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="طبقة الاشتراك">
              <Select value={plan.plan} onChange={(e) => setPlanState({ ...plan, plan: e.target.value })}>
                <option value="free">مجّاني</option>
                <option value="silver">فضّي</option>
                <option value="gold">ذهبيّ</option>
              </Select>
            </F>
            <F label="انتهاء الاشتراك">
              <Input type="date" value={plan.planExpiresAt} onChange={(e) => setPlanState({ ...plan, planExpiresAt: e.target.value })} />
            </F>
            <F label="مميّز حتى (ظهور مدفوع)">
              <Input type="date" value={plan.featuredUntil} onChange={(e) => setPlanState({ ...plan, featuredUntil: e.target.value })} />
            </F>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-500"><Star className="h-3.5 w-3.5 text-amber-500" /> «مميّز حتى» يرفع ترتيب المتجر في السوق ويُظهر شارة «مميّز» للمشتري. اترك الحقل فارغًا لإلغائه.</p>
          <div className="flex justify-end">
            <Button loading={setPlan.isPending} onClick={() => setPlan.mutate({
              id: params.id,
              plan: plan.plan as "free" | "silver" | "gold",
              planExpiresAt: plan.planExpiresAt ? new Date(plan.planExpiresAt + "T23:59:59Z").toISOString() : null,
              featuredUntil: plan.featuredUntil ? new Date(plan.featuredUntil + "T23:59:59Z").toISOString() : null,
            })}>حفظ الاشتراك</Button>
          </div>
        </CardBody>
      </Card>

      {/* ── الأقسام الداخليّة ── */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 font-bold text-neutral-800"><Layers className="h-4 w-4 text-brand-600" /> الأقسام الداخليّة</h2>
          <div className="flex gap-2">
            <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newSection.trim().length >= 2 && (secUpsert.mutate({ vendorId: params.id, nameAr: newSection.trim() }), setNewSection(""))} placeholder="اسم القسم — مثل: هواتف، صيانة" maxLength={40} />
            <Button disabled={newSection.trim().length < 2} loading={secUpsert.isPending} onClick={() => { secUpsert.mutate({ vendorId: params.id, nameAr: newSection.trim() }); setNewSection(""); }}><Plus className="h-4 w-4" /> إضافة</Button>
          </div>
          {d.sections.length === 0 ? (
            <p className="text-sm text-neutral-400">لا أقسام بعد.</p>
          ) : (
            <ul className="space-y-2">
              {d.sections.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2">
                  {editSec?.id === s.id ? (
                    <>
                      <Input value={editSec.name} onChange={(e) => setEditSec({ id: s.id, name: e.target.value })} maxLength={40} autoFocus />
                      <Button size="sm" loading={secUpsert.isPending} onClick={() => { secUpsert.mutate({ id: s.id, vendorId: params.id, nameAr: editSec.name.trim() }); setEditSec(null); }}>حفظ</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditSec(null)}>إلغاء</Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">{s.nameAr}</span>
                      <span className="text-[11px] text-neutral-400 nums">{s.productCount} منتج</span>
                      <div className="flex flex-col">
                        <button aria-label="أعلى" disabled={i === 0} onClick={() => moveSection(i, -1)} className="text-neutral-400 hover:text-brand-600 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button aria-label="أسفل" disabled={i === d.sections.length - 1} onClick={() => moveSection(i, 1)} className="text-neutral-400 hover:text-brand-600 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      </div>
                      <button aria-label="تعديل" onClick={() => setEditSec({ id: s.id, name: s.nameAr })} className="grid h-8 w-8 place-items-center rounded-lg text-brand-600 hover:bg-brand-50"><Pencil className="h-4 w-4" /></button>
                      <button aria-label="حذف" onClick={() => { if (confirm(`حذف قسم «${s.nameAr}»؟ تبقى منتجاته بلا قسم.`)) secDelete.mutate({ id: s.id }); }} className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ── نبض السوق ── */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 font-bold text-neutral-800"><Radio className="h-4 w-4 text-brand-600" /> نبض السوق</h2>
          <div className="grid gap-2 sm:grid-cols-[9rem_1fr_7rem_auto]">
            <Select value={newAct.kind} onChange={(e) => setNewAct({ ...newAct, kind: e.target.value })}>
              {ACTIVITY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
            <Input value={newAct.message} onChange={(e) => setNewAct({ ...newAct, message: e.target.value })} placeholder="نصّ الحدث — مثل: وصلت دفعة جديدة من…" maxLength={160} />
            <Input inputMode="numeric" value={newAct.minutesAgo} onChange={(e) => setNewAct({ ...newAct, minutesAgo: e.target.value })} placeholder="قبل (دقيقة)" />
            <Button disabled={newAct.message.trim().length < 3} loading={actUpsert.isPending} onClick={() => { actUpsert.mutate({ vendorId: params.id, kind: newAct.kind as never, message: newAct.message.trim(), minutesAgo: newAct.minutesAgo.trim() ? Number(newAct.minutesAgo) : undefined, sponsored: newAct.sponsored }); setNewAct({ kind: newAct.kind, message: "", minutesAgo: "", sponsored: false }); }}><Plus className="h-4 w-4" /></Button>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={newAct.sponsored} onChange={(e) => setNewAct({ ...newAct, sponsored: e.target.checked })} className="h-4 w-4 accent-amber-500" />
            حدثٌ مموّل (يتصدّر النبض بوسم «مموّل»)
          </label>
          {d.activities.length === 0 ? (
            <p className="text-sm text-neutral-400">لا أحداث بعد.</p>
          ) : (
            <ul className="space-y-2">
              {d.activities.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">{kindLabel(a.kind)}</span>
                  {a.sponsored && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">مموّل</span>}
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{a.message}</span>
                  <span className="text-[11px] text-neutral-400">{new Date(a.at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" })}</span>
                  <button aria-label={a.sponsored ? "إلغاء التمويل" : "تمويل"} title="تبديل التمويل" onClick={() => actUpsert.mutate({ vendorId: params.id, id: a.id, kind: a.kind as never, message: a.message, sponsored: !a.sponsored })} className={`grid h-8 w-8 place-items-center rounded-lg ${a.sponsored ? "text-amber-600 hover:bg-amber-50" : "text-neutral-400 hover:bg-neutral-100"}`}><Star className="h-4 w-4" /></button>
                  <button aria-label="حذف" onClick={() => actDelete.mutate({ id: a.id })} className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
