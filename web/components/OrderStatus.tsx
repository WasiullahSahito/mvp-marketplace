const STEPS = ["new", "confirmed", "shipped", "delivered"] as const;

// Four-step progress bar for an order.
export function OrderStatus({ status }: { status: string }) {
  const current = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="flex gap-1" aria-label={`Order status: ${status}`}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={`h-2 rounded-full ${i <= current ? "bg-indigo-700" : "bg-stone-200"}`} />
          <div className={`mt-1 text-center text-xs capitalize ${i === current ? "font-bold text-indigo-700" : "text-stone-500"}`}>{s}</div>
        </li>
      ))}
    </ol>
  );
}

export type OrderItemRow = {
  id: string;
  title: string;
  options: { group: string; label: string; price_delta: number }[];
  unit_price: number;
  quantity: number;
};

export function OrderItems({ items }: { items: OrderItemRow[] }) {
  return (
    <ul className="divide-y divide-stone-100">
      {items.map((i) => (
        <li key={i.id} className="py-3">
          <div className="flex justify-between gap-3">
            <span className="font-medium">{i.title}</span>
            <span className="shrink-0">
              {i.quantity} × £{Number(i.unit_price).toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-sm text-stone-600">{i.options.map((o) => `${o.group}: ${o.label}`).join(" · ")}</div>
        </li>
      ))}
    </ul>
  );
}
