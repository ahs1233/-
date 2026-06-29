"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardBody, Input, Select, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageUploader } from "@/src/components/vendor/image-uploader";

export default function VendorSettings() {
  const me = trpc.vendor.me.useQuery(undefined, { retry: false });
  const governorates = trpc.geo.governorates.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.vendor.updateSettings.useMutation({
    onSuccess: () => {
      utils.vendor.me.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [logo, setLogo] = useState<string[]>([]);
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me.data) {
      setStoreName(me.data.storeName);
      setDescription(me.data.description ?? "");
      setGovernorateId(me.data.governorate?.id ?? "");
      setLogo(me.data.logoUrl ? [me.data.logoUrl] : []);
      const pd = me.data.payoutDetails as { method?: string; account?: string } | null;
      setPayoutMethod(pd?.method ?? "");
      setPayoutAccount(pd?.account ?? "");
    }
  }, [me.data]);

  if (me.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold">إعدادات المتجر</h1>

      <Card>
        <CardBody className="space-y-3">
          <Field label="اسم المتجر">
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <Field label="نبذة عن المتجر">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="المحافظة">
            <Select value={governorateId} onChange={(e) => setGovernorateId(e.target.value)}>
              <option value="">اختر</option>
              {governorates.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="شعار المتجر">
            <ImageUploader value={logo} onChange={(urls) => setLogo(urls.slice(-1))} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">تفاصيل التسوية المالية</h2>
          <Field label="طريقة الاستلام">
            <Select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
              <option value="">اختر</option>
              <option value="ZainCash">زين كاش</option>
              <option value="cash">نقداً</option>
              <option value="bank">حوالة بنكية</option>
            </Select>
          </Field>
          <Field label="رقم الحساب / المحفظة">
            <Input dir="ltr" value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      <Button
        className="w-full"
        loading={update.isPending}
        onClick={() =>
          update.mutate({
            storeName,
            description,
            governorateId: governorateId || undefined,
            logoUrl: logo[0] ?? "",
            payoutMethod: payoutMethod || undefined,
            payoutAccount: payoutAccount || undefined,
          })
        }
      >
        {saved ? "تم الحفظ ✓" : "حفظ الإعدادات"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
