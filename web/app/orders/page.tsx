import { createClient } from "@/lib/supabase/server";
import { OrderItems, OrderStatus, type OrderItemRow } from "@/components/OrderStatus";

type Order = { id: string; status: string; total: number; created_at: string; order_items: OrderItemRow[] };

// Buyer's order list. RLS only returns this buyer's own orders.
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ placed?: string }> }) {
  const { placed } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, status, total, created_at, order_items(*)")
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {placed && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">
          Order placed. The total below was calculated by the server.
        </p>
      )}
      <h1 className="text-xl font-bold">My orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 text-stone-600">No orders yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-sm text-stone-500">
                  #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("en-GB")}
                </span>
                <span className="font-bold">£{Number(o.total).toFixed(2)}</span>
              </div>
              <div className="my-3"><OrderStatus status={o.status} /></div>
              <OrderItems items={o.order_items} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
