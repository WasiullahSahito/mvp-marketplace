"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product } from "@marketplace/shared";
import { createClient } from "@/lib/supabase/client";

type FormValue = { label: string; price_delta: string; hex: string };
type FormGroup = { name: string; type: "swatch" | "select" | "checkbox"; required: boolean; values: FormValue[] };
type FormImage = { url: string; alt: string }; // url "" = generated placeholder

const EMPTY_GROUP: FormGroup = { name: "", type: "select", required: true, values: [{ label: "", price_delta: "0", hex: "" }] };

// Create or edit a product, including its images and its variation options.
// Everything the buyer sees on the product page comes from what is entered here.
export function ProductForm({ initial, categories }: { initial?: Product; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState(String(initial?.base_price ?? ""));
  const [compareAt, setCompareAt] = useState(initial?.compare_at_price ? String(initial.compare_at_price) : "");
  const [images, setImages] = useState<FormImage[]>(
    initial?.product_images.map((i) => ({ url: i.url, alt: i.alt })) ?? [],
  );
  const [groups, setGroups] = useState<FormGroup[]>(
    initial?.option_groups.map((g) => ({
      name: g.name,
      type: g.type,
      required: g.required,
      values: g.option_values.map((v) => ({ label: v.label, price_delta: String(v.price_delta), hex: v.hex ?? "" })),
    })) ?? [],
  );

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");

  // ---- small state helpers
  const updateGroup = (gi: number, patch: Partial<FormGroup>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updateValue = (gi: number, vi: number, patch: Partial<FormValue>) =>
    setGroups((gs) =>
      gs.map((g, i) => (i === gi ? { ...g, values: g.values.map((v, j) => (j === vi ? { ...v, ...patch } : v)) } : g)),
    );

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Please log in again.");
    for (const file of Array.from(files)) {
      // Folder name = seller's user id (the storage policy checks this).
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) return setError(`Upload failed: ${error.message}`);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImages((imgs) => [...imgs, { url: data.publicUrl, alt: file.name }]);
    }
  }

  async function suggestWithAI() {
    const first = images.find((i) => i.url);
    setAiBusy(true);
    setAiNote("");
    setError("");
    try {
      const res = await fetch("/api/ai/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: first?.url ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI request failed");
      setTitle(json.title);
      setDescription(json.description);
      setAiNote(
        !json.mock
          ? "Suggested by AI from your photo. Please check it."
          : json.reason === "no_photo"
            ? "Demo suggestion: upload a photo first and the AI will describe it. Edit freely."
            : json.reason === "unavailable"
              ? "Demo suggestion: the AI service is unavailable right now (no credits or too busy). Edit freely."
              : "Demo suggestion (no AI key configured on the server). Edit freely.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function save(status: "draft" | "pending") {
    setError("");
    const base = Number(basePrice);
    if (!title.trim()) return setError("Please enter a title.");
    if (!(base >= 0) || basePrice === "") return setError("Base price must be a number.");
    if (compareAt !== "" && !(Number(compareAt) >= 0)) return setError("Compare-at price must be a number.");
    for (const g of groups) {
      if (!g.name.trim()) return setError("Every option group needs a name.");
      if (g.values.length === 0) return setError(`"${g.name}" needs at least one value.`);
      for (const v of g.values) {
        if (!v.label.trim()) return setError(`Every value in "${g.name}" needs a label.`);
        if (isNaN(Number(v.price_delta))) return setError(`"${v.label}": price must be a number.`);
        if (g.type === "swatch" && !/^#[0-9a-fA-F]{6}$/.test(v.hex)) return setError(`"${v.label}": colour must look like #A1B2C3.`);
      }
    }

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return setError("Please log in again.");
    }

    const row = {
      seller_id: user.id,
      category_id: categoryId || null,
      title: title.trim(),
      description,
      base_price: base,
      compare_at_price: compareAt === "" ? null : Number(compareAt),
      status,
    };

    let productId = initial?.id;
    if (productId) {
      const { error } = await supabase.from("products").update(row).eq("id", productId);
      if (error) return fail(error.message);
      // Simple approach for edits: remove the old images/options and write the new ones.
      await supabase.from("product_images").delete().eq("product_id", productId);
      await supabase.from("option_groups").delete().eq("product_id", productId);
    } else {
      const { data, error } = await supabase.from("products").insert(row).select("id").single();
      if (error) return fail(error.message);
      productId = data.id as string;
    }

    if (images.length) {
      const { error } = await supabase
        .from("product_images")
        .insert(images.map((img, position) => ({ product_id: productId, url: img.url, alt: img.alt, position })));
      if (error) return fail(error.message);
    }

    for (const [position, g] of groups.entries()) {
      const { data, error } = await supabase
        .from("option_groups")
        .insert({ product_id: productId, name: g.name.trim(), type: g.type, required: g.required, position })
        .select("id")
        .single();
      if (error) return fail(error.message);
      const { error: valuesError } = await supabase.from("option_values").insert(
        g.values.map((v, vp) => ({
          group_id: data.id,
          label: v.label.trim(),
          price_delta: Number(v.price_delta),
          hex: g.type === "swatch" ? v.hex : null,
          position: vp,
        })),
      );
      if (valuesError) return fail(valuesError.message);
    }

    router.push("/seller/products");
    router.refresh();

    function fail(message: string) {
      setBusy(false);
      setError(message);
    }
  }

  const field = "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3";
  const small = "min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-32 pt-6">
      <h1 className="text-xl font-bold">{initial ? "Edit product" : "Add product"}</h1>

      {/* Photos + AI */}
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Photos</h2>
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative h-20 w-24 overflow-hidden rounded-lg border border-stone-300 bg-stone-100 text-xs">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center p-1 text-center text-stone-500">Placeholder</span>
              )}
              <button type="button" aria-label="Remove image" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute right-0 top-0 h-7 w-7 bg-black/60 text-white">×</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`${small} flex cursor-pointer items-center`}>
            Upload photos
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => uploadPhotos(e.target.files)} />
          </label>
          <button type="button" className={small} onClick={() => setImages([...images, { url: "", alt: `Image ${images.length + 1}` }])}>
            Add placeholder image
          </button>
          <button type="button" onClick={suggestWithAI} disabled={aiBusy} className={`${small} border-indigo-600 text-indigo-700 disabled:opacity-60`}>
            {aiBusy ? "Thinking…" : "✨ Generate title & description from photo"}
          </button>
        </div>
        {aiNote && <p className="text-sm text-indigo-700">{aiNote}</p>}
      </section>

      {/* Basics */}
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea className={`${field} py-2`} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Base price (£)</span>
            <input className={field} inputMode="decimal" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Compare-at price (£)</span>
            <input className={field} inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Category</span>
          <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </section>

      {/* Variation builder */}
      <section className="space-y-4">
        <h2 className="font-semibold">Options (variations)</h2>
        <p className="text-sm text-stone-600">
          Each group is one choice for the buyer (Colour, Size…). Price change is added to the base price. Put the colour group first.
        </p>
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-2">
              <input className={`${field} col-span-2`} placeholder="Group name (e.g. Storage)" value={g.name} onChange={(e) => updateGroup(gi, { name: e.target.value })} />
              <select className={field} value={g.type} onChange={(e) => updateGroup(gi, { type: e.target.value as FormGroup["type"] })}>
                <option value="select">Select (buttons)</option>
                <option value="swatch">Colour swatch</option>
                <option value="checkbox">Checkbox (optional extra)</option>
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={g.required} onChange={(e) => updateGroup(gi, { required: e.target.checked })} />
                Buyer must choose
              </label>
            </div>
            {g.values.map((v, vi) => (
              <div key={vi} className="flex flex-wrap items-center gap-2">
                <input className={`${small} min-w-0 flex-1 basis-40`} placeholder="Label" value={v.label} onChange={(e) => updateValue(gi, vi, { label: e.target.value })} />
                <input className={`${small} w-24`} inputMode="decimal" placeholder="+ £" aria-label="Price change" value={v.price_delta} onChange={(e) => updateValue(gi, vi, { price_delta: e.target.value })} />
                {g.type === "swatch" && (
                  <input className={`${small} w-28`} placeholder="#RRGGBB" aria-label="Colour hex" value={v.hex} onChange={(e) => updateValue(gi, vi, { hex: e.target.value })} />
                )}
                <button type="button" aria-label="Remove value" className="h-11 w-11 rounded-lg border border-stone-300 text-rose-700" onClick={() => updateGroup(gi, { values: g.values.filter((_, j) => j !== vi) })}>×</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" className={small} onClick={() => updateGroup(gi, { values: [...g.values, { label: "", price_delta: "0", hex: "" }] })}>+ Add value</button>
              <button type="button" className={`${small} text-rose-700`} onClick={() => setGroups(groups.filter((_, i) => i !== gi))}>Remove group</button>
            </div>
          </div>
        ))}
        <button type="button" className={small} onClick={() => setGroups([...groups, { ...EMPTY_GROUP, values: [{ label: "", price_delta: "0", hex: "" }] }])}>
          + Add option group
        </button>
      </section>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3">
          <button disabled={busy} onClick={() => save("draft")} className="min-h-12 flex-1 rounded-lg border border-stone-300 bg-white font-semibold disabled:opacity-60">
            Save draft
          </button>
          <button disabled={busy} onClick={() => save("pending")} className="min-h-12 flex-1 rounded-lg bg-indigo-700 font-semibold text-white disabled:opacity-60">
            {busy ? "Saving…" : "Submit for approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
