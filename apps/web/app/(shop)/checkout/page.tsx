"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";
import { AddressForm } from "@/src/components/address-form";

const DELIVERY_FEE = 5000; // لكل بائع (مطابق للخادم)

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);

  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const addresses = trpc.address.list.useQuery(undefined, { enabled: me.isSuccess });
  const [addressId, setAddressId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const place = trpc.order.place.useMutation({
    onSuccess: () => {
      clear();
      router.replace("/orders?placed=1");
    },
    onError: (e) => setError(e.message),
  });

  // عدد البائعين في السلة (لحساب رسوم التوصيل لكل بائع)
  const vendorCount = useMemo(() => new Set(lines.map((l) => l.vendorId)).size, [lines]);
  const deliveryTotal = vendorCount * DELIVERY_FEE;
  const effectiveAddress = addressId || addresses.data?.find((a) => a.isDefault)?.id || addresses.data?.[0]?.id || "";

  if (me.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;

  if (me.isError || !me.data) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <p>سجّل الدخول لإتمام الطلب.</p>
          <Button onClick={() => router.push("/login?next=/checkout")}>تسجيل الدخول</Button>
        </CardBody>
      </Card>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">سلتك فارغة</p>
        <Link href="/" className="mt-3 inline-block text-brand-600">
          تصفّح المنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-xl font-bold">إتمام الطلب</h1>

      {/* العنوان */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">عنوان التوصيل</h2>
            <button className="text-sm text-brand-600" onClick={() => setShowForm((s) => !s)}>
              + عنوان جديد
            </button>
          </div>

          {addresses.data && addresses.data.length > 0 ? (
            <div className="space-y-2">
              {addresses.data.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${
                    effectiveAddress === a.id ? "border-brand-500 bg-brand-50" : "border-neutral-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    className="mt-1"
                    checked={effectiveAddress === a.id}
                    onChange={() => setAddressId(a.id)}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{a.fullName}</span> — {a.governorate}/{a.area}
                    <br />
                    <span className="text-neutral-500">{a.line}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            !showForm && <p className="text-sm text-neutral-500">لا يوجد عنوان محفوظ. أضف عنواناً.</p>
          )}

          {showForm && <AddressForm onDone={() => setShowForm(false)} />}
        </CardBody>
      </Card>

      {/* الملخّص */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">ملخّص الطلب</h2>
          {lines.map((l) => (
            <div key={l.variantId} className="flex justify-between text-sm">
              <span className="line-clamp-1">
                {l.title} <span className="text-neutral-400">×{l.quantity}</span>
              </span>
              <span className="nums">{formatIQD(l.unitPrice * l.quantity)}</span>
            </div>
          ))}
          <div className="my-1 border-t border-neutral-100" />
          <Row label="المجموع" value={formatIQD(subtotal)} />
          <Row label={`التوصيل (${vendorCount} بائع)`} value={formatIQD(deliveryTotal)} />
          <Row label="الإجمالي" value={formatIQD(subtotal + deliveryTotal)} bold />
          <p className="pt-1 text-xs text-neutral-500">طريقة الدفع: الدفع عند الاستلام (COD)</p>
        </CardBody>
      </Card>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة للبائع (اختياري)"
        rows={2}
        className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white p-3">
        <div className="container-app">
          <Button
            className="w-full"
            size="lg"
            loading={place.isPending}
            disabled={!effectiveAddress}
            onClick={() => {
              setError(null);
              place.mutate({
                addressId: effectiveAddress,
                items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
                customerNote: note || undefined,
              });
            }}
          >
            {effectiveAddress ? `تأكيد الطلب — ${formatIQD(subtotal + deliveryTotal)}` : "اختر عنواناً"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : "text-sm"}`}>
      <span className={bold ? "" : "text-neutral-500"}>{label}</span>
      <span className="nums">{value}</span>
    </div>
  );
}
