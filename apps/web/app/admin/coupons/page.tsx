"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Select, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

export default function AdminCoupons() {
  const { success, error } = useToast();
  const coupons = trpc.admin.coupons.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const invalidate = () => utils.admin.coupons.invalidate();
  const create = trpc.admin.createCoupon.useMutation({
    onSuccess: () => {
      invalidate();
      success("تم إنشاء الكوبون");
      reset();
    },
    onError: (e) => error(e.message),
  });
  const toggle = trpc.admin.toggleCoupon.useMutation({ onSuccess: invalidate, onError: (e) => error(e.message) });

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  function reset() {
    setCode("");
    setValue("");
    setMinSubtotal("");
    setMaxDiscount("");
    setUsageLimit("");
    setExpiresAt("");
  }

  const valueNum = Number(value);
  const canSubmit = code.trim().length >= 3 && valueNum > 0 && (type === "PERCENT" ? valueNum <= 100 : true);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الكوبونات</h1>

      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">إنشاء كوبون</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="الرمز (مثل EID20)"
              className="uppercase nums"
            />
            <Select value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}>
              <option value="PERCENT">نسبة ٪</option>
              <option value="FIXED">مبلغ ثابت</option>
            </Select>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
              placeholder={type === "PERCENT" ? "النسبة (٠–١٠٠)" : "المبلغ (د.ع)"}
            />
            <Input
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
              inputMode="numeric"
              placeholder="حدّ أدنى للسلة (د.ع)"
            />
            {type === "PERCENT" && (
              <Input
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                inputMode="numeric"
                placeholder="سقف الخصم (د.ع)"
              />
            )}
            <Input
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              inputMode="numeric"
              placeholder="حدّ الاستخدام (اختياري)"
            />
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="تاريخ الانتهاء" />
          </div>
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!canSubmit}
            onClick={() =>
              create.mutate({
                code: code.trim(),
                type,
                value: valueNum,
                minSubtotal: minSubtotal ? Number(minSubtotal) : 0,
                maxDiscount: type === "PERCENT" && maxDiscount ? Number(maxDiscount) : undefined,
                usageLimit: usageLimit ? Number(usageLimit) : undefined,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
              })
            }
          >
            إنشاء
          </Button>
        </CardBody>
      </Card>

      {coupons.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : coupons.data && coupons.data.length > 0 ? (
        <div className="space-y-2">
          {coupons.data.map((c) => {
            const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < Date.now() : false;
            const exhausted = c.usageLimit !== null && c.usedCount >= c.usageLimit;
            return (
              <Card key={c.id}>
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold nums">{c.code}</span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 nums">
                        {c.type === "PERCENT" ? `${c.value}٪` : formatIQD(c.value)}
                      </span>
                      {!c.isActive && <span className="text-xs text-danger">معطّل</span>}
                      {expired && <span className="text-xs text-danger">منتهٍ</span>}
                      {exhausted && <span className="text-xs text-gold-600">مستنفد</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 nums">
                      {c.minSubtotal > 0 && `حدّ أدنى ${formatIQD(c.minSubtotal)} · `}
                      {c.maxDiscount ? `سقف ${formatIQD(c.maxDiscount)} · ` : ""}
                      استُخدم {c.usedCount}
                      {c.usageLimit !== null ? `/${c.usageLimit}` : ""}
                      {c.expiresAt ? ` · حتى ${new Date(c.expiresAt).toLocaleDateString("ar-IQ")}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={c.isActive ? "outline" : "primary"}
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}
                  >
                    {c.isActive ? "تعطيل" : "تفعيل"}
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-neutral-500">لا كوبونات بعد.</p>
      )}
    </div>
  );
}
