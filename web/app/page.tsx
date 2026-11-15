import Link from "next/link";
import { discountPercent, formatPrice, type Product } from "@marketplace/shared";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_SELECT, sortProduct } from "@/lib/products";
import { PlaceholderImage } from "@/components/PlaceholderImage";

type Search = { q?: string; min?: string; max?: string; colour?: string; size?: string; category?: string };

// Collect the distinct labels of one option group (e.g. "Colour") across products.
function labelsOf(products: Product[], groupName: string) {
  const labels = products.flatMap((p) =>
    p.option_groups.filter((g) => g.name === groupName).flatMap((g) => g.option_values.map((v) => v.label)),
  );
  return [...new Set(labels)];
}

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data }, { data: categories }] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("status", "approved").order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
  ]);
  const all = ((data ?? []) as Product[]).map(sortProduct);

  // Filters run here in the server component. Fine for a small catalogue.
  const q = sp.q?.trim().toLowerCase();
  const min = sp.min ? Number(sp.min) : null;
  const max = sp.max ? Number(sp.max) : null;
  const products = all.filter((p) => {
    if (q && !`${p.title} ${p.description}`.toLowerCase().includes(q)) return false;
    if (min !== null && p.base_price < min) return false;
    if (max !== null && p.base_price > max) return false;
    if (sp.category && p.category_id !== sp.category) return false;
    const has = (group: string, label?: string) =>
      !label || p.option_groups.some((g) => g.name === group && g.option_values.some((v) => v.label === label));
    return has("Colour", sp.colour) && has("Size", sp.size);
  });

  const field = "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <form className="grid grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-6" action="/">
        <input name="q" defaultValue={sp.q} placeholder="Search beds…" aria-label="Search" className={`${field} col-span-2 md:col-span-2`} />
        <input name="min" type="number" min="0" defaultValue={sp.min} placeholder="Min £" aria-label="Minimum price" className={field} />
        <input name="max" type="number" min="0" defaultValue={sp.max} placeholder="Max £" aria-label="Maximum price" className={field} />
        <select name="colour" defaultValue={sp.colour ?? ""} aria-label="Colour" className={field}>
          <option value="">Any colour</option>
          {labelsOf(all, "Colour").map((l) => <option key={l}>{l}</option>)}
        </select>
        <select name="size" defaultValue={sp.size ?? ""} aria-label="Size" className={field}>
          <option value="">Any size</option>
          {labelsOf(all, "Size").map((l) => <option key={l}>{l}</option>)}
        </select>
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className={`${field} col-span-2 md:col-span-2`}>
          <option value="">All categories</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="min-h-11 rounded-lg bg-indigo-700 px-4 font-semibold text-white">Search</button>
        <Link href="/" className="flex min-h-11 items-center justify-center rounded-lg border border-stone-300 px-4">Clear</Link>
      </form>

      <h1 className="mt-6 text-xl font-bold">{products.length} product{products.length === 1 ? "" : "s"}</h1>

      {products.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-600">
          Nothing matches those filters. Try clearing them.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const image = p.product_images[0];
            const firstColour = p.option_groups.find((g) => g.type === "swatch")?.option_values[0]?.hex ?? "#d6d0c4";
            const off = discountPercent(p.base_price, p.compare_at_price);
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="block overflow-hidden rounded-xl border border-stone-200 bg-white hover:shadow-md">
                  <div className="aspect-[4/3] bg-stone-200">
                    {image?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt={image.alt || p.title} className="h-full w-full object-cover" />
                    ) : (
                      <PlaceholderImage hex={firstColour} title={p.title.split(" – ")[0]} className="h-full w-full" />
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-semibold">{p.title}</h2>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-stone-500">From</span>
                      <span className="text-lg font-bold text-indigo-700">{formatPrice(p.base_price)}</span>
                      {p.compare_at_price && off > 0 && (
                        <>
                          <span className="text-sm text-stone-500 line-through">{formatPrice(p.compare_at_price)}</span>
                          <span className="rounded bg-rose-100 px-1.5 text-xs font-semibold text-rose-700">{off}% OFF</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
