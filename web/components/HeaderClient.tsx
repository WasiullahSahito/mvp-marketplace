"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";

export function CartBadge({ className }: { className: string }) {
  const { count } = useCart();
  return (
    <Link href="/cart" className={className}>
      Basket{count > 0 && <span className="ml-1 rounded-full bg-indigo-700 px-2 text-xs text-white">{count}</span>}
    </Link>
  );
}

export function SignOutButton({ className, label }: { className: string; label: string }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} className={className}>
      {label}
    </button>
  );
}
