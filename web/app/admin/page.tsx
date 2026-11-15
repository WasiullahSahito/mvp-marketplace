import { createClient } from "@/lib/supabase/server";
import { AdminActions } from "@/components/AdminActions";

const BADGE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  hidden: "bg-rose-100 text-rose-800",
};

// Admin only (the proxy redirects everyone else; RLS also blocks their updates).
export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: sellers }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, status").eq("role", "seller").order("created_at", { ascending: false }),
    supabase.from("products").select("id, title, status, seller_id").neq("status", "draft").order("created_at", { ascending: false }),
  ]);
  const sellerName = new Map((sellers ?? []).map((s) => [s.id, s.display_name]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      <section>
        <h1 className="text-xl font-bold">Sellers</h1>
        <ul className="mt-3 space-y-3">
          {(sellers ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <div>
                <span className="font-medium">{s.display_name}</span>{" "}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[s.status]}`}>{s.status}</span>
              </div>
              <AdminActions table="profiles" id={s.id} status={s.status} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold">Listings</h2>
        <ul className="mt-3 space-y-3">
          {(products ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.title}</div>
                <div className="text-sm text-stone-500">
                  by {sellerName.get(p.seller_id) ?? "unknown"}{" "}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[p.status]}`}>{p.status}</span>
                </div>
              </div>
              <AdminActions table="products" id={p.id} status={p.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
