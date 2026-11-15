import { notFound } from "next/navigation";
import type { Product } from "@marketplace/shared";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_SELECT, sortProduct } from "@/lib/products";
import { ProductView } from "@/components/ProductView";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS decides if this user may see the product (approved, or their own, or admin).
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  return <ProductView product={sortProduct(data as Product)} />;
}
