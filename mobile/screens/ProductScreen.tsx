// Product page. All options come from the database (product.option_groups);
// nothing about colours, sizes or storage is written in this file.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import {
  calculatePrice,
  cartLineKey,
  discountPercent,
  formatPrice,
  type OptionGroup,
  type OptionValue,
  type Product,
} from '@marketplace/shared';
import { Gallery } from '../components/Gallery';
import { OptionPicker } from '../components/OptionPicker';
import { useCart } from '../lib/cart';
import { PRODUCT_SELECT, sortProduct } from '../lib/products';
import { supabase } from '../lib/supabase';
import { colors, s } from '../lib/theme';

export function ProductScreen({ id, onViewBasket }: { id: string; onViewBasket: () => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (!data) setError('Product not found.');
        else setProduct(sortProduct(data as Product));
      });
  }, [id]);

  if (error) return <Text style={[s.error, { margin: 16 }]}>{error}</Text>;
  if (!product) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  return <ProductView product={product} onViewBasket={onViewBasket} />;
}

function ProductView({ product, onViewBasket }: { product: Product; onViewBasket: () => void }) {
  const { addLine } = useCart();
  const groups = product.option_groups;

  // selected[groupId] = chosen option value id (or null). Required groups start on their first value;
  // optional ones (assembly) start unchecked.
  const [selected, setSelected] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.required ? (g.option_values[0]?.id ?? null) : null])),
  );
  const [added, setAdded] = useState(false);

  const chosen: { group: OptionGroup; value: OptionValue }[] = groups.flatMap((g) => {
    const value = g.option_values.find((v) => v.id === selected[g.id]);
    return value ? [{ group: g, value }] : [];
  });

  const colourGroup = groups.find((g) => g.type === 'swatch');
  const colour = chosen.find((c) => c.group.id === colourGroup?.id)?.value;
  const tint = colour?.hex ?? '#d6d0c4';

  // The live price: the SAME pure function the web app and the unit tests use.
  const price = useMemo(
    () => calculatePrice(product.base_price, chosen.map((c) => ({ priceDelta: c.value.price_delta }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.base_price, selected],
  );
  const percentOff = discountPercent(calculatePrice(product.base_price, []), product.compare_at_price);
  const baseTitle = product.title.split(' – ')[0];
  const title = colour ? `${baseTitle} – ${colour.label}` : product.title;

  function choose(group: OptionGroup, value: OptionValue) {
    setSelected((cur) => ({ ...cur, [group.id]: value.id }));
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
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Gallery images={product.product_images} tint={tint} />
        <View style={[s.pad, { gap: 20 }]}>
          <View>
            <Text style={s.h1}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }} testID="price">{formatPrice(price)}</Text>
              {product.compare_at_price && percentOff > 0 ? (
                <>
                  <Text style={{ fontSize: 16, color: colors.muted, textDecorationLine: 'line-through' }}>{formatPrice(product.compare_at_price)}</Text>
                  <Text style={{ backgroundColor: '#ffe4e6', color: colors.danger, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>{percentOff}% OFF</Text>
                </>
              ) : null}
            </View>
            <Text style={[s.muted, { marginTop: 4 }]}>Sold by Demo Seller · price updates as you choose</Text>
          </View>

          {groups.map((g) => (
            <OptionPicker
              key={g.id}
              group={g}
              selectedId={selected[g.id]}
              onChoose={(v) => choose(g, v)}
              onClear={() => setSelected((cur) => ({ ...cur, [g.id]: null }))}
            />
          ))}

          <Text style={{ color: '#44403c', lineHeight: 22 }}>{product.description}</Text>
        </View>
      </ScrollView>

      {/* Sticky bottom bar: always visible with the live price */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e7e5e4' }}>
        <View>
          <Text style={{ fontSize: 12, color: colors.muted }}>Total</Text>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>{formatPrice(price)}</Text>
        </View>
        {added && (
          <Pressable onPress={onViewBasket} style={{ minHeight: 48, justifyContent: 'center', flex: 1 }}>
            <Text style={{ color: colors.primary, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'right' }}>Added · view basket</Text>
          </Pressable>
        )}
        <Pressable style={[s.button, added ? null : { marginLeft: 'auto' }]} onPress={addToBasket}>
          <Text style={s.buttonText}>Add to Basket</Text>
        </Pressable>
      </View>
    </View>
  );
}
