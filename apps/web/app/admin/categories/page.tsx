"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Select, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

type Cat = { id: string; nameAr: string; parentId: string | null; isActive: boolean; products: number; children: number; commissionRate: number | null };

export default function AdminCategories() {
  const { error: toastError, success } = useToast();
  const cats = trpc.admin.categories.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.admin.categories.invalidate();
    utils.catalog.categories.invalidate();
  };
  const create = trpc.admin.createCategory.useMutation({ onSuccess: invalidate });
  const update = trpc.admin.updateCategory.useMutation({ onSuccess: invalidate });
  const remove = trpc.admin.removeCategory.useMutation({
    onSuccess: (r) => {
      invalidate();
      setDelId(null);
      setMoveTo("");
      success(r.movedProducts > 0 ? `حُذفت الفئة ونُقل ${r.movedProducts} منتج` : "حُذفت الفئة");
    },
    onError: (e) => toastError(e.message),
  });

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const all: Cat[] = cats.data ?? [];
  const parents = all.filter((c) => !c.parentId);

  // معرّفات الفئة وكل نسلها (لاستبعادها من وجهات النقل).
  function subtreeIds(id: string): Set<string> {
    const set = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of all) {
        if (c.parentId && set.has(c.parentId) && !set.has(c.id)) {
          set.add(c.id);
          added = true;
        }
      }
    }
    return set;
  }
  // وجهات النقل المتاحة لفئة يُراد حذفها: كل الفئات خارج شجرتها.
  const destinations = (id: string) => {
    const sub = subtreeIds(id);
    return all.filter((c) => !sub.has(c.id));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الفئات</h1>

      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">إضافة فئة</h2>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الفئة" />
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">فئة رئيسية</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                ضمن: {p.nameAr}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            loading={create.isPending}
            disabled={name.trim().length < 2}
            onClick={() => {
              create.mutate({ nameAr: name.trim(), parentId: parentId || null });
              setName("");
            }}
          >
            إضافة
          </Button>
        </CardBody>
      </Card>

      {parents.map((parent) => {
        const children = all.filter((c) => c.parentId === parent.id);
        return (
          <Card key={parent.id}>
            <CardBody className="space-y-2">
              <Row
                cat={parent}
                onToggle={(active) => update.mutate({ id: parent.id, isActive: active })}
                onAskDelete={() => {
                  setDelId(parent.id);
                  setMoveTo("");
                }}
                onCommission={(rate) => update.mutate({ id: parent.id, commissionRate: rate })}
                saving={update.isPending}
                bold
              />
              {delId === parent.id && (
                <DeletePanel
                  cat={parent}
                  destinations={destinations(parent.id)}
                  moveTo={moveTo}
                  setMoveTo={setMoveTo}
                  busy={remove.isPending}
                  onConfirm={() => remove.mutate({ id: parent.id, reassignToId: moveTo || undefined })}
                  onCancel={() => setDelId(null)}
                />
              )}
              {children.map((ch) => (
                <div key={ch.id}>
                  <Row
                    cat={ch}
                    onToggle={(active) => update.mutate({ id: ch.id, isActive: active })}
                    onAskDelete={() => {
                      setDelId(ch.id);
                      setMoveTo("");
                    }}
                    onCommission={(rate) => update.mutate({ id: ch.id, commissionRate: rate })}
                    saving={update.isPending}
                  />
                  {delId === ch.id && (
                    <DeletePanel
                      cat={ch}
                      destinations={destinations(ch.id)}
                      moveTo={moveTo}
                      setMoveTo={setMoveTo}
                      busy={remove.isPending}
                      onConfirm={() => remove.mutate({ id: ch.id, reassignToId: moveTo || undefined })}
                      onCancel={() => setDelId(null)}
                    />
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function Row({
  cat,
  onToggle,
  onAskDelete,
  onCommission,
  saving,
  bold,
}: {
  cat: Cat;
  onToggle: (active: boolean) => void;
  onAskDelete: () => void;
  onCommission: (rate: number | null) => void;
  saving?: boolean;
  bold?: boolean;
}) {
  const [pct, setPct] = useState(cat.commissionRate === null ? "" : String(Math.round(cat.commissionRate * 100)));
  const dirty = (cat.commissionRate === null ? "" : String(Math.round(cat.commissionRate * 100))) !== pct.trim();

  return (
    <div className={bold ? "" : "ms-4"}>
      <div className="flex items-center justify-between">
        <span className={bold ? "font-bold" : ""}>
          {cat.nameAr}
          <span className="ms-2 text-xs text-neutral-400 nums">({cat.products})</span>
          {!cat.isActive && <span className="ms-2 text-xs text-danger">معطّلة</span>}
        </span>
        <div className="flex gap-2 text-sm">
          <button className="text-neutral-500" onClick={() => onToggle(!cat.isActive)}>
            {cat.isActive ? "تعطيل" : "تفعيل"}
          </button>
          <button className="text-danger" onClick={onAskDelete}>
            حذف
          </button>
        </div>
      </div>
      {/* عمولة الفئة (تجاوز) */}
      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
        <span>عمولة الفئة:</span>
        <input
          inputMode="numeric"
          value={pct}
          onChange={(e) => setPct(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="افتراضي"
          className="h-7 w-16 rounded border border-neutral-300 px-2 text-center nums"
        />
        <span>٪</span>
        {dirty && (
          <button
            disabled={saving}
            className="rounded bg-brand-500 px-2 py-0.5 text-white disabled:opacity-50"
            onClick={() => onCommission(pct.trim() === "" ? null : Math.max(0, Math.min(100, Number(pct))) / 100)}
          >
            حفظ
          </button>
        )}
        {cat.commissionRate !== null && !dirty && <span className="text-brand-600">مطبَّقة</span>}
      </div>
    </div>
  );
}

/** لوحة تأكيد الحذف — تعرض خيار نقل المنتجات عند وجودها. */
function DeletePanel({
  cat,
  destinations,
  moveTo,
  setMoveTo,
  busy,
  onConfirm,
  onCancel,
}: {
  cat: Cat;
  destinations: Cat[];
  moveTo: string;
  setMoveTo: (v: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const hasProducts = cat.products > 0;
  const hasChildren = cat.children > 0;
  return (
    <div className="mt-1 space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
      <p className="font-medium text-danger">
        حذف «{cat.nameAr}»؟
        {hasChildren && " سيُحذف مع كل أقسامه الفرعية."}
      </p>
      {(hasProducts || hasChildren) && (
        <label className="block text-xs text-neutral-600">
          نقل المنتجات إلى (اختياري — للأقسام التي تحوي منتجات):
          <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="mt-1 h-9">
            <option value="">— بدون نقل (يُرفض إن وُجدت منتجات) —</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.parentId ? `— ${d.nameAr}` : d.nameAr}
              </option>
            ))}
          </Select>
        </label>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="danger" loading={busy} onClick={onConfirm}>
          تأكيد الحذف
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}
