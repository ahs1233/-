"use client";

import { useRouter } from "next/navigation";
import { Button, Card, CardBody } from "@al-souq/ui";
import { ar } from "@al-souq/i18n";
import { formatIraqiPhoneLocal } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

export default function AccountPage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  if (me.isLoading) return <p className="text-neutral-500">{ar.common.loading}</p>;
  if (me.isError || !me.data) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <p>يجب تسجيل الدخول.</p>
          <Button onClick={() => router.push("/login?next=/account")}>{ar.auth.login}</Button>
        </CardBody>
      </Card>
    );
  }

  const u = me.data;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{ar.nav.account}</h1>
      <Card>
        <CardBody className="space-y-2">
          <Row label={ar.auth.nameLabel} value={u.name ?? "—"} />
          <Row label={ar.auth.phoneLabel} value={formatIraqiPhoneLocal(u.phone)} ltr />
          <Row label="الدور" value={roleLabel(u.role)} />
        </CardBody>
      </Card>
      <Button variant="outline" className="w-full" loading={logout.isPending} onClick={() => logout.mutate({})}>
        {ar.auth.logout}
      </Button>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={ltr ? "nums font-medium" : "font-medium"}>{value}</span>
    </div>
  );
}

function roleLabel(role: string): string {
  return role === "ADMIN" ? "مدير" : role === "VENDOR" ? "بائع" : "مشترٍ";
}
