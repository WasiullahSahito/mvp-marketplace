// Next.js 16 calls what used to be "middleware" a "proxy". Same idea:
// it runs before the page. Here it (1) refreshes the login session and
// (2) blocks pages the user's role is not allowed to see.
// RLS in the database is the real lock; this is the friendly front door.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const NEEDS_LOGIN = ["/orders", "/checkout", "/seller", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (NEEDS_LOGIN.some((p) => path.startsWith(p))) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(path)}`;
      return NextResponse.redirect(url);
    }

    if (path.startsWith("/seller") || path.startsWith("/admin")) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = profile?.role;
      const allowed = path.startsWith("/admin") ? role === "admin" : role === "seller" || role === "admin";
      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
