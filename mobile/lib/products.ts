import type { Product } from '@marketplace/shared';

// One query gets a product with its images and option groups/values.
export const PRODUCT_SELECT = '*, product_images(*), option_groups(*, option_values(*))';

// PostgREST does not sort nested rows, so sort by `position` here.
export function sortProduct(p: Product): Product {
  const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
  return {
    ...p,
    product_images: [...p.product_images].sort(byPosition),
    option_groups: [...p.option_groups]
      .sort(byPosition)
      .map((g) => ({ ...g, option_values: [...g.option_values].sort(byPosition) })),
  };
}
