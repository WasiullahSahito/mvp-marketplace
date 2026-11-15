"use client";
import Link from "next/link";
import { formatPrice } from "@marketplace/shared";
import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { lines, total, setQuantity, removeLine } = useCart();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Your basket is empty</h1>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-indigo-700 px-6 font-semibold text-white">
          Browse beds
        </Link>
      </div>
    );
  }

  const stepper = "flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-xl";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <h1 className="text-xl font-bold">Your basket</h1>
      <ul className="mt-4 space-y-4">
        {lines.map((l) => (
          <li key={l.key} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-8 w-8 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: l.colourHex ?? "#ccc" }} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{l.title}</div>
                <ul className="mt-1 text-sm text-stone-600">
                  {l.options.map((o) => (
                    <li key={o.group}>
                      <span className="text-stone-500">{o.group}:</span> {o.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="font-bold">{formatPrice(l.unitPrice)}</div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button className={stepper} onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label="Decrease quantity">−</button>
              <span className="w-8 text-center font-semibold">{l.quantity}</span>
              <button className={stepper} onClick={() => setQuantity(l.key, l.quantity + 1)} aria-label="Increase quantity">+</button>
              <button className="ml-auto min-h-11 px-3 text-sm text-rose-700 underline" onClick={() => removeLine(l.key)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div>
            <div className="text-xs text-stone-500">Total (confirmed at checkout)</div>
            <div className="text-xl font-bold">{formatPrice(total)}</div>
          </div>
          <Link href="/checkout" className="ml-auto flex min-h-12 items-center rounded-lg bg-indigo-700 px-6 font-semibold text-white">
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
