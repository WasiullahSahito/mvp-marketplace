import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, s } from '../lib/theme';

// Log in, or create a buyer account. (Sellers and admins use the web app.)
export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { role: 'buyer', display_name: name } } });
    setBusy(false);
    if (error) setError(error.message); // on success the AuthProvider swaps to the shop
  }

  return (
    <View style={[s.pad, { gap: 12, flex: 1, justifyContent: 'center' }]}>
      <Text style={s.h1}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>
      {mode === 'signup' && <TextInput style={s.input} placeholder="Your name" value={name} onChangeText={setName} />}
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {!!error && <Text style={s.error}>{error}</Text>}
      <Pressable style={[s.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{mode === 'login' ? 'Log in' : 'Sign up'}</Text>}
      </Pressable>
      <Pressable style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
      </Pressable>
    </View>
  );
}
