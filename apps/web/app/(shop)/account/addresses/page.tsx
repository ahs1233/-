"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { AddressForm } from "@/src/components/address-form";

export default function AddressesPage() {
  const addresses = trpc.address.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);

  const setDefault = trpc.address.setDefault.useMutation({ onSuccess: () => utils.address.list.invalidate() });
  const remove = trpc.address.remove.useMutation({ onSuccess: () => utils.address.list.invalidate() });

  if (addresses.isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">سجّل الدخول لإدارة عناوينك.</p>
        <Link href="/login?next=/account/addresses" className="mt-3 inline-block text-brand-600">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">عناويني</h1>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          + عنوان جديد
        </Button>
      </div>

      {showForm && <AddressForm onDone={() => setShowForm(false)} />}

      {addresses.data && addresses.data.length > 0 ? (
        <ul className="space-y-3">
          {addresses.data.map((a) => (
            <Card key={a.id}>
              <CardBody className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.fullName}</span>
                  {a.isDefault && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">افتراضي</span>
                  )}
                </div>
                <p className="text-sm text-neutral-600">
                  {a.governorate}/{a.area} — {a.line}
                </p>
                <p className="text-sm text-neutral-500 nums">{a.phone}</p>
                <div className="flex gap-3 pt-1 text-sm">
                  {!a.isDefault && (
                    <button className="text-brand-600" onClick={() => setDefault.mutate({ id: a.id })}>
                      تعيين افتراضياً
                    </button>
                  )}
                  <button className="text-danger" onClick={() => remove.mutate({ id: a.id })}>
                    حذف
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      ) : (
        !showForm && <p className="text-neutral-500">لا توجد عناوين محفوظة.</p>
      )}
    </div>
  );
}
