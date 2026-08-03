"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Eye, EyeOff, Megaphone } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@al-souq/api";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "./_image-field";

const PLACEMENTS: Record<string, string> = { home_banner: "لافتة الرئيسية", hero_strip: "شريط البطل" };

type AdRow = inferRouterOutputs<AppRouter>["admin"]["adList"][number];
type FormState = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  placement: "home_banner" | "hero_strip";
  governorateId: string;
  active: boolean;
  sortOrder: number;
};

const emptyForm: FormState = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "/search",
  placement: "home_banner",
  governorateId: "",
  active: true,
  sortOrder: 0,
};

function AdForm({
  initial,
  govs,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial: FormState;
  govs: { id: string; nameAr: string }[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (f: FormState) => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const valid = f.title.trim().length >= 2 && f.imageUrl.trim().length > 0;
  return (
    <div className="space-y-3">
      <ImageField value={f.imageUrl} onChange={(url) => setF((s) => ({ ...s, imageUrl: url }))} purpose="ad" aspect="aspect-[21/9]" />
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">العنوان</label>
        <input value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} maxLength={80} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="أسبوع النحاسيّات البغداديّة" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">وصفٌ ثانويّ (اختياري)</label>
        <input value={f.subtitle} onChange={(e) => setF((s) => ({ ...s, subtitle: e.target.value }))} maxLength={120} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="دلال وصواني من قلب سوق الصفافير" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">وجهة النقر</label>
          <input dir="ltr" value={f.linkUrl} onChange={(e) => setF((s) => ({ ...s, linkUrl: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="/search?q=نحاس" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">الموضع</label>
          <select value={f.placement} onChange={(e) => setF((s) => ({ ...s, placement: e.target.value as FormState["placement"] }))} className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            {Object.entries(PLACEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">المحافظة</label>
          <select value={f.governorateId} onChange={(e) => setF((s) => ({ ...s, governorateId: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            <option value="">كلّ العراق</option>
            {govs.map((g) => <option key={g.id} value={g.id}>{g.nameAr}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">الترتيب</label>
          <input type="number" value={f.sortOrder} onChange={(e) => setF((s) => ({ ...s, sortOrder: Number(e.target.value) || 0 }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm nums" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={f.active} onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} className="h-4 w-4 accent-brand-700" />
        فعّال (يظهر الآن)
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>إلغاء</Button>
        <Button size="sm" loading={submitting} disabled={!valid} onClick={() => onSubmit(f)}>حفظ الإعلان</Button>
      </div>
    </div>
  );
}

export function AdsTab() {
  const { success, error } = useToast();
  const list = trpc.admin.adList.useQuery(undefined, { retry: false });
  const govList = trpc.admin.govList.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const done = (msg: string) => {
    utils.admin.adList.invalidate();
    success(msg);
  };
  const create = trpc.admin.createAd.useMutation({ onSuccess: () => { done("تم إنشاء الإعلان"); setCreating(false); }, onError: (e) => error(e.message) });
  const update = trpc.admin.updateAd.useMutation({ onSuccess: () => { done("تم حفظ الإعلان"); setEditing(null); }, onError: (e) => error(e.message) });
  const remove = trpc.admin.deleteAd.useMutation({ onSuccess: () => done("تم حذف الإعلان"), onError: (e) => error(e.message) });
  const toggle = trpc.admin.updateAd.useMutation({ onSuccess: () => utils.admin.adList.invalidate(), onError: (e) => error(e.message) });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const govs = govList.data?.map((g) => ({ id: g.id, nameAr: g.nameAr })) ?? [];

  function toState(a: AdRow): FormState {
    return {
      title: a.title,
      subtitle: a.subtitle ?? "",
      imageUrl: a.imageUrl,
      linkUrl: a.linkUrl,
      placement: a.placement === "hero_strip" ? "hero_strip" : "home_banner",
      governorateId: a.governorateId ?? "",
      active: a.active,
      sortOrder: a.sortOrder,
    };
  }
  function payload(f: FormState) {
    return {
      title: f.title.trim(),
      subtitle: f.subtitle.trim() || null,
      imageUrl: f.imageUrl.trim(),
      linkUrl: f.linkUrl.trim() || "/search",
      placement: f.placement,
      governorateId: f.governorateId || null,
      active: f.active,
      sortOrder: f.sortOrder,
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">لافتات ترويجيّة تظهر في الرئيسية. اربطها بمحافظةٍ أو اجعلها لكلّ العراق.</p>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> إعلان جديد
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardBody>
            <h3 className="mb-3 font-bold text-brand-800">إعلان جديد</h3>
            <AdForm initial={emptyForm} govs={govs} submitting={create.isPending} onCancel={() => setCreating(false)} onSubmit={(f) => create.mutate(payload(f))} />
          </CardBody>
        </Card>
      )}

      {list.isLoading && <p className="text-sm text-neutral-400">…جارٍ التحميل</p>}
      {list.data && list.data.length === 0 && !creating && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 py-10 text-neutral-400">
          <Megaphone className="h-8 w-8" />
          <p className="text-sm">لا إعلانات بعد — أنشئ أوّل لافتة.</p>
        </div>
      )}

      {list.data?.map((a) => (
        <Card key={a.id}>
          {editing === a.id ? (
            <CardBody>
              <AdForm initial={toState(a)} govs={govs} submitting={update.isPending} onCancel={() => setEditing(null)} onSubmit={(f) => update.mutate({ id: a.id, ...payload(f) })} />
            </CardBody>
          ) : (
            <div className="flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.imageUrl} alt="" className="h-14 w-20 flex-shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold text-neutral-800">{a.title}</span>
                  {!a.active && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">موقوف</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5">{PLACEMENTS[a.placement] ?? a.placement}</span>
                  <span>{a.governorateName ?? "كلّ العراق"}</span>
                  <span className="nums">#{a.sortOrder}</span>
                </div>
              </div>
              <button onClick={() => toggle.mutate({ id: a.id, active: !a.active })} aria-label={a.active ? "إيقاف" : "تفعيل"} className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100">
                {a.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button onClick={() => setEditing(a.id)} aria-label="تعديل" className="grid h-9 w-9 place-items-center rounded-lg text-brand-600 hover:bg-brand-50">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => { if (confirm(`حذف إعلان «${a.title}»؟`)) remove.mutate({ id: a.id }); }} aria-label="حذف" className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
