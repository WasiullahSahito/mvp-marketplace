"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { role, display_name: name } } });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(role === "seller" && mode === "signup" ? "/seller/products" : next);
    router.refresh();
  }

  const field = "min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3";

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-sm space-y-4 px-4">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h1>

      {mode === "signup" && (
        <>
          <input className={field} placeholder="Your name or shop name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
            {(["buyer", "seller"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={`min-h-12 rounded-lg border-2 capitalize ${role === r ? "border-indigo-700 bg-indigo-50" : "border-stone-300 bg-white"}`}
              >
                {r}
              </button>
            ))}
          </div>
          {role === "seller" && <p className="text-sm text-stone-600">Seller accounts are approved by an admin before products go live.</p>}
        </>
      )}

      <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className={field} type="password" placeholder="Password (min 6)" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} />

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <button disabled={busy} className="min-h-12 w-full rounded-lg bg-indigo-700 font-semibold text-white disabled:opacity-60">
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
      </button>

      <p className="text-center text-sm">
        {mode === "login" ? (
          <>No account? <Link className="text-indigo-700 underline" href="/signup">Sign up</Link></>
        ) : (
          <>Have an account? <Link className="text-indigo-700 underline" href="/login">Log in</Link></>
        )}
      </p>
    </form>
  );
}
