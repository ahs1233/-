"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardBody, Input, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export default function AdminSettings() {
  const { success, error } = useToast();
  const settings = trpc.admin.getSettings.useQuery(undefined, { retry: false });
  const governorates = trpc.geo.governorates.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      success("تم حفظ الإعدادات");
    },
    onError: (e) => error(e.message),
  });

  const [commissionPct, setCommissionPct] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [byGov, setByGov] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data) {
      setCommissionPct(String(Math.round(settings.data.commissionRate * 100)));
      setDeliveryFee(String(settings.data.deliveryFee));
      setByGov(Object.fromEntries(Object.entries(settings.data.deliveryFeesByGov).map(([k, v]) => [k, String(v)])));
    }
  }, [settings.data]);

  function save() {
    const feesByGov: Record<string, number> = {};
    for (const [govId, val] of Object.entries(byGov)) {
      const n = Number(val);
      if (val !== "" && Number.isFinite(n) && n >= 0) feesByGov[govId] = Math.round(n);
    }
    update.mutate({
      commissionRate: Math.max(0, Math.min(100, Number(commissionPct))) / 100,
      deliveryFee: Number(deliveryFee),
      deliveryFeesByGov: feesByGov,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">إعدادات المنصة</h1>

      <Card>
        <CardBody className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">نسبة العمولة (%)</span>
            <Input inputMode="numeric" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            <span className="text-xs text-neutral-400">تُطبَّق على الطلبات الجديدة.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">رسوم التوصيل الافتراضية لكل بائع (د.ع)</span>
            <Input inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div>
            <h2 className="font-bold">رسوم التوصيل حسب المحافظة</h2>
            <p className="text-xs text-neutral-400">
              اترك الحقل فارغاً لاستخدام الرسوم الافتراضية. تُطبَّق حسب محافظة عنوان التوصيل.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {governorates.data?.map((g) => (
              <label key={g.id} className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">{g.nameAr}</span>
                <Input
                  inputMode="numeric"
                  placeholder={deliveryFee || "افتراضي"}
                  value={byGov[g.id] ?? ""}
                  onChange={(e) => setByGov((prev) => ({ ...prev, [g.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </CardBody>
      </Card>

      <Button loading={update.isPending} onClick={save}>
        حفظ الإعدادات
      </Button>
    </div>
  );
}
