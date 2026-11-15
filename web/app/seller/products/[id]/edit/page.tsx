import { notFound } from "next/navigation";
import type { Product } from "@marketplace/shared";
import { getUserAndRole } from "@/lib/supabase/server";
import { PRODUCT_SELECT, sortProduct } from "@/lib/products";
import { ProductForm } from "@/components/ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUserAndRole();
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).eq("seller_id", user!.id).maybeSingle();
  if (!data) notFound();
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");
  return <ProductForm initial={sortProduct(data as Product)} categories={categories ?? []} />;
}
