import Link from "next/link";
import { getUserAndRole } from "@/lib/supabase/server";
import { CartBadge, SignOutButton } from "./HeaderClient";

// Server component: knows who is logged in and shows links for their role.
export async function Header() {
  const { user, role, name } = await getUserAndRole();
  const link = "flex min-h-11 items-center px-3 text-sm font-medium hover:text-indigo-700";
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 px-2 py-1">
        <Link href="/" className="flex min-h-11 items-center px-2 text-lg font-bold text-indigo-700">
          Mini Marketplace
        </Link>
        <nav className="ml-auto flex flex-wrap items-center">
          {role === "seller" && (
            <>
              <Link href="/seller/products" className={link}>My products</Link>
              <Link href="/seller/orders" className={link}>Incoming orders</Link>
            </>
          )}
          {role === "admin" && <Link href="/admin" className={link}>Admin</Link>}
          {user && <Link href="/orders" className={link}>My orders</Link>}
          <CartBadge className={link} />
          {user ? (
            <SignOutButton className={link} label={`Sign out (${name || "me"})`} />
          ) : (
            <Link href="/login" className={link}>Log in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
