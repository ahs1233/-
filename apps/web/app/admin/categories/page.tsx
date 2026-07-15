"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Select, useToast } from "@al-souq/ui";
import { ChevronUp, ChevronDown, Eye, EyeOff, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "../appearance/_image-field";
import { CategoryIcon } from "@/src/components/category-icon";

type Cat = {
  id: string;
  nameAr: string;
  slug: string;
  icon: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  products: number;
  children: number;
  commissionRate: number | null;
};

export default function AdminCategories() {
  const { error: toastError, success } = useToast();
  const cats = trpc.admin.categories.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.admin.categories.invalidate();
    utils.catalog.categories.invalidate();
  };
  const create = trpc.admin.createCategory.useMutation({ onSuccess: invalidate, onError: (e) => toastError(e.message) });
  const update = trpc.admin.updateCategory.useMutation({ onSuccess: invalidate, onError: (e) => toastError(e.message) });
  const reorder = trpc.admin.reorderCategories.useMutation({ onSuccess: invalidate, onError: (e) => toastError(e.message) });
  const remove = trpc.admin.removeCategory.useMutation({
    onSuccess: (r) => {
      invalidate();
      setDelId(null);
      setMoveTo("");
      success(r.movedProducts > 0 ? `حُذف القسم ونُقل ${r.movedProducts} منتج` : "حُذف القسم");
    },
    onError: (e) => toastError(e.message),
  });

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [addSubTo, setAddSubTo] = useState<string | null>(null);
  const [subName, setSubName] = useState("");

  const all: Cat[] = cats.data ?? [];
  const parents = all.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  function subtreeIds(id: string): Set<string> {
    const set = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of all) {
        if (c.parentId && set.has(c.parentId) && !set.has(c.id)) { set.add(c.id); added = true; }
      }
    }
    return set;
  }
  const destinations = (id: string) => { const sub = subtreeIds(id); return all.filter((c) => !sub.has(c.id)); };

  // إعادة ترتيب ضمن نطاقٍ واحد (نفس الأب): نُحرّك العنصر ونرسل المعرّفات بالترتيب الجديد.
  function move(scope: Cat[], index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= scope.length) return;
    const ids = scope.map((c) => c.id);
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    reorder.mutate({ ids });
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold">إدارة الأقسام</h1>
        <p className="text-sm text-neutral-500">هذه هي «أقسام الأسواق» — رتّبها، غيّر اسمها وصورتها وأيقونتها، أظهِرها/أخفِها، أو احذفها. تظهر كبوّاباتٍ داخل الأسواق.</p>
      </div>

      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">إضافة قسم رئيسيّ</h2>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم القسم" />
          <Button
            size="sm"
            loading={create.isPending}
            disabled={name.trim().length < 2}
            onClick={() => { create.mutate({ nameAr: name.trim(), parentId: null, sortOrder: parents.length }); setName(""); }}
          >
            إضافة
          </Button>
        </CardBody>
      </Card>

      {cats.isLoading && <p className="text-sm text-neutral-400">…جارٍ التحميل</p>}

      {parents.map((parent, pi) => {
        const children = all.filter((c) => c.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <Card key={parent.id}>
            <CardBody className="space-y-2">
              <Row
                cat={parent}
                index={pi}
                total={parents.length}
                editing={editId === parent.id}
                onMove={(dir) => move(parents, pi, dir)}
                onToggle={() => update.mutate({ id: parent.id, isActive: !parent.isActive })}
                onEdit={() => setEditId(editId === parent.id ? null : parent.id)}
                onAskDelete={() => { setDelId(parent.id); setMoveTo(""); }}
                onSave={(d) => { update.mutate({ id: parent.id, ...d }); setEditId(null); }}
                saving={update.isPending}
                bold
              />
              {delId === parent.id && (
                <DeletePanel cat={parent} destinations={destinations(parent.id)} moveTo={moveTo} setMoveTo={setMoveTo} busy={remove.isPending}
                  onConfirm={() => remove.mutate({ id: parent.id, reassignToId: moveTo || undefined })} onCancel={() => setDelId(null)} />
              )}

              {children.map((ch, ci) => (
                <div key={ch.id} className="ms-3 border-s border-neutral-100 ps-2">
                  <Row
                    cat={ch}
                    index={ci}
                    total={children.length}
                    editing={editId === ch.id}
                    onMove={(dir) => move(children, ci, dir)}
                    onToggle={() => update.mutate({ id: ch.id, isActive: !ch.isActive })}
                    onEdit={() => setEditId(editId === ch.id ? null : ch.id)}
                    onAskDelete={() => { setDelId(ch.id); setMoveTo(""); }}
                    onSave={(d) => { update.mutate({ id: ch.id, ...d }); setEditId(null); }}
                    saving={update.isPending}
                  />
                  {delId === ch.id && (
                    <DeletePanel cat={ch} destinations={destinations(ch.id)} moveTo={moveTo} setMoveTo={setMoveTo} busy={remove.isPending}
                      onConfirm={() => remove.mutate({ id: ch.id, reassignToId: moveTo || undefined })} onCancel={() => setDelId(null)} />
                  )}
                </div>
              ))}

              {/* إضافة قسم فرعيّ */}
              {addSubTo === parent.id ? (
                <div className="ms-3 flex gap-2">
                  <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder={`قسم فرعيّ ضمن ${parent.nameAr}`} className="h-9" />
                  <Button size="sm" loading={create.isPending} disabled={subName.trim().length < 2}
                    onClick={() => { create.mutate({ nameAr: subName.trim(), parentId: parent.id, sortOrder: children.length }); setSubName(""); setAddSubTo(null); }}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddSubTo(null); setSubName(""); }}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <button onClick={() => setAddSubTo(parent.id)} className="ms-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
                  <Plus className="h-4 w-4" /> قسم فرعيّ
                </button>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function Row({
  cat, index, total, editing, onMove, onToggle, onEdit, onAskDelete, onSave, saving, bold,
}: {
  cat: Cat;
  index: number;
  total: number;
  editing: boolean;
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onSave: (d: { nameAr?: string; icon?: string | null; imageUrl?: string | null }) => void;
  saving?: boolean;
  bold?: boolean;
}) {
  const [nm, setNm] = useState(cat.nameAr);
  const [icon, setIcon] = useState(cat.icon ?? "");
  const [img, setImg] = useState(cat.imageUrl ?? "");

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button onClick={() => onMove(-1)} disabled={index === 0} aria-label="لأعلى" className="grid h-4 w-5 place-items-center rounded text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} aria-label="لأسفل" className="grid h-4 w-5 place-items-center rounded text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
        </div>
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-brand-600">
          {cat.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cat.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <CategoryIcon name={cat.icon} className="h-4 w-4" />
          )}
        </span>
        <span className={`flex-1 truncate ${bold ? "font-bold" : ""} ${cat.isActive ? "" : "text-neutral-400"}`}>
          {cat.nameAr}
          <span className="ms-2 text-xs text-neutral-400 nums">({cat.products})</span>
          {!cat.isActive && <span className="ms-2 text-xs text-danger">مخفيّ</span>}
        </span>
        <button onClick={onToggle} aria-label={cat.isActive ? "إخفاء" : "إظهار"} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100">
          {cat.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button onClick={onEdit} aria-label="تعديل" className="grid h-8 w-8 place-items-center rounded-lg text-brand-600 hover:bg-brand-50"><Pencil className="h-4 w-4" /></button>
        <button onClick={onAskDelete} aria-label="حذف" className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
      </div>

      {editing && (
        <div className="mt-2 space-y-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium text-neutral-600">الاسم
              <input value={nm} onChange={(e) => setNm(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-neutral-300 px-2.5 text-sm" />
            </label>
            <label className="block text-xs font-medium text-neutral-600">مفتاح الأيقونة (اختياريّ)
              <input dir="ltr" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="smartphone / shirt / home…" className="mt-1 h-9 w-full rounded-lg border border-neutral-300 px-2.5 text-sm" />
            </label>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">صورة القسم (تُفضَّل على الأيقونة)</span>
            <div className="max-w-[220px]"><ImageField value={img} onChange={setImg} purpose="category" aspect="aspect-square" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onEdit}>إلغاء</Button>
            <Button size="sm" loading={saving} disabled={nm.trim().length < 2}
              onClick={() => onSave({ nameAr: nm.trim(), icon: icon.trim() || null, imageUrl: img.trim() || null })}>
              حفظ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeletePanel({
  cat, destinations, moveTo, setMoveTo, busy, onConfirm, onCancel,
}: {
  cat: Cat; destinations: Cat[]; moveTo: string; setMoveTo: (v: string) => void; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const hasProducts = cat.products > 0;
  const hasChildren = cat.children > 0;
  return (
    <div className="mt-1 space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
      <p className="font-medium text-danger">حذف «{cat.nameAr}»؟{hasChildren && " سيُحذف مع كل أقسامه الفرعية."}</p>
      {(hasProducts || hasChildren) && (
        <label className="block text-xs text-neutral-600">
          نقل المنتجات إلى (اختياري — للأقسام التي تحوي منتجات):
          <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="mt-1 h-9">
            <option value="">— بدون نقل (يُرفض إن وُجدت منتجات) —</option>
            {destinations.map((d) => (<option key={d.id} value={d.id}>{d.parentId ? `— ${d.nameAr}` : d.nameAr}</option>))}
          </Select>
        </label>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="danger" loading={busy} onClick={onConfirm}>تأكيد الحذف</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}
