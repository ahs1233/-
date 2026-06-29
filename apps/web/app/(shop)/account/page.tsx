"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Heart,
  MapPin,
  Bell,
  Store,
  ShieldCheck,
  ChevronLeft,
  LogOut,
  type LucideIcon,
} from "lucide-react";
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
  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/orders", label: ar.nav.orders, icon: Package },
    { href: "/favorites", label: ar.nav.favorites, icon: Heart },
    { href: "/account/addresses", label: "عناويني", icon: MapPin },
    { href: "/notifications", label: "الإشعارات", icon: Bell },
    ...(u.role === "CUSTOMER" ? [{ href: "/become-seller", label: "افتح متجرك", icon: Store }] : []),
    ...(u.role === "VENDOR" ? [{ href: "/vendor", label: ar.vendor.dashboard, icon: Store }] : []),
    ...(u.role === "ADMIN" ? [{ href: "/admin", label: ar.admin.dashboard, icon: ShieldCheck }] : []),
  ];

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

      <Card>
        <CardBody className="divide-y divide-neutral-100 p-0">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1 font-medium">{l.label}</span>
                <ChevronLeft className="h-4 w-4 text-neutral-300" />
              </Link>
            );
          })}
        </CardBody>
      </Card>

      <Button variant="outline" className="w-full" loading={logout.isPending} onClick={() => logout.mutate({})}>
        <LogOut className="h-4 w-4" /> {ar.auth.logout}
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
