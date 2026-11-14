// Mini Marketplace – React Native (Expo) app.
// Uses the SAME REST API and database as the web app. Screens: Login, Product list + search,
// Product page (swatches, size, storage, headboard, base, assembly, live price), Cart, Orders.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StatusBar as RNStatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgUri } from 'react-native-svg';

// ---------- theme ----------
const C = {
  bg: '#f4f5fb', card: '#ffffff', ink: '#0f172a', muted: '#6b7280', line: '#e5e7eb',
  brand: '#4f46e5', brandDark: '#312e81', accent: '#f59e0b', accentInk: '#1f1300',
  red: '#e11d48', green: '#16a34a',
};
const shadow = { shadowColor: '#1e1b4b', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
const W = Dimensions.get('window').width;
const TOP = Platform.OS === 'android' ? RNStatusBar.currentHeight || 28 : Platform.OS === 'ios' ? 48 : 0;

const money = (n) => '£' + Number(n).toFixed(2);
const signed = (n) => (n > 0 ? ' +' + money(n) : '');

// ---------- API client ----------
// Default server: auto-detect the PC running Metro (same machine as the backend), so no typing is needed.
function guessBase() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:3000`;
  const host = (Constants.expoConfig && Constants.expoConfig.hostUri) || (Constants.expoGoConfig && Constants.expoGoConfig.debuggerHost) || '';
  const ip = host.split(':')[0];
  if (ip) return `http://${ip}:3000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}
const cleanBase = (u) => u.trim().replace(/\/+$/, '');
const session = { base: guessBase(), token: '' };
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers.Authorization = 'Bearer ' + session.token;
  let r;
  try { r = await fetch(session.base + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Cannot reach the server at ' + session.base + '. Is `npm start` running?'); }
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
    return <View style={[style, { overflow: 'hidden', backgroundColor: '#eceef5' }]}><SvgUri uri={full} width="100%" height="100%" /></View>;
  }
  return <Image source={{ uri: full }} style={style} resizeMode="cover" />;
}

// ---------- UI kit (all tap targets >= 44) ----------
function Btn({ title, onPress, kind = 'brand', disabled, style, small }) {
  const palette = {
    brand: [C.brand, '#fff'], accent: [C.accent, C.accentInk], alt: ['#fff', C.brand], danger: ['#fff', C.red], ghost: ['#eef0ff', C.brand],
  }[kind];
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, small && { minHeight: 44, paddingHorizontal: 14 }, { backgroundColor: palette[0] }, (kind === 'alt' || kind === 'danger') && { borderWidth: 1.5, borderColor: palette[1] },
        kind === 'accent' && shadow, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }, disabled && { opacity: 0.5 }, style]}>
      <Text style={[s.btnTxt, { color: palette[1] }]}>{title}</Text>
    </Pressable>
  );
}
const Empty = ({ icon, title, text, action }) => (
  <View style={{ alignItems: 'center', padding: 36 }}>
    <View style={s.emptyIcon}><Text style={{ fontSize: 36 }}>{icon}</Text></View>
    <Text style={{ fontWeight: '800', fontSize: 18, color: C.ink, marginTop: 14 }}>{title}</Text>
    <Text style={[s.muted, { textAlign: 'center', marginVertical: 8 }]}>{text}</Text>{action}
  </View>
);
const STEPS = ['New', 'Confirmed', 'Shipped', 'Delivered'];
const Stepper = ({ status }) => {
  const at = STEPS.indexOf(status);
  return (
    <View style={{ flexDirection: 'row', marginVertical: 14 }}>
      {STEPS.map((st, i) => (
        <View key={st} style={{ flex: 1, alignItems: 'center' }}>
          {i > 0 && <View style={{ position: 'absolute', top: 12, left: '-50%', width: '100%', height: 3, backgroundColor: i <= at ? C.green : C.line }} />}
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: i <= at ? C.green : C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: i <= at ? '#fff' : C.muted, fontWeight: '800', fontSize: 12 }}>{i < at ? '✓' : i + 1}</Text>
          </View>
          <Text style={{ fontSize: 11, marginTop: 4, color: i === at ? C.ink : C.muted, fontWeight: i === at ? '800' : '400' }}>{st}</Text>
        </View>
      ))}
    </View>
  );
};
const Pill = ({ text, color = C.brand, bg = '#eef0ff' }) => <Text style={[s.pill, { color, backgroundColor: bg }]}>{text}</Text>;
const ErrorBox = ({ text, onRetry, onServer }) => (
  <View style={[s.card, { margin: 12, borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}>
    <Text style={{ color: C.red, fontWeight: '700' }}>{text}</Text>
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
      {onRetry && <Btn small title="Retry" onPress={onRetry} />}
      {onServer && <Btn small kind="alt" title="Change server" onPress={onServer} />}
    </View>
  </View>
);

// ---------- screens ----------
function Login({ onLoggedIn, onClose }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: 'buyer@demo.test', password: 'buyer123', name: '' });
  const [server, setServer] = useState(session.base);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      session.base = cleanBase(server); await AsyncStorage.setItem('mm_base', session.base);
      const r = await api('/auth/' + mode, { method: 'POST', body: mode === 'login' ? { email: f.email.trim(), password: f.password } : { ...f, role: 'buyer' } });
      session.token = r.token; await AsyncStorage.setItem('mm_token', r.token); onLoggedIn(r.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
        <LinearGradient colors={[C.brandDark, C.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.loginHead, { paddingTop: TOP + 30 }]}>
          {onClose && <Pressable onPress={onClose} style={s.closeBtn}><Text style={{ color: '#fff', fontSize: 20 }}>✕</Text></Pressable>}
          <View style={s.logoMark}><Text style={{ fontSize: 30 }}>🛋️</Text></View>
          <Text style={s.logoText}>Mini<Text style={{ color: C.accent }}>Market</Text></Text>
          <Text style={{ color: '#c7d2fe', marginTop: 4 }}>Furniture, your way</Text>
        </LinearGradient>
        <View style={[s.card, { margin: 16, marginTop: -28, padding: 18 }]}>
          <Text style={s.h2}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          {mode === 'signup' && (<><Text style={s.label}>Name</Text><TextInput style={s.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Your name" /></>)}
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry placeholder="••••••" />
          {!!err && <Text style={s.err}>{err}</Text>}
          <Btn title={busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'} onPress={go} disabled={busy} kind="accent" style={{ marginTop: 16 }} />
          <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: C.brand, fontWeight: '700' }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
          </Pressable>
        </View>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <Text style={s.label}>Server URL</Text>
          <Text style={[s.muted, { fontSize: 12, marginBottom: 6 }]}>Auto-detected. Change only if your backend runs elsewhere (PC IP on Wi-Fi, or the live link).</Text>
          <TextInput style={s.input} value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Text style={[s.hint, { marginTop: 10 }]}>Demo buyer: buyer@demo.test / buyer123{'\n'}Sellers and admins use the web app.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProductList({ onOpen, onServer }) {
  const [q, setQ] = useState(''); const [colour, setColour] = useState(''); const [items, setItems] = useState(null);
  const [colours, setColours] = useState([]); const [err, setErr] = useState('');
  const load = useCallback(async (term, col) => {
    try {
      setErr('');
      const p = new URLSearchParams(); if (term) p.set('q', term); if (col) p.set('colour', col);
      setItems(await api('/products' + (p.toString() ? '?' + p : '')));
    } catch (e) { setErr(e.message); setItems([]); }
  }, []);
  useEffect(() => { load('', ''); api('/facets').then((f) => setColours(f.colours)).catch(() => {}); }, [load]);
  return (
    <View style={{ flex: 1 }}>
      <FlatList data={items || []} keyExtractor={(p) => String(p.id)} numColumns={2} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }} columnWrapperStyle={{ gap: 12 }}
        ListHeaderComponent={
          <View>
            <LinearGradient colors={[C.brandDark, C.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroT}>Furniture, your way</Text>
                <Text style={{ color: '#c7d2fe', marginTop: 4 }}>Choose colour, size & storage – the price updates as you pick.</Text>
              </View>
              <Text style={{ fontSize: 54 }}>🛏️</Text>
            </LinearGradient>
            <View style={s.searchBox}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput style={{ flex: 1, minHeight: 46, color: C.ink }} placeholder="Search beds, sofas, tables…" placeholderTextColor="#9ca3af" value={q}
                onChangeText={setQ} onSubmitEditing={() => load(q, colour)} returnKeyType="search" />
              {!!q && <Pressable onPress={() => { setQ(''); load('', colour); }} style={{ padding: 10 }}><Text style={{ color: C.muted }}>✕</Text></Pressable>}
            </View>
            {colours.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                <Pressable onPress={() => { setColour(''); load(q, ''); }} style={[s.chip, !colour && s.chipOn]}><Text style={[s.chipTxt, !colour && { color: '#fff' }]}>All colours</Text></Pressable>
                {colours.map((c) => (
                  <Pressable key={c.label} onPress={() => { setColour(c.label); load(q, c.label); }} style={[s.chip, colour === c.label && s.chipOn]}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.hex, borderWidth: 1, borderColor: '#0003', marginRight: 6 }} />
                    <Text style={[s.chipTxt, colour === c.label && { color: '#fff' }]}>{c.label.replace(' Naples', '')}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {!!err && <ErrorBox text={err} onRetry={() => load(q, colour)} onServer={onServer} />}
            {items === null && <View style={{ flexDirection: 'row', gap: 12 }}>{[0, 1].map((i) => <View key={i} style={s.skel} />)}</View>}
            {items !== null && !err && <Text style={[s.muted, { marginBottom: 8 }]}>{items.length} product{items.length === 1 ? '' : 's'}</Text>}
          </View>
        }
        ListEmptyComponent={items && !err ? <Empty icon="🔍" title="No products found" text="Try a different search or colour." /> : null}
        renderItem={({ item: p }) => (
          <Pressable style={({ pressed }) => [s.pcard, pressed && { transform: [{ scale: 0.98 }] }]} onPress={() => onOpen(p.id)}>
            {p.discount_percent > 0 && <Text style={s.off}>{p.discount_percent}% OFF</Text>}
            <Pic uri={p.image} style={s.pimg} />
            <View style={{ padding: 10 }}>
              <Text style={{ fontWeight: '700', color: C.ink, minHeight: 36 }} numberOfLines={2}>{p.title}</Text>
              <Text style={{ marginTop: 4 }}><Text style={s.muted}>from </Text><Text style={s.price}>{money(p.base_price)}</Text></Text>
              {p.compare_at_price ? <Text style={s.was}>{money(p.compare_at_price)}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {p.colours.slice(0, 8).map((c) => <View key={c.label} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.hex, borderWidth: 1, borderColor: '#0003' }} />)}
              </View>
              <Text style={[s.muted, { fontSize: 12, marginTop: 6 }]}>{p.shop_name}</Text>
            </View>
          </Pressable>
        )} />
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
  const chosen = useMemo(() => (p ? p.groups.flatMap((g) => g.values.filter((v) => sel[g.id] === v.id).map((v) => ({ ...v, group: g.name }))) : []), [p, sel]);
  const price = p ? Math.round((p.base_price + chosen.reduce((a, v) => a + v.price_delta, 0)) * 100) / 100 : 0;
  const images = useMemo(() => {
    if (!p) return []; const l = p.images.map((u) => tint(u, colour && colour.hex));
    if (colour && colour.image_url) l.unshift(colour.image_url); return l;
  }, [p, colour]);
  if (err) return <View style={{ padding: 16, paddingTop: TOP + 10 }}><ErrorBox text={err} /><Btn title="Back" onPress={onBack} /></View>;
  if (!p) return <ActivityIndicator style={{ marginTop: 80 }} color={C.brand} size="large" />;
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
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View>
          <FlatList data={images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(u, i) => u + i}
            onMomentumScrollEnd={(e) => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
            renderItem={({ item }) => <Pic uri={item} style={{ width: W, height: W * 0.85 }} />} />
          <Pressable onPress={onBack} style={[s.floatBtn, { top: 12 }]}><Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>‹</Text></Pressable>
          {p.discount_percent > 0 && <Text style={[s.off, { top: 14, right: 14, left: undefined, fontSize: 13 }]}>{p.discount_percent}% OFF</Text>}
          <View style={s.dotsOver}>{images.map((_, i) => <View key={i} style={{ width: i === imgIdx ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === imgIdx ? '#fff' : '#ffffff99' }} />)}</View>
        </View>
        <View style={s.sheet}>
          <Text style={s.muted}>{p.category_name} · Sold by {p.shop_name}</Text>
          <Text style={s.pTitle}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginVertical: 6 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: C.ink }}>{money(price)}</Text>
            {p.compare_at_price ? <Text style={[s.was, { fontSize: 16 }]}>{money(p.compare_at_price)}</Text> : null}
          </View>
          {p.groups.map((g) => (
            <View key={g.id} style={{ marginTop: 18 }}>
              {g.type === 'swatch' ? (
                <>
                  <Text style={s.groupTitle}>{g.name}: <Text style={{ fontWeight: '500', color: C.muted }}>{colour ? colour.label : 'Choose'}</Text></Text>
                  <View style={s.wrap}>
                    {g.values.map((v) => (
                      <Pressable key={v.id} accessibilityLabel={v.label} onPress={() => { pick(g, v); setImgIdx(0); }}
                        style={[s.swatchOuter, sel[g.id] === v.id && { borderColor: C.brand }]}>
                        <View style={[s.swatch, { backgroundColor: v.hex || '#ccc' }]}>
                          {sel[g.id] === v.id && <Text style={{ color: '#fff', fontWeight: '900', textShadowColor: '#000', textShadowRadius: 3 }}>✓</Text>}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : g.type === 'checkbox' ? (
                <Pressable onPress={() => pick(g, g.values[0])} style={[s.choice, sel[g.id] && s.choiceOn, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <View style={[s.checkbox, sel[g.id] && { backgroundColor: C.brand, borderColor: C.brand }]}>{sel[g.id] && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.ink }}>{g.name} <Text style={s.muted}>(optional)</Text></Text>
                    <Text style={s.muted}>{g.values[0].label}{signed(g.values[0].price_delta)}</Text>
                  </View>
                </Pressable>
              ) : (
                <>
                  <Text style={s.groupTitle}>{g.name}</Text>
                  <View style={s.wrap}>
                    {g.values.map((v) => (
                      <Pressable key={v.id} onPress={() => pick(g, v)} style={[s.choice, sel[g.id] === v.id && s.choiceOn]}>
                        <Text style={[{ color: C.ink }, sel[g.id] === v.id && { fontWeight: '800', color: C.brand }]}>{v.label}</Text>
                        {v.price_delta ? <Text style={[s.muted, { fontSize: 12 }]}>{signed(v.price_delta).trim()}</Text> : <Text style={{ fontSize: 12, color: C.green }}>Included</Text>}
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          ))}
          <View style={s.summary}>
            <Text style={{ fontWeight: '800', marginBottom: 6, color: C.ink }}>Your selection</Text>
            <View style={s.srow}><Text style={s.muted}>Base price</Text><Text>{money(p.base_price)}</Text></View>
            {chosen.filter((v) => v.price_delta).map((v) => <View key={v.id} style={s.srow}><Text style={[s.muted, { flex: 1 }]}>{v.group}: {v.label}</Text><Text>+{money(v.price_delta)}</Text></View>)}
            <View style={[s.srow, { borderTopWidth: 1, borderColor: C.line, marginTop: 8, paddingTop: 8 }]}><Text style={{ fontWeight: '900', color: C.ink }}>Total</Text><Text style={{ fontWeight: '900', color: C.ink, fontSize: 17 }}>{money(price)}</Text></View>
          </View>
          <Text style={s.groupTitle}>Description</Text>
          <Text style={{ color: '#374151', lineHeight: 21 }}>{p.description}</Text>
        </View>
      </ScrollView>
      <View style={s.sticky}>
        <View><Text style={[s.muted, { fontSize: 12 }]}>Your price</Text><Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{money(price)}</Text></View>
        <Btn title={busy ? 'Adding…' : added ? 'Added ✓' : 'Add to Basket'} kind="accent" onPress={add} disabled={busy} style={{ flex: 1, marginLeft: 16 }} />
      </View>
    </View>
  );
}

function Cart({ onChange, onCheckout, onShop }) {
  const [c, setC] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api('/cart').then((d) => { setC(d); onChange(d.count); }).catch((e) => setErr(e.message)), [onChange]);
  useEffect(() => { load(); }, [load]);
  if (err) return <ErrorBox text={err} onRetry={load} />;
  if (!c) return <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  if (!c.lines.length) return <Empty icon="🛒" title="Your basket is empty" text="Find something you like and it will appear here." action={<Btn title="Start shopping" kind="accent" onPress={onShop} />} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
      <Text style={s.screenTitle}>Your basket</Text>
      {c.lines.map((l) => (
        <View key={l.id} style={s.card}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pic uri={l.image} style={{ width: 86, height: 86, borderRadius: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.ink }}>{l.title}</Text>
              {l.options.map((o) => <Text key={o.group} style={s.small}><Text style={{ fontWeight: '700' }}>{o.group}:</Text> {o.label}{signed(o.price_delta)}</Text>)}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <View style={s.qty}>
              <Pressable disabled={l.qty <= 1} style={s.qtyBtn} onPress={async () => { await api('/cart/' + l.id, { method: 'PATCH', body: { qty: l.qty - 1 } }); load(); }}><Text style={[s.qtyTxt, l.qty <= 1 && { opacity: 0.3 }]}>−</Text></Pressable>
              <Text style={{ minWidth: 28, textAlign: 'center', fontWeight: '800', fontSize: 16 }}>{l.qty}</Text>
              <Pressable style={s.qtyBtn} onPress={async () => { await api('/cart/' + l.id, { method: 'PATCH', body: { qty: l.qty + 1 } }); load(); }}><Text style={s.qtyTxt}>+</Text></Pressable>
            </View>
            <View style={{ alignItems: 'flex-end' }}><Text style={s.muted}>{money(l.unit_price)} each</Text><Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{money(l.line_total)}</Text></View>
          </View>
          <Pressable onPress={async () => { await api('/cart/' + l.id, { method: 'DELETE' }); load(); }} style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}><Text style={{ color: C.red, fontWeight: '700' }}>Remove</Text></Pressable>
        </View>
      ))}
      <View style={[s.card, { backgroundColor: C.brandDark }]}>
        <Text style={{ color: '#c7d2fe' }}>Total</Text>
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff' }}>{money(c.total)}</Text>
        <Btn title="Checkout" kind="accent" onPress={onCheckout} style={{ marginTop: 12 }} />
      </View>
    </ScrollView>
  );
}

function Checkout({ user, onDone, onBack }) {
  const [f, setF] = useState({ name: user.name, address: '', phone: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true); setErr('');
    try { await api('/checkout', { method: 'POST', body: f }); onDone(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: C.brand, fontWeight: '800' }}>‹ Back to basket</Text></Pressable>
      <Text style={s.screenTitle}>Checkout</Text>
      <Text style={s.hint}>Demo only – no real payment is taken.</Text>
      <View style={[s.card, { marginTop: 12 }]}>
        <Text style={s.label}>Full name</Text><TextInput style={s.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Text style={s.label}>Delivery address</Text><TextInput style={[s.input, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]} multiline value={f.address} onChangeText={(v) => setF({ ...f, address: v })} />
        <Text style={s.label}>Phone</Text><TextInput style={s.input} keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>
      <Btn title={busy ? 'Placing order…' : 'Place order'} kind="accent" onPress={pay} disabled={busy} />
    </ScrollView>
  );
}

function Orders({ thanks }) {
  const [o, setO] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api('/orders').then(setO).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]); // refresh so status changes show up
  if (err) return <ErrorBox text={err} onRetry={load} />;
  if (!o) return <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  return (
    <FlatList data={o} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 12 }} onRefresh={load} refreshing={false}
      ListHeaderComponent={<View><Text style={s.screenTitle}>My orders</Text>{thanks && <Text style={s.banner}>🎉 Thank you! Your order was placed.</Text>}</View>}
      ListEmptyComponent={<Empty icon="📦" title="No orders yet" text="Orders you place will show here with live status." />}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>Order #{item.id}</Text><Pill text={item.status} /></View>
          <Text style={[s.muted, { fontSize: 12 }]}>{item.created_at} UTC · {item.shop_name}</Text>
          <Stepper status={item.status} />
          {item.items.map((i) => (
            <View key={i.id} style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderColor: C.line }}>
              <Text style={{ fontWeight: '700', color: C.ink }}>{i.qty} × {i.title}</Text>
              {i.options.map((op) => <Text key={op.group} style={s.small}>{op.group}: {op.label}</Text>)}
            </View>
          ))}
          <Text style={{ fontWeight: '900', marginTop: 10, color: C.ink, fontSize: 16 }}>Total {money(item.total)}</Text>
        </View>
      )} />
  );
}

const Gate = ({ onLogin }) => (
  <Empty icon="🔐" title="Please log in" text="Log in to see your basket and orders." action={<Btn title="Log in" kind="accent" onPress={onLogin} />} />
);

// ---------- shell: header + bottom tabs + simple stack ----------
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
      const base = await AsyncStorage.getItem('mm_base'); if (base) session.base = cleanBase(base);
      const t = await AsyncStorage.getItem('mm_token');
      if (t) { session.token = t; try { setUser((await api('/me')).user); } catch {} }
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (user) api('/cart').then((c) => setCartCount(c.count)).catch(() => {}); }, [user]);

  const logout = async () => { session.token = ''; await AsyncStorage.removeItem('mm_token'); setUser(null); setCartCount(0); setTab('shop'); };
  const requireLogin = () => { if (!user) { setLoginPrompt(true); return true; } return false; };

  if (!ready) return <View style={[s.screen, { justifyContent: 'center' }]}><ActivityIndicator size="large" color={C.brand} /></View>;
  if (loginPrompt) return <View style={s.screen}><StatusBar style="light" /><Login onClose={() => setLoginPrompt(false)} onLoggedIn={(u) => { setUser(u); setLoginPrompt(false); }} /></View>;

  const inProduct = tab === 'shop' && productId;
  let body;
  if (checkout) body = <Checkout user={user} onBack={() => setCheckout(false)} onDone={() => { setCheckout(false); setCartCount(0); setThanks(true); setTab('orders'); }} />;
  else if (inProduct) body = <ProductPage id={productId} onBack={() => setProductId(null)} onCartChange={setCartCount} requireLogin={requireLogin} />;
  else if (tab === 'shop') body = <ProductList onOpen={setProductId} onServer={() => setLoginPrompt(true)} />;
  else if (tab === 'cart') body = user ? <Cart onChange={setCartCount} onCheckout={() => setCheckout(true)} onShop={() => setTab('shop')} /> : <Gate onLogin={() => setLoginPrompt(true)} />;
  else if (tab === 'orders') body = user ? <Orders thanks={thanks} /> : <Gate onLogin={() => setLoginPrompt(true)} />;
  else body = user ? (
    <View style={{ padding: 16 }}>
      <View style={[s.card, { alignItems: 'center', padding: 24 }]}>
        <View style={s.avatar}><Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{user.name.charAt(0).toUpperCase()}</Text></View>
        <Text style={[s.h2, { marginTop: 10 }]}>{user.name}</Text><Text style={s.muted}>{user.email}</Text><Pill text={user.role} />
        <Text style={[s.muted, { fontSize: 12, marginTop: 12 }]}>Server: {session.base}</Text>
      </View>
      <Btn title="Log out" kind="alt" onPress={logout} />
    </View>
  ) : <Gate onLogin={() => setLoginPrompt(true)} />;

  const tabs = [['shop', '🏠', 'Shop'], ['cart', '🛒', 'Basket'], ['orders', '📦', 'Orders'], ['account', '👤', user ? 'Account' : 'Log in']];
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      {!inProduct && (
        <LinearGradient colors={[C.brandDark, C.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.top, { paddingTop: TOP + 10 }]}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '500' }}>Mini<Text style={{ color: C.accent, fontWeight: '900' }}>Market</Text></Text>
          {user && <Text style={{ color: '#c7d2fe' }}>Hi, {user.name.split(' ')[0]} 👋</Text>}
        </LinearGradient>
      )}
      <View style={{ flex: 1 }}>{body}</View>
      <View style={s.tabbar}>
        {tabs.map(([id, icon, label]) => {
          const on = tab === id && !inProduct ? true : tab === id;
          return (
            <Pressable key={id} style={s.tab} onPress={() => { setTab(id); setCheckout(false); if (id !== 'orders') setThanks(false); if (id === 'shop') setProductId(null); }}>
              <View style={[s.tabIcon, on && { backgroundColor: '#eef0ff' }]}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
              <Text style={[s.tabTxt, on && { color: C.brand, fontWeight: '800' }]}>{label}</Text>
              {id === 'cart' && cartCount > 0 && <Text style={s.badge}>{cartCount}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontSize: 22, fontWeight: '800', color: C.ink }, screenTitle: { fontSize: 24, fontWeight: '900', color: C.ink, marginVertical: 8, marginLeft: 4 },
  label: { fontWeight: '700', marginTop: 12, marginBottom: 6, color: C.ink },
  input: { minHeight: 48, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#f9fafb', color: C.ink },
  btn: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, btnTxt: { fontWeight: '800', fontSize: 16 },
  err: { color: C.red, marginTop: 10, fontWeight: '600' }, muted: { color: C.muted }, small: { fontSize: 13, color: '#4b5563', marginTop: 1 },
  hint: { backgroundColor: '#eef2ff', padding: 12, borderRadius: 12, color: C.brandDark, overflow: 'hidden' },
  banner: { backgroundColor: '#dcfce7', color: '#166534', padding: 12, marginBottom: 12, borderRadius: 12, overflow: 'hidden', fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12, ...shadow },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#eef0ff', alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 20, padding: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'center', ...shadow },
  heroT: { color: '#fff', fontSize: 22, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, marginBottom: 12, ...shadow },
  chip: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand }, chipTxt: { fontWeight: '700', color: C.ink },
  skel: { flex: 1, height: 250, borderRadius: 18, backgroundColor: '#e5e7f0' },
  pcard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 12, ...shadow },
  pimg: { width: '100%', aspectRatio: 1 },
  price: { fontWeight: '900', fontSize: 18, color: C.ink }, was: { color: C.muted, textDecorationLine: 'line-through' },
  off: { position: 'absolute', zIndex: 5, top: 8, left: 8, backgroundColor: C.red, color: '#fff', fontWeight: '800', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  floatBtn: { position: 'absolute', left: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 6, marginTop: TOP, ...shadow },
  dotsOver: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -20, padding: 18 },
  pTitle: { fontSize: 24, fontWeight: '900', color: C.ink, marginTop: 4 },
  groupTitle: { fontWeight: '800', marginBottom: 10, fontSize: 15, color: C.ink }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchOuter: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#0002', alignItems: 'center', justifyContent: 'center' },
  choice: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center' },
  choiceOn: { borderColor: C.brand, backgroundColor: '#eef0ff' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginVertical: 20, ...shadow }, srow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', padding: 12, flexDirection: 'row', alignItems: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, elevation: 12 },
  qty: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12 },
  qtyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, qtyTxt: { fontSize: 22, fontWeight: '700', color: C.brand },
  pill: { fontWeight: '800', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 99, overflow: 'hidden', fontSize: 12, marginTop: 6 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  loginHead: { alignItems: 'center', paddingBottom: 56 },
  closeBtn: { position: 'absolute', right: 14, top: TOP + 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logoMark: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '500', marginTop: 10 },
  tabbar: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 18 : 4, paddingTop: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 14 },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center' }, tabIcon: { paddingHorizontal: 16, paddingVertical: 3, borderRadius: 14 },
  tabTxt: { fontSize: 11, color: C.muted, marginTop: 1 },
  badge: { position: 'absolute', top: 2, right: '24%', backgroundColor: C.red, color: '#fff', fontSize: 11, fontWeight: '800', minWidth: 18, height: 18, lineHeight: 18, textAlign: 'center', borderRadius: 9, overflow: 'hidden' },
});
