"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export function AddressForm({ onDone }: { onDone?: () => void }) {
  const governorates = trpc.geo.governorates.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.address.create.useMutation({
    onSuccess: () => {
      utils.address.list.invalidate();
      onDone?.();
    },
    onError: (e) => setError(e.message),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [line, setLine] = useState("");
  const [error, setError] = useState<string | null>(null);

  const areas = useMemo(
    () => governorates.data?.find((g) => g.id === governorateId)?.areas ?? [],
    [governorates.data, governorateId],
  );

  return (
    <form
      className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        create.mutate({ fullName, phone, governorateId, areaId, line, isDefault: false });
      }}
    >
      <Input placeholder="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Input dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <div className="flex gap-2">
        <Select
          value={governorateId}
          onChange={(e) => {
            setGovernorateId(e.target.value);
            setAreaId("");
          }}
          required
        >
          <option value="">المحافظة</option>
          {governorates.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nameAr}
            </option>
          ))}
        </Select>
        <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} required disabled={!governorateId}>
          <option value="">المنطقة</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameAr}
            </option>
          ))}
        </Select>
      </div>
      <Input placeholder="أقرب نقطة دالة / تفاصيل العنوان" value={line} onChange={(e) => setLine(e.target.value)} required />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="sm" loading={create.isPending}>
        حفظ العنوان
      </Button>
    </form>
  );
}
