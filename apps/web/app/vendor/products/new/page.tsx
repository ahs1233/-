"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Input, Select, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageUploader } from "@/src/components/vendor/image-uploader";

interface VariantRow {
  label: string;
  price: string;
  stock: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const categories = trpc.catalog.categories.useQuery();
  const create = trpc.vendor.productCreate.useMutation({
    onSuccess: (r) => router.replace(`/vendor/products/${r.id}`),
    onError: (e) => setError(e.message),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([{ label: "", price: "", stock: "" }]);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const base = Number(basePrice);
    const mapped = variants
      .filter((v) => v.price && v.stock)
      .map((v) => {
        const attributes: Record<string, string> = v.label.trim() ? { الخيار: v.label.trim() } : {};
        return { attributes, price: Number(v.price), stock: Number(v.stock) };
      });
    if (mapped.length === 0) {
      setError("أضف خياراً واحداً على الأقل بسعر وكمية");
      return;
    }
    create.mutate({
      title,
      description: description || undefined,
      categoryId,
      basePrice: base || mapped[0]!.price,
      images,
      variants: mapped,
    });
  }

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold">منتج جديد</h1>

      <Card>
        <CardBody className="space-y-3">
          <Field label="اسم المنتج">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عباية كم واسع" />
          </Field>
          <Field label="الوصف">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="الفئة">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">اختر الفئة</option>
              {categories.data?.map((c) =>
                c.children.length > 0 ? (
                  <optgroup key={c.id} label={c.nameAr}>
                    {c.children.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.nameAr}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="السعر الأساسي (د.ع)">
            <Input inputMode="numeric" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="45000" />
          </Field>
          <Field label="الصور">
            <ImageUploader value={images} onChange={setImages} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">الخيارات (المقاسات/الألوان)</h2>
          {variants.map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="الخيار (مثل L)"
                value={v.label}
                onChange={(e) => setVariants((vs) => vs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
              />
              <Input
                inputMode="numeric"
                placeholder="السعر"
                value={v.price}
                onChange={(e) => setVariants((vs) => vs.map((x, idx) => (idx === i ? { ...x, price: e.target.value } : x)))}
              />
              <Input
                inputMode="numeric"
                placeholder="الكمية"
                value={v.stock}
                onChange={(e) => setVariants((vs) => vs.map((x, idx) => (idx === i ? { ...x, stock: e.target.value } : x)))}
              />
              {variants.length > 1 && (
                <button
                  type="button"
                  className="px-2 text-danger"
                  onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setVariants((vs) => [...vs, { label: "", price: "", stock: "" }])}
          >
            + خيار آخر
          </Button>
        </CardBody>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button className="w-full" size="lg" loading={create.isPending} disabled={!title || !categoryId} onClick={submit}>
        حفظ كمسودّة
      </Button>
      <p className="text-center text-xs text-neutral-500">
        يُحفظ كمسودّة، ثم أرسله للمراجعة من صفحة المنتج لينشر بعد موافقة الإدارة.
      </p>
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
