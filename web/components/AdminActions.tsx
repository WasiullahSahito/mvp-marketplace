"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Approve / hide buttons for a seller (profiles) or a listing (products).
// RLS only lets admins make these updates, even if someone calls the API directly.
export function AdminActions({ table, id, status }: { table: "profiles" | "products"; id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function set(next: string) {
    setBusy(true);
    setError("");
    const { error } = await createClient().from(table).update({ status: next }).eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  const btn = "min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-60";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <button disabled={busy} onClick={() => set("approved")} className={`${btn} bg-emerald-700 text-white`}>Approve</button>
      )}
      {status !== "hidden" && (
        <button disabled={busy} onClick={() => set("hidden")} className={`${btn} border border-rose-300 bg-white text-rose-700`}>Hide</button>
      )}
      {error && <span role="alert" className="text-sm text-rose-700">{error}</span>}
    </div>
  );
}
