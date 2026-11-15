import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for server components and route handlers.
// It reads the logged-in user's session from cookies, so RLS applies as that user.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component (cookies are read-only there). The proxy refreshes sessions, so this is fine.
          }
        },
      },
    },
  );
}

// The current user and their role (or nulls when logged out).
export async function getUserAndRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as string | null, name: "" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  return { supabase, user, role: (profile?.role ?? "buyer") as string, name: profile?.display_name ?? "" };
}
