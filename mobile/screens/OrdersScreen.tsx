// The buyer's orders. RLS only returns this buyer's own orders.
// Realtime: when the seller changes an order's status, the list refreshes by itself.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, s } from '../lib/theme';

const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];

type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  order_items: { id: string; title: string; quantity: number; unit_price: number; options: { group: string; label: string }[] }[];
};

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total, created_at, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      setError('');
      setOrders(data as Order[]);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('my-orders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (error) return <Text style={[s.error, { margin: 16 }]}>{error}</Text>;
  if (!orders) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <FlatList
      style={s.screen}
      data={orders}
      keyExtractor={(o) => o.id}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>No orders yet.</Text>}
      renderItem={({ item: o }) => {
        const current = STEPS.indexOf(o.status);
        return (
          <View style={[s.card, { gap: 10 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.muted}>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString('en-GB')}</Text>
              <Text style={{ fontWeight: '800' }}>£{Number(o.total).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Order status: ${o.status}`}>
              {STEPS.map((st, i) => (
                <View key={st} style={{ flex: 1 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: i <= current ? colors.primary : '#e7e5e4' }} />
                  <Text style={{ marginTop: 4, fontSize: 11, textAlign: 'center', textTransform: 'capitalize', fontWeight: i === current ? '700' : '400', color: i === current ? colors.primary : colors.muted }}>{st}</Text>
                </View>
              ))}
            </View>
            {o.order_items.map((i) => (
              <View key={i.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontWeight: '600', flex: 1 }}>{i.title}</Text>
                  <Text>{i.quantity} × £{Number(i.unit_price).toFixed(2)}</Text>
                </View>
                <Text style={s.muted}>{i.options.map((op) => `${op.group}: ${op.label}`).join(' · ')}</Text>
              </View>
            ))}
          </View>
        );
      }}
    />
  );
}
