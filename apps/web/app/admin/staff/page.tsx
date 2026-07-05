"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Select, Badge, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

// تسميات الصلاحيات (مطابقة لمفاتيح الخادم في @al-souq/auth).
const PERMISSIONS: { key: string; label: string }[] = [
  { key: "dashboard", label: "المؤشرات" },
  { key: "orders", label: "الطلبات" },
  { key: "finance", label: "المالية" },
  { key: "vendors", label: "المتاجر" },
  { key: "products", label: "المنتجات" },
  { key: "categories", label: "الفئات" },
  { key: "coupons", label: "الكوبونات" },
  { key: "users", label: "المستخدمون" },
  { key: "settings", label: "الإعدادات" },
  { key: "audit", label: "التدقيق" },
  { key: "staff", label: "إدارة الموظفين" },
];
const PERM_LABEL = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label]));

// قوالب أدوار جاهزة.
const PRESETS: { key: string; label: string; permissions: string[]; scoped?: boolean }[] = [
  { key: "GOVERNORATE", label: "مدير محافظة", permissions: ["dashboard", "orders", "vendors"], scoped: true },
  { key: "ACCOUNTS", label: "مدير الحسابات", permissions: ["dashboard", "finance"] },
  { key: "MARKETING", label: "مدير التسويق", permissions: ["dashboard", "coupons", "products"] },
  { key: "PRODUCTS", label: "مدير المنتجات", permissions: ["dashboard", "products", "categories"] },
  { key: "CALLCENTER", label: "مدير مركز الاتصال", permissions: ["dashboard", "orders"] },
  { key: "SUPER", label: "مدير عام", permissions: PERMISSIONS.map((p) => p.key) },
];

export default function AdminStaff() {
  const { success, error } = useToast();
  const staff = trpc.admin.staffList.useQuery(undefined, { retry: false });
  const govs = trpc.geo.governorates.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.admin.staffList.invalidate();

  const create = trpc.admin.staffCreate.useMutation({
    onSuccess: () => {
      invalidate();
      success("تم إنشاء حساب الموظف");
      reset();
    },
    onError: (e) => error(e.message),
  });
  const revoke = trpc.admin.staffRevoke.useMutation({
    onSuccess: () => {
      invalidate();
      success("أُلغيت صلاحيات الموظف");
    },
    onError: (e) => error(e.message),
  });

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [gov, setGov] = useState("");

  function reset() {
    setPhone("");
    setName("");
    setTitle("");
    setPerms([]);
    setGov("");
  }
  function applyPreset(p: (typeof PRESETS)[number]) {
    setPerms(p.permissions);
    if (!title) setTitle(p.label);
  }
  function togglePerm(k: string) {
    setPerms((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  const showGov = perms.includes("orders") || perms.includes("vendors");
  const canSubmit = phone.trim().length >= 10 && name.trim().length >= 2 && perms.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الموظفون والصلاحيات</h1>
      <p className="text-sm text-neutral-500">
        أنشئ حسابات عمل بصلاحيات محدودة تناسب كل وظيفة. يدخل الموظف بهاتفه عبر رمز التحقّق كأي مستخدم.
      </p>

      {/* إنشاء موظف */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">إضافة موظف</h2>

          <div>
            <p className="mb-1 text-xs text-neutral-500">قالب جاهز (يملأ الصلاحيات):</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p)}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:border-brand-500 hover:text-brand-600"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الموظف" />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="الهاتف (07XXXXXXXXX)"
              className="nums"
            />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="المسمّى الوظيفي (مثل: مدير محافظة النجف)" />
            {showGov && (
              <Select value={gov} onChange={(e) => setGov(e.target.value)}>
                <option value="">كل المحافظات (بلا نطاق)</option>
                {govs.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    نطاق: {g.nameAr}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs text-neutral-500">الصلاحيات:</p>
            <div className="flex flex-wrap gap-1.5">
              {PERMISSIONS.map((p) => {
                const on = perms.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => togglePerm(p.key)}
                    className={`rounded-full px-3 py-1 text-sm transition ${
                      on ? "bg-brand-500 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            size="sm"
            loading={create.isPending}
            disabled={!canSubmit}
            onClick={() =>
              create.mutate({
                phone: phone.trim(),
                name: name.trim(),
                staffTitle: title.trim() || undefined,
                permissions: perms,
                scopeGovernorateId: showGov && gov ? gov : null,
              })
            }
          >
            إنشاء الحساب
          </Button>
        </CardBody>
      </Card>

      {/* قائمة الموظفين */}
      {staff.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : staff.isError ? (
        <QueryError message={staff.error.message} onRetry={() => staff.refetch()} />
      ) : (
        <div className="space-y-2">
          {staff.data?.map((s) => (
            <Card key={s.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {s.name ?? "—"}
                      {s.isSuper && <span className="ms-2 text-xs text-brand-600">مدير عام</span>}
                      {s.isSelf && <span className="ms-1 text-xs text-neutral-400">(أنت)</span>}
                    </p>
                    <p className="text-xs text-neutral-500 nums">
                      {s.phone}
                      {s.staffTitle ? ` · ${s.staffTitle}` : ""}
                      {s.scopeGovernorate ? ` · نطاق: ${s.scopeGovernorate}` : ""}
                      {s.isBlocked ? " · محظور" : ""}
                    </p>
                  </div>
                  {!s.isSuper && !s.isSelf && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={revoke.isPending}
                      onClick={() => {
                        if (confirm(`إلغاء صلاحيات ${s.name ?? s.phone}؟ سيعود مستخدماً عادياً.`))
                          revoke.mutate({ userId: s.id });
                      }}
                    >
                      إلغاء الصلاحيات
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.isSuper ? (
                    <Badge className="bg-brand-50 text-brand-700">كل الصلاحيات</Badge>
                  ) : (
                    s.permissions.map((p) => (
                      <Badge key={p} className="bg-neutral-100 text-neutral-600">
                        {PERM_LABEL[p] ?? p}
                      </Badge>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
