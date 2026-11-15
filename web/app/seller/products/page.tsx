import Link from "next/link";
import { getUserAndRole } from "@/lib/supabase/server";

const BADGE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  hidden: "bg-rose-100 text-rose-800",
};

export default async function SellerProductsPage() {
  const { supabase, user } = await getUserAndRole();
  const { data: products } = await supabase
    .from("products")
    .select("id, title, base_price, status")
    .eq("seller_id", user!.id)
    .order("created_at", { ascending: false });
  const { data: me } = await supabase.from("profiles").select("status").eq("id", user!.id).single();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">My products</h1>
        <Link href="/seller/products/new" className="flex min-h-11 items-center rounded-lg bg-indigo-700 px-4 font-semibold text-white">
          + Add product
        </Link>
      </div>

      {me?.status !== "approved" && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Your seller account is {me?.status}. Products go live only after an admin approves you and the product.
        </p>
      )}

      {!products?.length ? (
        <p className="mt-6 text-stone-600">You have not added any products yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/seller/products/${p.id}/edit`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
                <span className="min-w-0 truncate font-medium">{p.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span>£{Number(p.base_price).toFixed(2)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[p.status]}`}>{p.status}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
