// Basket + fake checkout. No payment is taken.
// Checkout sends ONLY product ids, option value ids and quantities to the place_order function;
// the database works out the real prices.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { formatPrice } from '@marketplace/shared';
import { useCart } from '../lib/cart';
import { supabase } from '../lib/supabase';
import { colors, s } from '../lib/theme';

export function CartScreen({ onBrowse, onPlaced }: { onBrowse: () => void; onPlaced: () => void }) {
  const { lines, total, setQuantity, removeLine, clear } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function placeOrder() {
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim()) return setError('Please fill in name, address and phone.');
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('place_order', {
      p_items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, value_ids: l.valueIds })),
      p_shipping: form,
    });
    setBusy(false);
    if (error) return setError(error.message);
    clear();
    setCheckingOut(false);
    onPlaced();
  }

  if (lines.length === 0) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Text style={s.muted}>Your basket is empty.</Text>
        <Pressable style={s.button} onPress={onBrowse}>
          <Text style={s.buttonText}>Browse beds</Text>
        </Pressable>
      </View>
    );
  }

  const qtyButton = { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border } as const;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { gap: 12 }]} keyboardShouldPersistTaps="handled">
        {lines.map((l) => (
          <View key={l.key} style={[s.card, { gap: 8 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontWeight: '700', flex: 1 }}>{l.title}</Text>
              <Text style={{ fontWeight: '700' }}>{formatPrice(l.unitPrice * l.quantity)}</Text>
            </View>
            <Text style={s.muted}>{l.options.map((o) => `${o.group}: ${o.label}`).join(' · ')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable accessibilityLabel="Decrease quantity" style={qtyButton} onPress={() => setQuantity(l.key, l.quantity - 1)}>
                <Text style={{ fontSize: 22 }}>−</Text>
              </Pressable>
              <Text style={{ minWidth: 24, textAlign: 'center', fontWeight: '700' }}>{l.quantity}</Text>
              <Pressable accessibilityLabel="Increase quantity" style={qtyButton} onPress={() => setQuantity(l.key, l.quantity + 1)}>
                <Text style={{ fontSize: 22 }}>+</Text>
              </Pressable>
              <Pressable style={{ marginLeft: 'auto', minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }} onPress={() => removeLine(l.key)}>
                <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {checkingOut && (
          <View style={{ gap: 10 }}>
            <Text style={{ backgroundColor: '#fffbeb', color: '#92400e', padding: 10, borderRadius: 8 }}>Demo only: no payment is taken.</Text>
            <TextInput style={s.input} placeholder="Full name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
            <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Delivery address" multiline value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} />
            <TextInput style={s.input} placeholder="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
            {!!error && <Text style={s.error}>{error}</Text>}
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e7e5e4' }}>
        <View>
          <Text style={{ fontSize: 12, color: colors.muted }}>Total</Text>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>{formatPrice(total)}</Text>
        </View>
        <Pressable
          style={[s.button, { marginLeft: 'auto' }, busy && { opacity: 0.6 }]}
          disabled={busy}
          onPress={checkingOut ? placeOrder : () => setCheckingOut(true)}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{checkingOut ? 'Place order' : 'Checkout'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}
