// Tiny navigation on purpose: a `tab` state plus an optional open product.
// Login gate -> Shop / Basket / Orders tabs -> Product page (Android back button works).
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './lib/auth';
import { CartProvider, useCart } from './lib/cart';
import { supabase } from './lib/supabase';
import { colors, s } from './lib/theme';
import { CartScreen } from './screens/CartScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { ProductScreen } from './screens/ProductScreen';
import { ShopScreen } from './screens/ShopScreen';

type Tab = 'shop' | 'basket' | 'orders';

function Main() {
  const { session, loading } = useAuth();
  const { count } = useCart();
  const [tab, setTab] = useState<Tab>('shop');
  const [productId, setProductId] = useState<string | null>(null);

  // Android back button closes the product page first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (productId) {
        setProductId(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [productId]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  if (!session) return <LoginScreen />;

  const go = (t: Tab) => {
    setProductId(null);
    setTab(t);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7e5e4' }}>
        {productId ? (
          <Pressable accessibilityLabel="Back" style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }} onPress={() => setProductId(null)}>
            <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '600' }}>‹ Back</Text>
          </Pressable>
        ) : (
          <Text style={s.h1}>Mini Marketplace</Text>
        )}
        <Pressable style={{ marginLeft: 'auto', minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }} onPress={() => supabase.auth.signOut()}>
          <Text style={{ color: colors.muted, fontWeight: '600' }}>Log out</Text>
        </Pressable>
      </View>

      {/* body */}
      <View style={{ flex: 1 }}>
        {productId ? (
          <ProductScreen id={productId} onViewBasket={() => go('basket')} />
        ) : tab === 'shop' ? (
          <ShopScreen onOpen={setProductId} />
        ) : tab === 'basket' ? (
          <CartScreen onBrowse={() => go('shop')} onPlaced={() => go('orders')} />
        ) : (
          <OrdersScreen />
        )}
      </View>

      {/* bottom tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e7e5e4' }}>
        {([['shop', 'Shop'], ['basket', count ? `Basket (${count})` : 'Basket'], ['orders', 'Orders']] as [Tab, string][]).map(([t, label]) => (
          <Pressable key={t} onPress={() => go(t)} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="tab" accessibilityState={{ selected: tab === t && !productId }}>
            <Text style={{ fontWeight: '700', color: tab === t && !productId ? colors.primary : colors.muted }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <AuthProvider>
          <CartProvider>
            <Main />
          </CartProvider>
        </AuthProvider>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
