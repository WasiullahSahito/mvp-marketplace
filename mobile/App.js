// Mini Marketplace – React Native (Expo) app.
// Uses the SAME REST API and database as the web app. Screens: Login, Product list + search,
// Product page (swatches, size, storage, headboard, base, assembly, live price), Cart, Orders.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View, Alert, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgUri } from 'react-native-svg';

const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000'; // 10.0.2.2 = host PC from Android emulator
const money = (n) => '£' + Number(n).toFixed(2);
const signed = (n) => (n > 0 ? ' +' + money(n) : '');
const W = Dimensions.get('window').width;

// ---------- API client ----------
const session = { base: DEFAULT_API, token: '' };
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers.Authorization = 'Bearer ' + session.token;
  let r;
  try { r = await fetch(session.base + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Cannot reach server at ' + session.base); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Request failed'); e.status = r.status; throw e; }
  return data;
}
const abs = (u) => (u && u.startsWith('/') ? session.base + u : u);
const tint = (u, hex) => (u && u.includes('/api/placeholder') && hex ? `${u}&hex=${encodeURIComponent(hex)}` : u);

// SVG placeholders need SvgUri; real photos use Image
function Pic({ uri, style }) {
  if (!uri) return <View style={[style, { backgroundColor: '#e5e7eb' }]} />;
  const full = abs(uri);
  if (full.includes('/api/placeholder') || full.endsWith('.svg')) {
    return <View style={[style, { overflow: 'hidden', backgroundColor: '#eee' }]}><SvgUri uri={full} width="100%" height="100%" /></View>;
  }
  return <Image source={{ uri: full }} style={style} resizeMode="cover" />;
}

// ---------- small UI kit (all tap targets >= 44) ----------
const Btn = ({ title, onPress, kind = 'dark', disabled, style }) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.btn, kind === 'accent' && s.btnAccent, kind === 'alt' && s.btnAlt, kind === 'danger' && s.btnDanger, (pressed || disabled) && { opacity: 0.6 }, style]}>
    <Text style={[s.btnTxt, kind === 'accent' && { color: '#1b1305' }, (kind === 'alt') && { color: '#1e293b' }, kind === 'danger' && { color: '#dc2626' }]}>{title}</Text>
  </Pressable>
);
const Pill = ({ text }) => <Text style={s.pill}>{text}</Text>;

// ---------- screens ----------
function Login({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: 'buyer@demo.test', password: 'buyer123', name: '' });
  const [server, setServer] = useState(session.base);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      session.base = server.trim().replace(/\/$/, ''); await AsyncStorage.setItem('mm_base', session.base);
      const r = await api('/auth/' + mode, { method: 'POST', body: mode === 'login' ? { email: f.email, password: f.password } : { ...f, role: 'buyer' } });
      session.token = r.token; await AsyncStorage.setItem('mm_token', r.token); onLoggedIn(r.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Mini<Text style={{ color: '#f59e0b' }}>Market</Text></Text>
        <Text style={s.h2}>{mode === 'login' ? 'Log in' : 'Create buyer account'}</Text>
        <Text style={s.label}>Server URL (your PC's IP on Wi-Fi, or the live link)</Text>
        <TextInput style={s.input} value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        {mode === 'signup' && (<><Text style={s.label}>Name</Text><TextInput style={s.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} /></>)}
        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" keyboardType="email-address" />
        <Text style={s.label}>Password</Text>
        <TextInput style={s.input} value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry />
        {!!err && <Text style={s.err}>{err}</Text>}
        <Btn title={busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'} onPress={go} disabled={busy} style={{ marginTop: 14 }} />
        <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: '#1d4ed8' }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
        </Pressable>
        <Text style={s.hint}>Demo buyer: buyer@demo.test / buyer123{'\n'}Sellers and admins use the web app.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProductList({ onOpen }) {
  const [q, setQ] = useState(''); const [items, setItems] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(async (term) => {
    try { setErr(''); setItems(await api('/products' + (term ? '?q=' + encodeURIComponent(term) : ''))); } catch (e) { setErr(e.message); setItems([]); }
  }, []);
  useEffect(() => { load(''); }, [load]);
  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchRow}>
        <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Search products" value={q} onChangeText={setQ} onSubmitEditing={() => load(q)} returnKeyType="search" />
        <Btn title="Search" onPress={() => load(q)} kind="accent" style={{ marginLeft: 8 }} />
      </View>
      {!!err && <Text style={s.err}>{err}</Text>}
      {items === null ? <ActivityIndicator style={{ marginTop: 30 }} /> : (
        <FlatList data={items} keyExtractor={(p) => String(p.id)} numColumns={2} contentContainerStyle={{ padding: 8 }} columnWrapperStyle={{ gap: 8 }}
          ListEmptyComponent={<Text style={s.muted}>No products found.</Text>}
          renderItem={({ item: p }) => (
            <Pressable style={s.pcard} onPress={() => onOpen(p.id)}>
              {p.discount_percent > 0 && <Text style={s.off}>{p.discount_percent}% OFF</Text>}
              <Pic uri={p.image} style={s.pimg} />
              <View style={{ padding: 8 }}>
                <Text style={{ fontWeight: '600' }} numberOfLines={2}>{p.title}</Text>
                <Text style={s.muted}>from</Text>
                <Text><Text style={s.price}>{money(p.base_price)}</Text>{p.compare_at_price ? <Text style={s.was}>  {money(p.compare_at_price)}</Text> : null}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {p.colours.map((c) => <View key={c.label} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.hex, borderWidth: 1, borderColor: '#0003' }} />)}
                </View>
              </View>
            </Pressable>
          )} />
      )}
    </View>
  );
}

