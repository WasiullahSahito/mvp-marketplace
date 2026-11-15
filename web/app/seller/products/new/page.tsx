import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/ProductForm";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");
  return <ProductForm categories={categories ?? []} />;
}
