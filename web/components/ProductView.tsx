"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculatePrice,
  cartLineKey,
  discountPercent,
  formatPrice,
  type OptionGroup,
  type OptionValue,
  type Product,
} from "@marketplace/shared";
import { useCart } from "@/lib/cart";
import { Gallery } from "./Gallery";

// All options come from the database (product.option_groups). Nothing about
// colours, sizes, storage etc. is written in this file.
export function ProductView({ product }: { product: Product }) {
  const { addLine } = useCart();
  const groups = product.option_groups;

  // selected[groupId] = chosen option value id (or null = nothing chosen).
  // Required groups start on their first value; optional ones (assembly) start unchecked.
  const [selected, setSelected] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.required ? (g.option_values[0]?.id ?? null) : null])),
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const chosen: { group: OptionGroup; value: OptionValue }[] = groups.flatMap((g) => {
    const value = g.option_values.find((v) => v.id === selected[g.id]);
    return value ? [{ group: g, value }] : [];
  });

  const colourGroup = groups.find((g) => g.type === "swatch");
  const colour = chosen.find((c) => c.group.id === colourGroup?.id)?.value;
  const tint = colour?.hex ?? "#d6d0c4";

  // The live price: same pure function the unit tests cover.
  const price = useMemo(
    () => calculatePrice(product.base_price, chosen.map((c) => ({ priceDelta: c.value.price_delta }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.base_price, selected],
  );
  const percentOff = discountPercent(calculatePrice(product.base_price, []), product.compare_at_price);

  const baseTitle = product.title.split(" – ")[0];
  const title = colour ? `${baseTitle} – ${colour.label}` : product.title;

  function choose(group: OptionGroup, value: OptionValue) {
    setSelected((s) => ({ ...s, [group.id]: value.id }));
    setAdded(false);
  }

  function addToBasket() {
    const valueIds = chosen.map((c) => c.value.id);
    addLine({
      key: cartLineKey(product.id, valueIds),
      productId: product.id,
      title,
      valueIds,
      options: chosen.map((c) => ({ group: c.group.name, label: c.value.label })),
      unitPrice: price,
      quantity: 1,
      colourHex: colour?.hex ?? null,
    });
    setAdded(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="md:sticky md:top-4 md:self-start">
          <Gallery images={product.product_images} tint={tint} title={title} index={imageIndex} onIndexChange={setImageIndex} />
        </div>

        <div>
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold text-indigo-700" data-testid="price">
              {formatPrice(price)}
            </span>
            {product.compare_at_price && percentOff > 0 && (
              <>
                <span className="text-lg text-stone-500 line-through">{formatPrice(product.compare_at_price)}</span>
                <span className="rounded bg-rose-100 px-2 py-1 text-sm font-semibold text-rose-700">{percentOff}% OFF</span>
              </>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500">Sold by Demo Seller · price updates as you choose</p>

          <div className="mt-5 space-y-6">
            {groups.map((g) => (
              <OptionPicker key={g.id} group={g} selectedId={selected[g.id]} onChoose={(v) => choose(g, v)} onClear={() => setSelected((s) => ({ ...s, [g.id]: null }))} />
            ))}
          </div>

          <p className="mt-6 whitespace-pre-line text-stone-700">{product.description}</p>
        </div>
      </div>

      {/* Sticky bottom bar: always visible with the live price */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-stone-500">Total</div>
            <div className="text-xl font-bold">{formatPrice(price)}</div>
          </div>
          {added && (
            <Link href="/cart" className="ml-auto text-sm font-medium text-indigo-700 underline">
              Added · view basket
            </Link>
          )}
          <button
            type="button"
            onClick={addToBasket}
            className={`${added ? "" : "ml-auto"} min-h-12 rounded-lg bg-indigo-700 px-6 font-semibold text-white active:bg-indigo-800`}
          >
            Add to Basket
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionPicker({
  group,
  selectedId,
  onChoose,
  onClear,
}: {
  group: OptionGroup;
  selectedId: string | null;
  onChoose: (v: OptionValue) => void;
  onClear: () => void;
}) {
  const selectedValue = group.option_values.find((v) => v.id === selectedId);

  // Checkbox (e.g. Professional Assembly): one value, tick to add.
  if (group.type === "checkbox") {
    const value = group.option_values[0];
    if (!value) return null;
    return (
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-stone-300 bg-white p-3">
        <input
          type="checkbox"
          className="h-6 w-6 accent-indigo-700"
          checked={selectedId === value.id}
          onChange={(e) => (e.target.checked ? onChoose(value) : onClear())}
        />
        <span className="flex-1 font-medium">{group.name === value.label ? value.label : `${group.name}: ${value.label}`}</span>
        <span className="font-semibold">+{formatPrice(value.price_delta)}</span>
      </label>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 font-semibold">
        {group.name}: <span className="font-normal text-stone-600">{selectedValue?.label}</span>
      </legend>

      {group.type === "swatch" ? (
        <div className="flex flex-wrap gap-3">
          {group.option_values.map((v) => {
            const on = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                title={v.label}
                aria-label={v.label}
                aria-pressed={on}
                onClick={() => onChoose(v)}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                  on ? "border-indigo-700 ring-2 ring-indigo-300" : "border-stone-300"
                }`}
              >
                <span className="h-9 w-9 rounded-full border border-black/10" style={{ backgroundColor: v.hex ?? "#ccc" }} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {group.option_values.map((v) => {
            const on = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChoose(v)}
                className={`flex min-h-12 items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm ${
                  on ? "border-indigo-700 bg-indigo-50" : "border-stone-300 bg-white"
                }`}
              >
                <span>{v.label}</span>
                <span className="shrink-0 font-semibold">{v.price_delta > 0 ? `+${formatPrice(v.price_delta)}` : "Free"}</span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
