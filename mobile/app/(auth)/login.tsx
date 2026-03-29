import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Check your email for a confirmation link!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>↓</Text>
          </View>
          <Text style={styles.logo}>SaveIt</Text>
          <Text style={styles.tagline}>Curate your personal gallery of inspiration.</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>
              Log In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>
              Sign Up
            </Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#737686"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, { marginBottom: 0, flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor="#737686"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeIcon}>{showPassword ? '◉' : '◎'}</Text>
            </Pressable>
          </View>

          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : 'Continue'}
            </Text>
            {!loading && <Text style={styles.buttonArrow}>→</Text>}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google OAuth */}
        <TouchableOpacity style={styles.googleButton} activeOpacity={0.9}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to the SaveIt Terms of Service and Privacy Policy.
        </Text>
      </View>

      {/* Top gradient bar */}
      <View style={styles.topBar} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#2563eb',
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  logoIconText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  logo: { fontSize: 32, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 15, color: '#434655', textAlign: 'center', fontWeight: '500' },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#e7e8e9',
    borderRadius: 9999,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: { fontSize: 14, fontWeight: '600', color: '#434655' },
  modeButtonTextActive: { color: '#191c1d' },

  form: {},
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#434655',
    letterSpacing: 2,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f3f4f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#191c1d',
    borderWidth: 0,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f5',
    borderRadius: 12,
    marginBottom: 8,
  },
  eyeButton: { paddingHorizontal: 16 },
  eyeIcon: { fontSize: 20, color: '#434655' },

  forgotRow: { alignItems: 'flex-end', marginBottom: 16 },
  forgotText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },

  button: {
    backgroundColor: '#2563eb',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonArrow: { color: '#fff', fontSize: 18, fontWeight: '600' },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e1e3e4' },
  dividerText: { marginHorizontal: 16, fontSize: 10, fontWeight: '700', color: '#737686', letterSpacing: 2 },

  googleButton: {
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(195,198,215,0.3)',
  },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#191c1d' },

  terms: {
    fontSize: 12,
    color: '#434655',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