function ProductPage({ id, onBack, onCartChange, requireLogin }) {
  const [p, setP] = useState(null); const [err, setErr] = useState('');
  const [sel, setSel] = useState({}); const [imgIdx, setImgIdx] = useState(0);
  const [busy, setBusy] = useState(false); const [added, setAdded] = useState(false);
  useEffect(() => {
    api('/products/' + id).then((d) => {
      const init = {}; d.groups.forEach((g) => { if (g.required && g.type !== 'checkbox') init[g.id] = g.values[0].id; });
      setSel(init); setP(d);
    }).catch((e) => setErr(e.message));
  }, [id]);
  const colourGroup = p && p.groups.find((g) => g.type === 'swatch');
  const colour = colourGroup && colourGroup.values.find((v) => v.id === sel[colourGroup.id]);
  const chosen = useMemo(() => (p ? p.groups.flatMap((g) => g.values.filter((v) => sel[g.id] === v.id)) : []), [p, sel]);
  const price = p ? Math.round((p.base_price + chosen.reduce((a, v) => a + v.price_delta, 0)) * 100) / 100 : 0;
  const images = useMemo(() => {
    if (!p) return []; const l = p.images.map((u) => tint(u, colour && colour.hex));
    if (colour && colour.image_url) l.unshift(colour.image_url); return l;
  }, [p, colour]);
  if (err) return <View style={{ padding: 20 }}><Text style={s.err}>{err}</Text><Btn title="Back" onPress={onBack} /></View>;
  if (!p) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const title = colour ? `${p.title.split(' – ')[0]} – ${colour.label}` : p.title;
  const add = async () => {
    if (requireLogin()) return;
    setBusy(true);
    try { const c = await api('/cart', { method: 'POST', body: { product_id: p.id, value_ids: chosen.map((v) => v.id), qty: 1 } }); onCartChange(c.count); setAdded(true); setTimeout(() => setAdded(false), 1800); }
    catch (e) { Alert.alert('Could not add', e.message); } finally { setBusy(false); }
  };
  const pick = (g, v) => setSel((cur) => {
    const n = { ...cur };
    if (g.type === 'checkbox') { n[g.id] = cur[g.id] === v.id ? undefined : v.id; } else n[g.id] = v.id;
    return n;
  });
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Pressable onPress={onBack} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}><Text style={{ color: '#1d4ed8', fontWeight: '600' }}>‹ Back to shop</Text></Pressable>
        {/* swipeable gallery */}
        <FlatList data={images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(u, i) => u + i}
          onMomentumScrollEnd={(e) => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
          renderItem={({ item }) => <Pic uri={item} style={{ width: W, height: W * 0.75 }} />} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 8 }}>
          {images.map((_, i) => <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === imgIdx ? '#1e293b' : '#cbd5e1' }} />)}
        </View>
        <View style={{ padding: 14 }}>
          <Text style={s.h2}>{title}</Text>
          <Text style={s.muted}>Sold by {p.shop_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: '800' }}>{money(price)}</Text>
            {p.compare_at_price ? <Text style={s.was}>{money(p.compare_at_price)}</Text> : null}
            {p.discount_percent > 0 ? <Text style={s.off2}>{p.discount_percent}% OFF</Text> : null}
          </View>
          {p.groups.map((g) => (
            <View key={g.id} style={{ marginVertical: 10 }}>
              {g.type === 'swatch' ? (
                <>
                  <Text style={s.groupTitle}>{g.name}: <Text style={{ fontWeight: '400' }}>{colour ? colour.label : 'Choose'}</Text></Text>
                  <View style={s.wrap}>
                    {g.values.map((v) => (
                      <Pressable key={v.id} accessibilityLabel={v.label} onPress={() => { pick(g, v); setImgIdx(0); }}
                        style={[s.swatch, { backgroundColor: v.hex || '#ccc' }, sel[g.id] === v.id && s.swatchOn]}>
                        {sel[g.id] === v.id && <Text style={{ color: '#fff', fontWeight: '800', textShadowColor: '#000', textShadowRadius: 3 }}>✓</Text>}
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : g.type === 'checkbox' ? (
                <Pressable onPress={() => pick(g, g.values[0])} style={[s.choice, sel[g.id] && s.choiceOn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <Text style={{ fontSize: 22 }}>{sel[g.id] ? '☑' : '☐'}</Text>
                  <Text style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{g.name}</Text> (optional){'\n'}{g.values[0].label}{signed(g.values[0].price_delta)}</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={s.groupTitle}>{g.name}</Text>
                  <View style={s.wrap}>
                    {g.values.map((v) => (
                      <Pressable key={v.id} onPress={() => pick(g, v)} style={[s.choice, sel[g.id] === v.id && s.choiceOn]}>
                        <Text style={sel[g.id] === v.id && { fontWeight: '700' }}>{v.label}</Text>
                        {v.price_delta ? <Text style={s.muted}>{signed(v.price_delta).trim()}</Text> : null}
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          ))}
          <Text style={s.groupTitle}>Description</Text>
          <Text>{p.description}</Text>
        </View>
      </ScrollView>
      {/* sticky add-to-basket bar */}
      <View style={s.sticky}>
        <View><Text style={s.muted}>Your price</Text><Text style={s.price}>{money(price)}</Text></View>
        <Btn title={busy ? 'Adding…' : added ? 'Added ✓' : 'Add to Basket'} kind="accent" onPress={add} disabled={busy} style={{ flex: 1, marginLeft: 16 }} />
      </View>
    </View>
  );
}

function Cart({ onChange, onCheckout }) {
  const [c, setC] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api('/cart').then((d) => { setC(d); onChange(d.count); }).catch((e) => setErr(e.message)), [onChange]);
  useEffect(() => { load(); }, [load]);
  if (err) return <Text style={s.err}>{err}</Text>;
  if (!c) return <ActivityIndicator style={{ marginTop: 30 }} />;
  if (!c.lines.length) return <Text style={[s.muted, { padding: 20 }]}>Your basket is empty.</Text>;
  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      {c.lines.map((l) => (
        <View key={l.id} style={s.card}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pic uri={l.image} style={{ width: 84, height: 84, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{l.title}</Text>
              {l.options.map((o) => <Text key={o.group} style={s.small}><Text style={{ fontWeight: '600' }}>{o.group}:</Text> {o.label}{signed(o.price_delta)}</Text>)}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Btn title="−" kind="alt" disabled={l.qty <= 1} onPress={async () => { await api('/cart/' + l.id, { method: 'PATCH', body: { qty: l.qty - 1 } }); load(); }} style={s.qtyBtn} />
              <Text style={{ minWidth: 30, textAlign: 'center', fontSize: 16 }}>{l.qty}</Text>
              <Btn title="+" kind="alt" onPress={async () => { await api('/cart/' + l.id, { method: 'PATCH', body: { qty: l.qty + 1 } }); load(); }} style={s.qtyBtn} />
            </View>
            <View style={{ alignItems: 'flex-end' }}><Text style={s.muted}>{money(l.unit_price)} each</Text><Text style={{ fontWeight: '700' }}>{money(l.line_total)}</Text></View>
          </View>
          <Btn title="Remove" kind="danger" onPress={async () => { await api('/cart/' + l.id, { method: 'DELETE' }); load(); }} style={{ marginTop: 8 }} />
        </View>
      ))}
      <View style={s.card}><Text style={{ fontSize: 22, fontWeight: '800' }}>Total {money(c.total)}</Text>
        <Btn title="Checkout" kind="accent" onPress={onCheckout} style={{ marginTop: 10 }} /></View>
    </ScrollView>
  );
}

function Checkout({ user, onDone }) {
  const [f, setF] = useState({ name: user.name, address: '', phone: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true); setErr('');
    try { await api('/checkout', { method: 'POST', body: f }); onDone(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h2}>Checkout</Text><Text style={s.hint}>Demo only – no real payment is taken.</Text>
      <Text style={s.label}>Full name</Text><TextInput style={s.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Text style={s.label}>Delivery address</Text><TextInput style={[s.input, { height: 90 }]} multiline value={f.address} onChangeText={(v) => setF({ ...f, address: v })} />
      <Text style={s.label}>Phone</Text><TextInput style={s.input} keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Btn title={busy ? 'Placing…' : 'Place order'} kind="accent" onPress={pay} disabled={busy} />
    </ScrollView>
  );
}

function Orders() {
  const [o, setO] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api('/orders').then(setO).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]); // refresh so status changes show up
  if (err) return <Text style={s.err}>{err}</Text>;
  if (!o) return <ActivityIndicator style={{ marginTop: 30 }} />;
  return (
    <FlatList data={o} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 12 }} onRefresh={load} refreshing={false}
      ListEmptyComponent={<Text style={s.muted}>No orders yet.</Text>}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '700' }}>Order #{item.id}</Text><Pill text={item.status} /></View>
          <Text style={s.muted}>{item.created_at} UTC · {item.shop_name}</Text>
          {item.items.map((i) => (
            <View key={i.id} style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: '600' }}>{i.qty} × {i.title}</Text>
              {i.options.map((op) => <Text key={op.group} style={s.small}>{op.group}: {op.label}</Text>)}
            </View>
          ))}
          <Text style={{ fontWeight: '800', marginTop: 8 }}>Total {money(item.total)}</Text>
        </View>
      )} />
  );
}

// ---------- shell: bottom tabs + simple stack ----------
export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('shop');
  const [productId, setProductId] = useState(null);
  const [checkout, setCheckout] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    (async () => {
      const base = await AsyncStorage.getItem('mm_base'); if (base) session.base = base;
      const t = await AsyncStorage.getItem('mm_token');
      if (t) { session.token = t; try { setUser((await api('/me')).user); } catch {} }
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (user) api('/cart').then((c) => setCartCount(c.count)).catch(() => {}); }, [user]);

  const logout = async () => { session.token = ''; await AsyncStorage.removeItem('mm_token'); setUser(null); setCartCount(0); setTab('shop'); };
  const requireLogin = () => { if (!user) { setLoginPrompt(true); return true; } return false; };

  if (!ready) return <SafeAreaView style={s.screen}><ActivityIndicator style={{ marginTop: 80 }} /></SafeAreaView>;
  if (loginPrompt) return <SafeAreaView style={s.screen}><Login onLoggedIn={(u) => { setUser(u); setLoginPrompt(false); }} /></SafeAreaView>;

  let body;
  if (checkout) body = <Checkout user={user} onDone={() => { setCheckout(false); setCartCount(0); setThanks(true); setTab('orders'); }} />;
  else if (tab === 'shop' && productId) body = <ProductPage id={productId} onBack={() => setProductId(null)} onCartChange={setCartCount} requireLogin={requireLogin} />;
  else if (tab === 'shop') body = <ProductList onOpen={setProductId} />;
  else if (tab === 'cart') body = user ? <Cart onChange={setCartCount} onCheckout={() => setCheckout(true)} /> : <Gate onLogin={() => setLoginPrompt(true)} />;
  else if (tab === 'orders') body = user ? <View style={{ flex: 1 }}>{thanks && <Text style={s.banner}>🎉 Thank you! Your order was placed.</Text>}<Orders /></View> : <Gate onLogin={() => setLoginPrompt(true)} />;
  else body = user ? (
    <View style={{ padding: 20 }}><Text style={s.h2}>{user.name}</Text><Text style={s.muted}>{user.email} · {user.role}</Text><Btn title="Log out" onPress={logout} style={{ marginTop: 16 }} /></View>
  ) : <Gate onLogin={() => setLoginPrompt(true)} />;

  const Tab = ({ id, icon, label, badge }) => (
    <Pressable style={s.tab} onPress={() => { setTab(id); setCheckout(false); setThanks(id === 'orders' ? thanks : false); if (id === 'shop') setProductId(null); }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.tabTxt, tab === id && { color: '#1e293b', fontWeight: '700' }]}>{label}</Text>
      {!!badge && <Text style={s.badge}>{badge}</Text>}
    </Pressable>
  );
  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="light" backgroundColor="#1e293b" />
      <View style={s.top}><Text style={{ color: '#fff', fontSize: 18 }}>Mini<Text style={{ color: '#f59e0b', fontWeight: '700' }}>Market</Text></Text></View>
      <View style={{ flex: 1 }}>{body}</View>
      <View style={s.tabbar}>
        <Tab id="shop" icon="🏠" label="Shop" /><Tab id="cart" icon="🛒" label="Basket" badge={cartCount} />
        <Tab id="orders" icon="📦" label="Orders" /><Tab id="account" icon="👤" label={user ? 'Account' : 'Log in'} />
      </View>
    </SafeAreaView>
  );
}
const Gate = ({ onLogin }) => (<View style={{ padding: 20 }}><Text style={s.muted}>Please log in to continue.</Text><Btn title="Log in" onPress={onLogin} style={{ marginTop: 12 }} /></View>);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 28 : 0 },
  top: { backgroundColor: '#1e293b', padding: 12 },
  h1: { fontSize: 30, fontWeight: '600', marginVertical: 10 }, h2: { fontSize: 20, fontWeight: '700', marginVertical: 6 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fff', marginBottom: 4 },
  btn: { minHeight: 48, borderRadius: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnAccent: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }, btnAlt: { backgroundColor: '#fff' }, btnDanger: { backgroundColor: '#fff', borderColor: '#dc2626' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  qtyBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 0 },
  err: { color: '#dc2626', marginVertical: 8, paddingHorizontal: 12 }, muted: { color: '#64748b' }, small: { fontSize: 13, color: '#475569' },
  hint: { backgroundColor: '#eff6ff', padding: 10, borderRadius: 8, marginVertical: 10, color: '#1e3a8a' },
  banner: { backgroundColor: '#fef3c7', padding: 12, margin: 12, borderRadius: 10 },
  searchRow: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  pcard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 8 },
  pimg: { width: '100%', aspectRatio: 4 / 3 },
  price: { fontWeight: '800', fontSize: 17 }, was: { color: '#64748b', textDecorationLine: 'line-through' },
  off: { position: 'absolute', zIndex: 2, top: 6, left: 6, backgroundColor: '#dc2626', color: '#fff', fontWeight: '700', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  off2: { backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  groupTitle: { fontWeight: '700', marginBottom: 6, fontSize: 15 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: '#1e293b' },
  choice: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', justifyContent: 'center' },
  choiceOn: { borderColor: '#1e293b', backgroundColor: '#f1f5f9' },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0', padding: 10, flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 10 },
  pill: { backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: '700', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  tabbar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0' },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' }, tabTxt: { fontSize: 11, color: '#64748b' },
  badge: { position: 'absolute', top: 4, right: '28%', backgroundColor: '#dc2626', color: '#fff', fontSize: 11, minWidth: 18, textAlign: 'center', borderRadius: 9, overflow: 'hidden' },
});
