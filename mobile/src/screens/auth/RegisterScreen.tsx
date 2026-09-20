import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { register as registerApi, verifyEmail as verifyEmailApi, RegisterResponse } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../api/client';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, spacing } from '../../constants/theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { setSession } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Holds the just-registered session while we let the user complete the
  // (fake, dev-only) email verification step before entering the app.
  const [pendingRegistration, setPendingRegistration] = useState<RegisterResponse | null>(null);
  const [verified, setVerified] = useState(false);

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 8) {
      Alert.alert(
        'Angaben unvollständig',
        'Bitte Vorname, Nachname, E-Mail ausfüllen und ein Passwort mit mindestens 8 Zeichen wählen.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const response = await registerApi({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      });
      setPendingRegistration(response);
    } catch (error) {
      Alert.alert('Registrierung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!pendingRegistration?.devVerificationToken) return;
    setVerifying(true);
    try {
      await verifyEmailApi(pendingRegistration.devVerificationToken);
      setVerified(true);
    } catch (error) {
      Alert.alert('Verifizierung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setVerifying(false);
    }
  }

  async function handleContinue() {
    if (!pendingRegistration) return;
    // Reflect the verified flag locally if we successfully verified above;
    // otherwise the backend still knows the real state on next fetch.
    const user = verified ? { ...pendingRegistration.user, emailVerified: true } : pendingRegistration.user;
    await setSession(pendingRegistration.token, user);
  }

  if (pendingRegistration) {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.logo}>Fast geschafft!</Text>
          <Text style={styles.subtitle}>
            Da HelferHand hier keine echten E-Mails versendet, kannst du deine Adresse direkt bestätigen.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Dev-Verifizierungscode</Text>
            <Text style={styles.cardToken} selectable>
              {pendingRegistration.devVerificationToken ?? '—'}
            </Text>
            {verified ? (
              <Text style={styles.verifiedText}>✓ E-Mail-Adresse bestätigt</Text>
            ) : (
              <Button
                title={verifying ? 'Wird bestätigt…' : 'E-Mail jetzt bestätigen'}
                onPress={handleVerify}
                loading={verifying}
                style={{ marginTop: spacing.sm }}
              />
            )}
          </View>

          <Button
            title="Weiter zur App"
            variant={verified ? 'primary' : 'outline'}
            onPress={handleContinue}
            style={{ marginTop: spacing.lg }}
          />
          {!verified ? (
            <Text style={styles.skipHint}>Du kannst dies auch später in deinem Profil nachholen.</Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Konto erstellen</Text>
        <Text style={styles.subtitle}>Registriere dich kostenlos bei HelferHand.</Text>

        <View style={styles.row}>
          <TextField label="Vorname" value={firstName} onChangeText={setFirstName} style={styles.half} />
          <TextField label="Nachname" value={lastName} onChangeText={setLastName} style={styles.half} />
        </View>
        <TextField
          label="E-Mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField label="Passwort (mind. 8 Zeichen)" secureTextEntry value={password} onChangeText={setPassword} />
        <TextField label="Telefon (optional)" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextField label="Stadt (optional)" value={city} onChangeText={setCity} />

        <Button title="Registrieren" onPress={handleSubmit} loading={submitting} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Schon ein Konto?</Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Anmelden
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  logo: { fontSize: 26, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  footerText: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  cardToken: {
    fontSize: 14,
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    marginTop: 4,
  },
  verifiedText: { marginTop: spacing.sm, color: colors.success, fontWeight: '700' },
  skipHint: { marginTop: spacing.sm, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
