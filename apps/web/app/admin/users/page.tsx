"use client";

import { useState } from "react";
import { Button, Badge, Input, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { DataTable, type Column } from "@/src/components/data-table";

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "مشترٍ", VENDOR: "بائع", ADMIN: "مدير" };
const ROLE_FILTERS = ["", "CUSTOMER", "VENDOR", "ADMIN"];

export default function AdminUsers() {
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const { success, error } = useToast();
  const users = trpc.admin.users.useQuery({ role: role || undefined, q: q || undefined }, { retry: false });
  const utils = trpc.useUtils();
  const manage = trpc.admin.manageUser.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      success("تم تحديث حالة المستخدم");
    },
    onError: (e) => error(e.message),
  });

  type User = NonNullable<typeof users.data>[number];
  const columns: Column<User>[] = [
    { key: "name", header: "الاسم", sortValue: (u) => u.name ?? "", render: (u) => u.name ?? "—" },
    {
      key: "role",
      header: "الدور",
      sortValue: (u) => u.role,
      render: (u) => <Badge className="bg-neutral-100 text-neutral-600">{ROLE_LABEL[u.role] ?? u.role}</Badge>,
    },
    { key: "phone", header: "الهاتف", render: (u) => <span className="nums text-neutral-600">{u.phone}</span> },
    {
      key: "state",
      header: "الحالة",
      render: (u) =>
        u.isBlocked ? <span className="text-danger">محظور</span> : <span className="text-neutral-500">نشط</span>,
    },
    {
      key: "action",
      header: "إجراء",
      hideLabelOnMobile: true,
      render: (u) => (
        <Button
          size="sm"
          variant={u.isBlocked ? "outline" : "danger"}
          loading={manage.isPending}
          onClick={() => manage.mutate({ userId: u.id, action: u.isBlocked ? "unblock" : "block" })}
        >
          {u.isBlocked ? "رفع الحظر" : "حظر"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المستخدمون</h1>

      <Input dir="rtl" placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="flex gap-1">
        {ROLE_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-full px-3 py-1 text-sm ${role === r ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            {r ? ROLE_LABEL[r] : "الكل"}
          </button>
        ))}
      </div>

      {users.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : (
        <DataTable columns={columns} rows={users.data ?? []} getRowKey={(u) => u.id} emptyLabel="لا مستخدمين مطابقين" />
      )}
    </div>
  );
}
