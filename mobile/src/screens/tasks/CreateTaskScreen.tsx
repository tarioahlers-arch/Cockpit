import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchCategories } from '../../api/categories';
import { createTask } from '../../api/tasks';
import { getApiErrorMessage } from '../../api/client';
import { GERMAN_CITIES } from '../../constants/cities';
import { colors, spacing } from '../../constants/theme';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import SelectField from '../../components/SelectField';
import type { TasksStackParamList } from '../../navigation/types';
import { eurosToCents } from '../../utils/money';

type Props = NativeStackScreenProps<TasksStackParamList, 'CreateTask'>;

export default function CreateTaskScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [scheduledDate, setScheduledDate] = useState(''); // free-text date, e.g. 2026-10-01
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = (categoriesQuery.data?.categories ?? []).map((c) => ({ label: c.name, value: c.id }));
  const cityOptions = GERMAN_CITIES.map((c) => ({ label: c, value: c }));

  async function handleSubmit() {
    const budgetCents = eurosToCents(budget);
    if (!title.trim() || !description.trim() || !categoryId || !city || budgetCents === null || budgetCents <= 0) {
      Alert.alert('Angaben unvollständig', 'Bitte Titel, Beschreibung, Kategorie, Stadt und ein gültiges Budget angeben.');
      return;
    }

    let scheduledAt: string | undefined;
    if (scheduledDate.trim()) {
      const parsed = new Date(scheduledDate.trim());
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert('Ungültiges Datum', 'Bitte das Datum im Format JJJJ-MM-TT eingeben, z. B. 2026-10-01.');
        return;
      }
      scheduledAt = parsed.toISOString();
    }

    setSubmitting(true);
    try {
      const { task } = await createTask({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        city,
        address: address.trim() || undefined,
        budgetCents,
        scheduledAt,
      });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      navigation.replace('TaskDetail', { taskId: task.id });
    } catch (error) {
      Alert.alert('Erstellen fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Neue Aufgabe erstellen</Text>

        <TextField label="Titel" placeholder="z. B. Sofa transportieren" value={title} onChangeText={setTitle} />
        <TextField
          label="Beschreibung"
          placeholder="Beschreibe, was zu tun ist…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />
        <SelectField label="Kategorie" placeholder="Kategorie wählen" value={categoryId} options={categoryOptions} onChange={setCategoryId} />
        <SelectField label="Stadt" placeholder="Stadt wählen" value={city} options={cityOptions} onChange={setCity} />
        <TextField label="Adresse (optional)" placeholder="Straße, Hausnummer" value={address} onChangeText={setAddress} />
        <TextField label="Budget (€)" placeholder="z. B. 60" keyboardType="decimal-pad" value={budget} onChangeText={setBudget} />
        <TextField
          label="Termin (optional, JJJJ-MM-TT)"
          placeholder="2026-10-01"
          value={scheduledDate}
          onChangeText={setScheduledDate}
        />

        <Button title="Aufgabe veröffentlichen" onPress={handleSubmit} loading={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  heading: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
});
