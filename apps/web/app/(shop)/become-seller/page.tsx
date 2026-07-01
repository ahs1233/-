"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Input, Select, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export default function BecomeSellerPage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const governorates = trpc.geo.governorates.useQuery();
  const utils = trpc.useUtils();

  const register = trpc.vendor.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.replace("/vendor");
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // غير مسجّل الدخول → حوّله مباشرةً إلى تسجيل الدخول بهاتفه، وبعد التحقق يعود إلى نموذج المتجر.
  // نتجنّب التحويل أثناء جلب حالة المصادقة (حتى لا نرتدّ قبل اكتمال تسجيل الدخول).
  const notLoggedIn = !me.isFetching && (me.isError || (me.isSuccess && !me.data));
  useEffect(() => {
    if (notLoggedIn) router.replace("/login?next=/become-seller");
  }, [notLoggedIn, router]);

  if (me.isLoading || notLoggedIn || !me.data) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (me.data.role === "VENDOR" || me.data.role === "ADMIN") {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <p>لديك متجر بالفعل.</p>
          <Button onClick={() => router.push("/vendor")}>لوحة البائع</Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-l from-brand-500 to-brand-600 p-5 text-white">
        <h1 className="text-2xl font-bold">افتح متجرك في السوگ</h1>
        <p className="mt-1 text-sm opacity-90">بيّع منتجاتك لكل العراق — الدفع عند الاستلام.</p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">اسم المتجر</span>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="مثال: متجر النور" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">نبذة (اختياري)</span>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">المحافظة</span>
            <Select value={governorateId} onChange={(e) => setGovernorateId(e.target.value)}>
              <option value="">اختر المحافظة</option>
              {governorates.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </Select>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            className="w-full"
            loading={register.isPending}
            disabled={!storeName || !governorateId}
            onClick={() => {
              setError(null);
              register.mutate({ storeName, description: description || undefined, governorateId });
            }}
          >
            إنشاء المتجر
          </Button>
          <p className="text-center text-xs text-neutral-500">سيُراجع طلبك من الإدارة قبل النشر.</p>
        </CardBody>
      </Card>
    </div>
  );
}
