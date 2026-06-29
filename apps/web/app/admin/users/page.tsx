"use client";

import { useState } from "react";
import { Button, Card, CardBody, Badge, Input } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "مشترٍ", VENDOR: "بائع", ADMIN: "مدير" };
const ROLE_FILTERS = ["", "CUSTOMER", "VENDOR", "ADMIN"];

export default function AdminUsers() {
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const users = trpc.admin.users.useQuery({ role: role || undefined, q: q || undefined }, { retry: false });
  const utils = trpc.useUtils();
  const manage = trpc.admin.manageUser.useMutation({
    onSuccess: () => utils.admin.users.invalidate(),
    onError: (e) => alert(e.message),
  });

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
        <ul className="space-y-2">
          {users.data?.map((u) => (
            <Card key={u.id}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {u.name ?? "—"} <Badge className="ms-1 bg-neutral-100 text-neutral-600">{ROLE_LABEL[u.role]}</Badge>
                  </p>
                  <p className="text-sm text-neutral-500 nums">{u.phone}</p>
                  {u.isBlocked && <span className="text-xs text-danger">محظور</span>}
                </div>
                <Button
                  size="sm"
                  variant={u.isBlocked ? "outline" : "danger"}
                  loading={manage.isPending}
                  onClick={() => manage.mutate({ userId: u.id, action: u.isBlocked ? "unblock" : "block" })}
                >
                  {u.isBlocked ? "رفع الحظر" : "حظر"}
                </Button>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
