"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STEPS = ["new", "confirmed", "shipped", "delivered"];

// Moves an order one step forward: New → Confirmed → Shipped → Delivered.
// The set_order_status function in the database checks who you are and the order of steps.
export function NextStatusButton({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = STEPS[STEPS.indexOf(status) + 1];
  if (!next) return <p className="mt-3 text-sm text-emerald-700">Delivered. Nothing more to do.</p>;

  async function advance() {
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("set_order_status", { p_order: orderId, p_status: next });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button onClick={advance} disabled={busy} className="min-h-12 rounded-lg bg-indigo-700 px-5 font-semibold capitalize text-white disabled:opacity-60">
        {busy ? "Saving…" : `Mark as ${next}`}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
