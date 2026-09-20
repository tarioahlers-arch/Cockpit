import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchMyTasks, MyTasksType, respondToInvitation } from '../../api/tasks';
import { getApiErrorMessage } from '../../api/client';
import { colors, radius, spacing } from '../../constants/theme';
import { formatCents } from '../../utils/money';
import TaskCard from '../../components/TaskCard';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import { SimpleStatusBadge } from '../../components/StatusBadge';
import type { MyTasksStackParamList } from '../../navigation/types';
import type { Application, Invitation, Task } from '../../types';

type Props = NativeStackScreenProps<MyTasksStackParamList, 'MyTasksHome'>;

const SEGMENTS: { key: MyTasksType; label: string }[] = [
  { key: 'posted', label: 'Gepostet' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'invites', label: 'Einladungen' },
  { key: 'applications', label: 'Bewerbungen' },
  { key: 'completed', label: 'Abgeschlossen' },
];

export default function MyTasksScreen({ navigation }: Props) {
  const [segment, setSegment] = useState<MyTasksType>('posted');
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['myTasks', segment], queryFn: () => fetchMyTasks(segment) });

  async function handleRespond(taskId: string, invId: string, accept: boolean) {
    setRespondingId(invId);
    try {
      await respondToInvitation(taskId, invId, accept);
      await queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    } catch (error) {
      Alert.alert('Fehler', getApiErrorMessage(error));
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
        {SEGMENTS.map((seg) => (
          <Pressable
            key={seg.key}
            style={[styles.segment, segment === seg.key && styles.segmentActive]}
            onPress={() => setSegment(seg.key)}
          >
            <Text style={[styles.segmentText, segment === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {query.isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : query.isError ? (
        <EmptyState title="Konnte nicht geladen werden" subtitle="Bitte erneut versuchen." />
      ) : segment === 'invites' ? (
        <FlatList
          data={query.data?.invitations ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState title="Keine Einladungen" />}
          renderItem={({ item }) => (
            <InvitationRow
              invitation={item}
              onOpen={() => navigation.navigate('TaskDetail', { taskId: item.taskId })}
              onRespond={(accept) => handleRespond(item.taskId, item.id, accept)}
              loading={respondingId === item.id}
            />
          )}
        />
      ) : segment === 'applications' ? (
        <FlatList
          data={query.data?.applications ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState title="Keine Bewerbungen" />}
          renderItem={({ item }) => (
            <ApplicationRow application={item} onOpen={() => navigation.navigate('TaskDetail', { taskId: item.taskId })} />
          )}
        />
      ) : (
        <FlatList
          data={query.data?.tasks ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState title="Keine Aufgaben in dieser Kategorie" />}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })} />
          )}
        />
      )}
    </View>
  );
}

function InvitationRow({
  invitation,
  onOpen,
  onRespond,
  loading,
}: {
  invitation: Invitation & { task: Task };
  onOpen: () => void;
  onRespond: (accept: boolean) => void;
  loading: boolean;
}) {
  return (
    <Pressable style={styles.rowCard} onPress={onOpen}>
      <Text style={styles.rowTitle}>{invitation.task.title}</Text>
      <Text style={styles.rowMeta}>
        {invitation.task.city} · {formatCents(invitation.task.budgetCents)}
      </Text>
      <SimpleStatusBadge status={invitation.status} />
      {invitation.status === 'PENDING' ? (
        <View style={styles.inviteActions}>
          <Button title="Annehmen" onPress={() => onRespond(true)} loading={loading} style={styles.smallButton} />
          <Button title="Ablehnen" variant="outline" onPress={() => onRespond(false)} loading={loading} style={styles.smallButton} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ApplicationRow({ application, onOpen }: { application: Application & { task: Task }; onOpen: () => void }) {
  return (
    <Pressable style={styles.rowCard} onPress={onOpen}>
      <Text style={styles.rowTitle}>{application.task.title}</Text>
      <Text style={styles.rowMeta}>
        {application.task.city} · {formatCents(application.task.budgetCents)}
      </Text>
      {application.proposedCents ? (
        <Text style={styles.rowMeta}>Dein Vorschlag: {formatCents(application.proposedCents)}</Text>
      ) : null}
      <SimpleStatusBadge status={application.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  segmentTextActive: { color: colors.white },
  listContent: { padding: spacing.md, paddingBottom: 48 },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.xs },
  inviteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  smallButton: { flex: 1, paddingVertical: 10 },
});
