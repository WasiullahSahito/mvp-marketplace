import { createClient } from "@/lib/supabase/server";
import { OrderItems, OrderStatus, type OrderItemRow } from "@/components/OrderStatus";
import { NextStatusButton } from "@/components/NextStatusButton";

type Order = {
  id: string;
  status: string;
  created_at: string;
  shipping: { name?: string; address?: string; phone?: string };
  order_items: (OrderItemRow & { unit_price: number })[];
};

// Orders containing this seller's items (RLS filters them; order_items shows only their own lines).
export default async function SellerOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, status, created_at, shipping, order_items(*)")
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold">Incoming orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 text-stone-600">No orders yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {orders.map((o) => {
            const sellerTotal = o.order_items.reduce((sum, i) => sum + Math.round(i.unit_price * 100) * i.quantity, 0) / 100;
            return (
              <li key={o.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-sm text-stone-500">
                    #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("en-GB")}
                  </span>
                  <span className="font-bold">£{sellerTotal.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  {o.shipping.name} · {o.shipping.phone} · {o.shipping.address}
                </p>
                <div className="my-3"><OrderStatus status={o.status} /></div>
                <OrderItems items={o.order_items} />
                <NextStatusButton orderId={o.id} status={o.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
