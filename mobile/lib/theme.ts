import { StyleSheet } from 'react-native';

export const colors = { primary: '#4338ca', primaryLight: '#eef2ff', text: '#1c1917', muted: '#78716c', border: '#d6d3d1', bg: '#fafaf9', danger: '#be123c' };

// Shared styles. Every tappable thing is at least 48px high (44px minimum for touch).
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', fontSize: 16 },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e7e5e4', padding: 14 },
  error: { color: colors.danger, backgroundColor: '#fff1f2', padding: 10, borderRadius: 8 },
});
