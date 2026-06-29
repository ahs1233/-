import { notFound } from "next/navigation";
import { getServerApi } from "@/src/trpc/server";
import { ProductDetail } from "@/src/components/product/product-detail";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const api = await getServerApi();
  const product = await api.catalog.productBySlug({ slug: params.slug });
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
