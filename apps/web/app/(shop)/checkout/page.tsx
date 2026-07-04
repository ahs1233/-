"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";
import { useCartHydrated } from "@/src/store/use-cart-hydrated";
import { AddressForm } from "@/src/components/address-form";

const DELIVERY_FEE = 5000; // لكل بائع (مطابق للخادم)

// تعليمات توصيل جاهزة (تُدمج في ملاحظة الطلب) — مطابقة لتجربة تطبيقات التوصيل.
const DELIVERY_INSTRUCTIONS = [
  { key: "door", icon: "🚪", label: "اتركه عند الباب" },
  { key: "no-bell", icon: "🔕", label: "لا ترن الجرس" },
  { key: "call", icon: "📞", label: "اتصل عند الوصول" },
  { key: "reception", icon: "🛎️", label: "اتركه مع موظف الاستقبال" },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);

  const hydrated = useCartHydrated();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const addresses = trpc.address.list.useQuery(undefined, { enabled: me.isSuccess });
  const checkoutMeta = trpc.order.checkoutMeta.useQuery(undefined, { enabled: me.isSuccess });
  const [addressId, setAddressId] = useState<string>("");
  const [changingAddress, setChangingAddress] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [instructions, setInstructions] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const validateCoupon = trpc.order.validateCoupon.useMutation({
    onSuccess: (r) => {
      setApplied({ code: r.code, discount: r.discount });
      setCouponError(null);
    },
    onError: (e) => {
      setApplied(null);
      setCouponError(e.message);
    },
  });

  // فتح نموذج العنوان تلقائياً عند عدم وجود عنوان محفوظ.
  const noAddresses = addresses.isSuccess && addresses.data.length === 0;
  useEffect(() => {
    if (noAddresses) {
      setShowForm(true);
      setChangingAddress(true);
    }
  }, [noAddresses]);

  const place = trpc.order.place.useMutation({
    onSuccess: () => {
      clear();
      router.replace("/orders?placed=1");
    },
    onError: (e) => setError(e.message),
  });

  const vendorCount = useMemo(() => new Set(lines.map((l) => l.vendorId)).size, [lines]);
  const deliveryTotal = vendorCount * DELIVERY_FEE;
  // الخصم المطبَّق لا يتجاوز المجموع الجزئي (حماية عرضية؛ الخادم هو المرجع).
  const discount = applied ? Math.min(applied.discount, subtotal) : 0;
  const total = subtotal - discount + deliveryTotal;
  const minOrder = checkoutMeta.data?.minOrderValue ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;

  // إبطال الكوبون المطبَّق إن تغيّرت السلة (يُعاد التحقّق يدوياً).
  useEffect(() => {
    setApplied(null);
    setCouponError(null);
  }, [subtotal]);

  const effectiveAddress =
    addressId || addresses.data?.find((a) => a.isDefault)?.id || addresses.data?.[0]?.id || "";
  const selectedAddress = addresses.data?.find((a) => a.id === effectiveAddress);

  function toggleInstruction(key: string) {
    setInstructions((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function composedNote(): string | undefined {
    const chips = DELIVERY_INSTRUCTIONS.filter((i) => instructions.has(i.key)).map((i) => i.label);
    const parts = [...chips, note.trim()].filter(Boolean);
    const joined = parts.join("، ").slice(0, 300);
    return joined || undefined;
  }

  if (me.isLoading || !hydrated) return <p className="text-neutral-500">جارٍ التحميل…</p>;

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

  const hasAddresses = (addresses.data?.length ?? 0) > 0;

  return (
    <div className="space-y-3 pb-44 md:pb-28">
      <h1 className="text-xl font-bold">إتمام الطلب</h1>

      {/* وقت التوصيل */}
      <Card>
        <CardBody className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">وقت التوصيل</h2>
            <p className="text-sm text-neutral-500">خلال ٣٠–٦٠ دقيقة تقريباً</p>
          </div>
          <span className="text-2xl" aria-hidden>
            🕒
          </span>
        </CardBody>
      </Card>

      {/* عنوان التوصيل */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">عنوان التوصيل</h2>
            {hasAddresses && !changingAddress && (
              <button
                className="rounded-lg border border-brand-500 px-3 py-1 text-sm text-brand-600"
                onClick={() => setChangingAddress(true)}
              >
                تغيير
              </button>
            )}
          </div>

          {/* عرض العنوان المختار مطويّاً */}
          {hasAddresses && !changingAddress && selectedAddress && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-xl" aria-hidden>
                📍
              </span>
              <div className="text-sm">
                <p className="font-medium">{selectedAddress.fullName}</p>
                <p className="text-neutral-500">
                  {selectedAddress.governorate}/{selectedAddress.area} — {selectedAddress.line}
                </p>
              </div>
            </div>
          )}

          {/* اختيار العنوان (عند التغيير) */}
          {changingAddress && (
            <div className="space-y-2">
              {addresses.data?.map((a) => (
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
                    onChange={() => {
                      setAddressId(a.id);
                      setChangingAddress(false);
                    }}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{a.fullName}</span> — {a.governorate}/{a.area}
                    <br />
                    <span className="text-neutral-500">{a.line}</span>
                  </span>
                </label>
              ))}

              {!showForm ? (
                <button className="text-sm text-brand-600" onClick={() => setShowForm(true)}>
                  + إضافة عنوان جديد
                </button>
              ) : (
                <AddressForm
                  onDone={() => {
                    setShowForm(false);
                    if (hasAddresses) setChangingAddress(false);
                  }}
                />
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* تعليمات التوصيل */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">تعليمات التوصيل</h2>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_INSTRUCTIONS.map((i) => {
              const active = instructions.has(i.key);
              return (
                <button
                  key={i.key}
                  onClick={() => toggleInstruction(i.key)}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                    active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  <span aria-hidden>{i.icon}</span>
                  <span className="text-start leading-tight">{i.label}</span>
                </button>
              );
            })}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة إضافية للبائع (اختياري)"
            rows={2}
            maxLength={300}
            className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
          />
        </CardBody>
      </Card>

      {/* طريقة الدفع */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">طريقة الدفع</h2>
          <div className="flex items-center gap-3 rounded-lg border border-brand-500 bg-brand-50 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white" aria-hidden>
              💵
            </span>
            <div className="flex-1 text-sm">
              <p className="font-medium">نقداً</p>
              <p className="text-neutral-500">الدفع نقداً عند الاستلام</p>
            </div>
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
          </div>
        </CardBody>
      </Card>

      {/* كوبون الخصم */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">كوبون الخصم</h2>
          {applied ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-500 bg-brand-50 p-3 text-sm">
              <span className="font-medium text-brand-700">
                <span className="nums">{applied.code}</span> — وفّرت {formatIQD(discount)}
              </span>
              <button
                className="text-neutral-500 underline"
                onClick={() => {
                  setApplied(null);
                  setCouponInput("");
                  setCouponError(null);
                }}
              >
                إزالة
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="أدخل رمز الكوبون"
                className="h-10 flex-1 rounded-lg border border-neutral-300 px-3 text-sm uppercase nums"
              />
              <Button
                variant="outline"
                loading={validateCoupon.isPending}
                disabled={couponInput.trim().length < 3}
                onClick={() =>
                  validateCoupon.mutate({
                    code: couponInput.trim(),
                    items: lines.map((l) => ({
                      productId: l.productId,
                      variantId: l.variantId,
                      quantity: l.quantity,
                    })),
                  })
                }
              >
                تطبيق
              </Button>
            </div>
          )}
          {couponError && <p className="text-sm text-danger">{couponError}</p>}
        </CardBody>
      </Card>

      {/* ملخّص الطلب */}
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
          <Row label="المجموع الجزئي" value={formatIQD(subtotal)} />
          {discount > 0 && (
            <div className="flex justify-between text-sm text-brand-600">
              <span>خصم الكوبون ({applied?.code})</span>
              <span className="nums">−{formatIQD(discount)}</span>
            </div>
          )}
          <Row label={`التوصيل (${vendorCount} بائع)`} value={formatIQD(deliveryTotal)} />
          <Row label="الإجمالي" value={formatIQD(total)} bold />
        </CardBody>
      </Card>

      {belowMin && (
        <p className="rounded-lg bg-gold-400/10 p-2 text-sm text-gold-700">
          الحدّ الأدنى للطلب {formatIQD(minOrder)} — أضف منتجات بقيمة {formatIQD(minOrder - subtotal)} إضافية.
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* الشريط السفلي الثابت — يُرفع فوق شريط التنقّل السفلي على الجوال */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-white p-3 md:bottom-0">
        <div className="container-app flex items-center gap-3">
          <div className="shrink-0">
            <span className="text-xs text-neutral-500">الإجمالي</span>
            <div className="font-bold text-brand-600 nums">{formatIQD(total)}</div>
          </div>
          <Button
            className="flex-1"
            size="lg"
            loading={place.isPending}
            disabled={!effectiveAddress || belowMin}
            onClick={() => {
              setError(null);
              place.mutate({
                addressId: effectiveAddress,
                items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
                customerNote: composedNote(),
                couponCode: applied?.code,
              });
            }}
          >
            {!effectiveAddress
              ? "أضف عنواناً أولاً"
              : belowMin
                ? `الحدّ الأدنى ${formatIQD(minOrder)}`
                : "إتمام الطلب"}
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
