import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchCategories } from '../../api/categories';
import { stripeConnectOnboard, taskerOnboarding, updateMe } from '../../api/users';
import { fetchNotifications } from '../../api/notifications';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { colors, radius, spacing } from '../../constants/theme';
import { centsToEuroInput, eurosToCents, formatCents } from '../../utils/money';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import type { ProfileStackParamList } from '../../navigation/types';
import type { AppNotification } from '../../types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout, setUser } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  useEffect(() => {
    if (!socket) return;
    function onNotification(_notification: AppNotification) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [socket, queryClient]);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [hourlyRate, setHourlyRate] = useState(centsToEuroInput(user?.hourlyRate));
  const [radiusKm, setRadiusKm] = useState(user?.radiusKm ? String(user.radiusKm) : '');
  const [taskerBio, setTaskerBio] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);

  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Nicht angemeldet.</Text>
      </View>
    );
  }

  function startEditing() {
    setFirstName(user!.firstName);
    setLastName(user!.lastName);
    setPhone(user!.phone ?? '');
    setCity(user!.city ?? '');
    setBio(user!.bio ?? '');
    setEditing(true);
  }

  async function handleSaveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Angaben fehlen', 'Vor- und Nachname dürfen nicht leer sein.');
      return;
    }
    setSavingProfile(true);
    try {
      const { user: updated } = await updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      await setUser(updated);
      setEditing(false);
    } catch (error) {
      Alert.alert('Speichern fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleTaskerOnboarding() {
    const rateCents = eurosToCents(hourlyRate);
    const radiusKmValue = Number(radiusKm);
    if (rateCents === null || rateCents <= 0) {
      Alert.alert('Ungültiger Stundensatz', 'Bitte einen gültigen Stundensatz in € angeben.');
      return;
    }
    if (!radiusKm.trim() || Number.isNaN(radiusKmValue) || radiusKmValue <= 0) {
      Alert.alert('Ungültiger Radius', 'Bitte einen gültigen Radius in km angeben.');
      return;
    }
    if (selectedCategoryIds.length === 0) {
      Alert.alert('Kategorien fehlen', 'Bitte mindestens eine Kategorie auswählen.');
      return;
    }
    setSubmittingOnboarding(true);
    try {
      const { user: updated } = await taskerOnboarding({
        hourlyRate: rateCents,
        radiusKm: radiusKmValue,
        categoryIds: selectedCategoryIds,
        bio: taskerBio.trim() || undefined,
      });
      await setUser(updated);
      Alert.alert('Geschafft!', 'Du bist jetzt als Helfer aktiv.');
    } catch (error) {
      Alert.alert('Fehler', getApiErrorMessage(error));
    } finally {
      setSubmittingOnboarding(false);
    }
  }

  async function handleStripeConnect() {
    setConnectingStripe(true);
    try {
      await stripeConnectOnboard();
      setStripeConnected(true);
    } catch (error) {
      Alert.alert('Verbindung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setConnectingStripe(false);
    }
  }

  function handleLogout() {
    Alert.alert('Abmelden?', undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => logout() },
    ]);
  }

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const categories = categoriesQuery.data?.categories ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} size={72} />
        <Text style={styles.name}>
          {user.firstName} {user.lastName}
        </Text>
        <Text style={styles.muted}>{user.email}</Text>
        {!user.emailVerified ? <Text style={styles.warningText}>E-Mail nicht bestätigt</Text> : null}
      </View>

      <Pressable style={styles.notificationRow} onPress={() => navigation.navigate('Notifications')}>
        <Text style={styles.notificationLabel}>Benachrichtigungen</Text>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>Keine neuen</Text>
        )}
      </Pressable>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionLabel}>Profil</Text>
          {!editing ? <Text style={styles.link} onPress={startEditing}>Bearbeiten</Text> : null}
        </View>
        {editing ? (
          <>
            <View style={styles.row}>
              <TextField label="Vorname" value={firstName} onChangeText={setFirstName} style={styles.half} />
              <TextField label="Nachname" value={lastName} onChangeText={setLastName} style={styles.half} />
            </View>
            <TextField label="Telefon" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <TextField label="Stadt" value={city} onChangeText={setCity} />
            <TextField label="Über mich" value={bio} onChangeText={setBio} multiline numberOfLines={3} style={styles.textArea} />
            <View style={styles.row}>
              <Button title="Speichern" onPress={handleSaveProfile} loading={savingProfile} style={styles.half} />
              <Button title="Abbrechen" variant="outline" onPress={() => setEditing(false)} style={styles.half} />
            </View>
          </>
        ) : (
          <>
            <ProfileRow label="Telefon" value={user.phone ?? '—'} />
            <ProfileRow label="Stadt" value={user.city ?? '—'} />
            <ProfileRow label="Über mich" value={user.bio ?? '—'} />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{user.isTaskerOnboarded ? 'Du bist Helfer' : 'Werde Helfer'}</Text>
        {user.isTaskerOnboarded ? (
          <>
            <ProfileRow label="Stundensatz" value={user.hourlyRate ? formatCents(user.hourlyRate) : '—'} />
            <ProfileRow label="Radius" value={user.radiusKm ? `${user.radiusKm} km` : '—'} />
          </>
        ) : (
          <>
            <Text style={styles.muted}>Biete deine Fähigkeiten als Helfer an und verdiene Geld.</Text>
            <TextField label="Stundensatz (€)" keyboardType="decimal-pad" value={hourlyRate} onChangeText={setHourlyRate} />
            <TextField label="Umkreis (km)" keyboardType="number-pad" value={radiusKm} onChangeText={setRadiusKm} />
            <TextField label="Kurzbeschreibung (optional)" value={taskerBio} onChangeText={setTaskerBio} multiline numberOfLines={2} style={styles.textArea} />
            <Text style={styles.fieldLabel}>Kategorien</Text>
            <View style={styles.chipsRow}>
              {categories.map((category) => {
                const selected = selectedCategoryIds.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Als Helfer registrieren" onPress={handleTaskerOnboarding} loading={submittingOnboarding} />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Zahlungen</Text>
        <Text style={styles.muted}>Verbinde dein Konto, um Auszahlungen als Helfer zu erhalten (Testmodus, kein echtes Geld).</Text>
        <Button
          title={stripeConnected ? 'Stripe Connect verbunden ✓' : 'Stripe Connect verbinden (Testmodus)'}
          variant={stripeConnected ? 'outline' : 'primary'}
          onPress={handleStripeConnect}
          loading={connectingStripe}
          disabled={stripeConnected}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <Button title="Abmelden" variant="danger" onPress={handleLogout} style={{ marginTop: spacing.sm }} />
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  headerCard: { alignItems: 'center', paddingVertical: spacing.lg },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 13 },
  warningText: { color: colors.warning, fontSize: 12, marginTop: 4, fontWeight: '600' },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notificationLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  badge: { backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  profileValue: { color: colors.text, fontWeight: '600', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: colors.white, fontWeight: '700' },
});
