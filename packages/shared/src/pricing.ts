// The ONE place where the price of a configured product is calculated.
// Web and mobile both import this. The database (place_order) repeats the same
// rule on the server, and the server's answer is the one that counts.
//
// Rule: price = base price + the price delta of every option the buyer picked.
// We add in pence (whole numbers) so that 0.1 + 0.2 style rounding errors can't happen.

export type PricedChoice = { priceDelta: number };

const toPence = (pounds: number) => Math.round(pounds * 100);

export function calculatePrice(basePrice: number, choices: PricedChoice[]): number {
  const pence = choices.reduce((sum, c) => sum + toPence(c.priceDelta), toPence(basePrice));
  return pence / 100;
}

// "50% OFF": computed from the two prices, never typed in by hand.
export function discountPercent(price: number, compareAtPrice: number | null | undefined): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function formatPrice(pounds: number): string {
  return `£${pounds.toFixed(2)}`;
}

// Cart rule: same product + same set of option values = same line (quantity goes up).
// Any difference in options = a separate line.
export function cartLineKey(productId: string, valueIds: string[]): string {
  return `${productId}:${[...valueIds].sort().join(',')}`;
}
