// Shapes of the data we read from Supabase. Shared by web and mobile.

export type OptionValue = {
  id: string;
  label: string;
  price_delta: number;
  hex: string | null;
  position: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  type: 'swatch' | 'select' | 'checkbox';
  position: number;
  required: boolean;
  option_values: OptionValue[];
};

export type ProductImage = { id: string; url: string; alt: string; position: number };

export type Product = {
  id: string;
  title: string;
  description: string;
  base_price: number;
  compare_at_price: number | null;
  status: string;
  category_id: string | null;
  seller_id: string;
  product_images: ProductImage[];
  option_groups: OptionGroup[];
};

// One line in the cart (kept on the device, not in the database).
export type CartLine = {
  key: string; // cartLineKey(productId, valueIds)
  productId: string;
  title: string;
  valueIds: string[];
  options: { group: string; label: string }[]; // for display
  unitPrice: number; // preview only; place_order recomputes it
  quantity: number;
  colourHex: string | null;
};

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered';
