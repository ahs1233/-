"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Input, Select, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageUploader } from "@/src/components/vendor/image-uploader";

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const product = trpc.vendor.productById.useQuery({ id: params.id }, { retry: false });
  const categories = trpc.catalog.categories.useQuery();
  const utils = trpc.useUtils();

  const update = trpc.vendor.productUpdate.useMutation({ onSuccess: refresh });
  const submit = trpc.vendor.productSubmit.useMutation({ onSuccess: refresh });
  const archive = trpc.vendor.productArchive.useMutation({ onSuccess: () => router.replace("/vendor/products") });
  const variantUpdate = trpc.vendor.variantUpdate.useMutation({ onSuccess: refresh });

  function refresh() {
    utils.vendor.productById.invalidate({ id: params.id });
    utils.vendor.products.invalidate();
  }

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (product.data) {
      setTitle(product.data.title);
      setDescription(product.data.description ?? "");
      setCategoryId(product.data.categoryId);
      setBasePrice(String(product.data.basePrice));
      setImages(product.data.images);
    }
  }, [product.data]);

  if (product.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (product.isError || !product.data) return <p className="text-neutral-500">المنتج غير موجود.</p>;

  const p = product.data;
  const canSubmit = ["DRAFT", "REJECTED"].includes(p.status);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">تعديل المنتج</h1>
        <span className="text-sm text-neutral-500">{p.status}</span>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم المنتج" />
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="الوصف" />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
          <Input inputMode="numeric" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="السعر الأساسي" />
          <ImageUploader value={images} onChange={setImages} />
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate({ id: p.id, title, description: description || undefined, categoryId, basePrice: Number(basePrice), images })
            }
          >
            حفظ التعديلات
          </Button>
        </CardBody>
      </Card>

      {/* المخزون والخيارات */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">الخيارات والمخزون</h2>
          {p.variants.map((v) => (
            <VariantRow
              key={v.id}
              variant={v}
              onSave={(price, stock, isActive) => variantUpdate.mutate({ variantId: v.id, price, stock, isActive })}
              saving={variantUpdate.isPending}
            />
          ))}
        </CardBody>
      </Card>

      <div className="flex gap-2">
        {canSubmit && (
          <Button className="flex-1" loading={submit.isPending} onClick={() => submit.mutate({ id: p.id })}>
            إرسال للمراجعة
          </Button>
        )}
        <Button variant="outline" className="flex-1" loading={archive.isPending} onClick={() => archive.mutate({ id: p.id })}>
          أرشفة
        </Button>
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  onSave,
  saving,
}: {
  variant: { id: string; attributes: unknown; price: number; stock: number; isActive: boolean };
  onSave: (price: number, stock: number, isActive: boolean) => void;
  saving: boolean;
}) {
  const [price, setPrice] = useState(String(variant.price));
  const [stock, setStock] = useState(String(variant.stock));
  const label =
    variant.attributes && typeof variant.attributes === "object"
      ? Object.values(variant.attributes as Record<string, string>).join("، ") || "افتراضي"
      : "افتراضي";

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 truncate text-sm">{label}</span>
      <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر" />
      <Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="الكمية" />
      <Button size="sm" loading={saving} onClick={() => onSave(Number(price), Number(stock), variant.isActive)}>
        حفظ
      </Button>
    </div>
  );
}
