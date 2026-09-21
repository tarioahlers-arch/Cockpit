import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../api/client';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, spacing } from '../../constants/theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Angaben fehlen', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      Alert.alert('Anmeldung fehlgeschlagen', getApiErrorMessage(error, 'E-Mail oder Passwort ist falsch.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require('../../../assets/icon.png')} style={styles.logoImage} />
        <Text style={styles.subtitle}>Melde dich an, um Aufgaben zu finden oder zu vergeben.</Text>

        <TextField
          label="E-Mail"
          placeholder="du@beispiel.de"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="Passwort"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button title="Anmelden" onPress={handleSubmit} loading={submitting} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Noch kein Konto?</Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
            Registrieren
          </Text>
        </View>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo-Zugänge (Passwort: Passwort123!)</Text>
          <Text style={styles.demoLine}>kunde@halpinghand.de</Text>
          <Text style={styles.demoLine}>helfer1@halpinghand.de</Text>
          <Text style={styles.demoLine}>helfer2@halpinghand.de</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  logoImage: { width: 88, height: 88, borderRadius: 20, alignSelf: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  footerText: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '700' },
  demoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  demoTitle: { fontWeight: '700', color: colors.primaryDark, marginBottom: 4, fontSize: 12 },
  demoLine: { color: colors.primaryDark, fontSize: 12 },
});
