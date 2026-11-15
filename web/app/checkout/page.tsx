"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPrice } from "@marketplace/shared";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";

// Fake checkout: no payment. The important part is the place_order RPC:
// we send ONLY product ids, option value ids and quantities. The database works out the prices.
export default function CheckoutPage() {
  const router = useRouter();
  const { lines, total, clear } = useCart();
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc("place_order", {
      p_items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, value_ids: l.valueIds })),
      p_shipping: form,
    });
    setBusy(false);
    if (error) return setError(error.message);
    clear();
    router.push(`/orders?placed=${data}`);
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p>Your basket is empty.</p>
        <Link href="/" className="mt-4 inline-block text-indigo-700 underline">Browse beds</Link>
      </div>
    );
  }

  const field = "min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3";

  return (
    <form onSubmit={placeOrder} className="mx-auto max-w-md space-y-4 px-4 pb-32 pt-6">
      <h1 className="text-xl font-bold">Checkout</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Demo only: no payment is taken.</p>
      <input className={field} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" />
      <textarea className={`${field} py-3`} rows={3} placeholder="Delivery address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required autoComplete="street-address" />
      <input className={field} type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required autoComplete="tel" />

      <ul className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-2 py-1">
            <span>{l.quantity} × {l.title}</span>
            <span>{formatPrice(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
      </ul>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <div>
            <div className="text-xs text-stone-500">Total</div>
            <div className="text-xl font-bold">{formatPrice(total)}</div>
          </div>
          <button disabled={busy} className="ml-auto min-h-12 rounded-lg bg-indigo-700 px-6 font-semibold text-white disabled:opacity-60">
            {busy ? "Placing…" : "Place order"}
          </button>
        </div>
      </div>
    </form>
  );
}
