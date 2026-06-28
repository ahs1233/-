"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Select } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export default function AdminCategories() {
  const cats = trpc.admin.categories.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.admin.categories.invalidate();
    utils.catalog.categories.invalidate();
  };
  const create = trpc.admin.createCategory.useMutation({ onSuccess: invalidate });
  const update = trpc.admin.updateCategory.useMutation({ onSuccess: invalidate });
  const remove = trpc.admin.removeCategory.useMutation({ onSuccess: invalidate, onError: (e) => alert(e.message) });

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");

  const parents = cats.data?.filter((c) => !c.parentId) ?? [];

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
        const children = cats.data?.filter((c) => c.parentId === parent.id) ?? [];
        return (
          <Card key={parent.id}>
            <CardBody className="space-y-2">
              <Row cat={parent} onToggle={(active) => update.mutate({ id: parent.id, isActive: active })} onDelete={() => remove.mutate({ id: parent.id })} bold />
              {children.map((ch) => (
                <Row key={ch.id} cat={ch} onToggle={(active) => update.mutate({ id: ch.id, isActive: active })} onDelete={() => remove.mutate({ id: ch.id })} />
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
  onDelete,
  bold,
}: {
  cat: { id: string; nameAr: string; isActive: boolean; products: number; children: number };
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? "" : "ms-4"}`}>
      <span className={bold ? "font-bold" : ""}>
        {cat.nameAr}
        <span className="ms-2 text-xs text-neutral-400 nums">({cat.products})</span>
        {!cat.isActive && <span className="ms-2 text-xs text-danger">معطّلة</span>}
      </span>
      <div className="flex gap-2 text-sm">
        <button className="text-neutral-500" onClick={() => onToggle(!cat.isActive)}>
          {cat.isActive ? "تعطيل" : "تفعيل"}
        </button>
        <button className="text-danger" onClick={onDelete}>
          حذف
        </button>
      </div>
    </div>
  );
}
