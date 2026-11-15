// Product list with search. Tapping a card opens the product page.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { calculatePrice, formatPrice, type Product } from '@marketplace/shared';
import { Placeholder } from '../components/Placeholder';
import { PRODUCT_SELECT, sortProduct } from '../lib/products';
import { supabase } from '../lib/supabase';
import { colors, s } from '../lib/theme';

// Price on the card = base price + the first value of each required group (the page's default choice).
function startingPrice(p: Product) {
  const defaults = p.option_groups.filter((g) => g.required && g.option_values[0]).map((g) => ({ priceDelta: g.option_values[0].price_delta }));
  return calculatePrice(p.base_price, defaults);
}

export function ShopScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      // RLS already limits this to approved products from approved sellers.
      let q = supabase.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false });
      if (search.trim()) q = q.ilike('title', `%${search.trim().replace(/[%,]/g, '')}%`);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError(error.message);
      else {
        setError('');
        setProducts((data as Product[]).map(sortProduct));
      }
    }, 250); // short delay so we do not query on every keystroke
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <View style={s.screen}>
      <View style={s.pad}>
        <TextInput style={s.input} placeholder="Search beds…" value={search} onChangeText={setSearch} returnKeyType="search" />
      </View>
      {error ? (
        <Text style={[s.error, { margin: 16 }]}>{error}</Text>
      ) : products === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
          ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>No products found.</Text>}
          renderItem={({ item }) => (
            <Pressable style={[s.card, { padding: 0, overflow: 'hidden' }]} onPress={() => onOpen(item.id)}>
              <Placeholder hex={item.option_groups.find((g) => g.type === 'swatch')?.option_values[0]?.hex ?? '#d6d0c4'} width={400} height={220} />
              <View style={{ padding: 14 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{item.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>{formatPrice(startingPrice(item))}</Text>
                  {item.compare_at_price ? <Text style={{ textDecorationLine: 'line-through', color: colors.muted }}>{formatPrice(item.compare_at_price)}</Text> : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
