import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  acceptApplication,
  applyToTask,
  cancelTask,
  completeTask,
  fetchTask,
  inviteTasker,
  startTask,
} from '../../api/tasks';
import { fetchConversations } from '../../api/conversations';
import { createPaymentIntent, confirmPayment, requestPayout } from '../../api/payments';
import { submitTaskReview } from '../../api/reviews';
import { getApiErrorMessage } from '../../api/client';
import { colors, radius, spacing } from '../../constants/theme';
import { formatCents, eurosToCents } from '../../utils/money';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import StarRating from '../../components/StarRating';
import { SimpleStatusBadge, TASK_STATUS_ORDER, TaskStatusBadge, taskStatusLabel } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import type { TasksStackParamList, MyTasksStackParamList } from '../../navigation/types';
import type { Task } from '../../types';

type Props = NativeStackScreenProps<TasksStackParamList | MyTasksStackParamList, 'TaskDetail'>;

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const taskQuery = useQuery({ queryKey: ['task', taskId], queryFn: () => fetchTask(taskId) });
  const task = taskQuery.data?.task;

  const [applyMessage, setApplyMessage] = useState('');
  const [applyPrice, setApplyPrice] = useState('');
  const [applying, setApplying] = useState(false);

  const [inviteTaskerId, setInviteTaskerId] = useState('');
  const [inviting, setInviting] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<string | null>(null);

  async function refreshTask() {
    await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  function goToPublicProfile(userId: string) {
    navigation.navigate('PublicProfile', { userId });
  }

  if (taskQuery.isLoading || !task) {
    return (
      <View style={styles.centered}>
        {taskQuery.isError ? (
          <Text style={styles.errorText}>Aufgabe konnte nicht geladen werden.</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Bitte anmelden.</Text>
      </View>
    );
  }

  const isPoster = task.posterId === user.id;
  const isAssignedTasker = task.assignedTaskerId === user.id;
  const myApplication = task.applications?.find((a) => a.taskerId === user.id);
  const canApply = !isPoster && task.status === 'POSTED' && !myApplication;
  const canSeeChat = (isPoster || isAssignedTasker) && task.status !== 'POSTED' && task.status !== 'CANCELLED';
  const isParticipant = isPoster || isAssignedTasker;

  async function handleApply() {
    const proposedCents = applyPrice.trim() ? eurosToCents(applyPrice) : null;
    if (applyPrice.trim() && proposedCents === null) {
      Alert.alert('Ungültiger Preis', 'Bitte einen gültigen Vorschlagspreis eingeben.');
      return;
    }
    setApplying(true);
    try {
      await applyToTask(task!.id, {
        message: applyMessage.trim() || undefined,
        proposedCents: proposedCents ?? undefined,
      });
      setApplyMessage('');
      setApplyPrice('');
      await refreshTask();
      Alert.alert('Bewerbung gesendet', 'Deine Bewerbung wurde übermittelt.');
    } catch (error) {
      Alert.alert('Bewerbung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setApplying(false);
    }
  }

  async function handleAccept(appId: string) {
    setActionLoading(`accept-${appId}`);
    try {
      await acceptApplication(task!.id, appId);
      await refreshTask();
    } catch (error) {
      Alert.alert('Annehmen fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleInvite() {
    if (!inviteTaskerId.trim()) {
      Alert.alert('Nutzer-ID fehlt', 'Bitte die Nutzer-ID des Helfers eingeben.');
      return;
    }
    setInviting(true);
    try {
      await inviteTasker(task!.id, inviteTaskerId.trim());
      setInviteTaskerId('');
      await refreshTask();
      Alert.alert('Einladung gesendet', 'Der Helfer wurde eingeladen.');
    } catch (error) {
      Alert.alert('Einladung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setInviting(false);
    }
  }

  async function handleStart() {
    setActionLoading('start');
    try {
      await startTask(task!.id);
      await refreshTask();
    } catch (error) {
      Alert.alert('Fehler', getApiErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete() {
    setActionLoading('complete');
    try {
      await completeTask(task!.id);
      await refreshTask();
    } catch (error) {
      Alert.alert('Fehler', getApiErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    Alert.alert('Aufgabe stornieren?', 'Dies kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Stornieren',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('cancel');
          try {
            await cancelTask(task!.id);
            await refreshTask();
          } catch (error) {
            Alert.alert('Fehler', getApiErrorMessage(error));
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handlePay() {
    setActionLoading('pay');
    try {
      const { payment, testMode } = await createPaymentIntent(task!.id);
      await confirmPayment(payment.id);
      setPaid(true);
      Alert.alert(
        testMode ? 'Zahlung erfolgreich (Testmodus)' : 'Zahlung erfolgreich',
        'Die Zahlung wurde simuliert und als bezahlt markiert.'
      );
    } catch (error) {
      Alert.alert('Zahlung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePayout() {
    setActionLoading('payout');
    try {
      const { payoutCents } = await requestPayout(task!.id);
      setPayoutInfo(`Auszahlung angefordert: ${formatCents(payoutCents)} (nach Plattformgebühr)`);
    } catch (error) {
      Alert.alert('Auszahlung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubmitReview() {
    setSubmittingReview(true);
    try {
      await submitTaskReview(task!.id, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
        isAnonymous: reviewAnonymous,
      });
      setReviewSubmitted(true);
      Alert.alert('Danke!', 'Deine Bewertung wurde gespeichert.');
    } catch (error) {
      Alert.alert('Bewertung fehlgeschlagen', getApiErrorMessage(error));
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleOpenChat() {
    setOpeningChat(true);
    try {
      const { conversations } = await fetchConversations();
      const conversation = conversations.find((c) => c.taskId === task!.id);
      if (!conversation) {
        Alert.alert('Kein Chat gefunden', 'Für diese Aufgabe existiert noch keine Unterhaltung.');
        return;
      }
      // Cross-tab navigation: TaskDetail lives inside the Aufgaben/Meine-Aufgaben
      // stacks, but chat lives on the Nachrichten tab.
      const parent = navigation.getParent();
      (parent as unknown as { navigate: (name: string, params?: object) => void } | undefined)?.navigate('ChatTab', {
        screen: 'Chat',
        params: { conversationId: conversation.id, title: task!.title },
      });
    } catch (error) {
      Alert.alert('Fehler', getApiErrorMessage(error));
    } finally {
      setOpeningChat(false);
    }
  }

  const stepperSteps: Task['status'][] = TASK_STATUS_ORDER;
  const currentStepIndex = stepperSteps.indexOf(task.status);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{task.title}</Text>
        <TaskStatusBadge status={task.status} />
      </View>

      {task.status === 'CANCELLED' ? (
        <Text style={styles.cancelledNote}>Diese Aufgabe wurde storniert.</Text>
      ) : (
        <View style={styles.stepper}>
          {stepperSteps.map((step, index) => (
            <View key={step} style={styles.stepperItem}>
              <View style={[styles.stepDot, index <= currentStepIndex && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, index <= currentStepIndex && styles.stepLabelActive]}>
                {taskStatusLabel(step)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Beschreibung</Text>
        <Text style={styles.description}>{task.description}</Text>

        <View style={styles.metaGrid}>
          <MetaItem label="Kategorie" value={task.category?.name ?? '—'} />
          <MetaItem label="Stadt" value={task.city} />
          <MetaItem label="Budget" value={formatCents(task.budgetCents)} />
          {task.address ? <MetaItem label="Adresse" value={task.address} /> : null}
          {task.scheduledAt ? <MetaItem label="Termin" value={new Date(task.scheduledAt).toLocaleString('de-DE')} /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Auftraggeber</Text>
        <Text style={styles.linkText} onPress={() => task.poster && goToPublicProfile(task.poster.id)}>
          {task.poster ? `${task.poster.firstName} ${task.poster.lastName}` : 'Unbekannt'}
        </Text>
        {task.assignedTasker ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>Zugewiesener Helfer</Text>
            <Text style={styles.linkText} onPress={() => task.assignedTasker && goToPublicProfile(task.assignedTasker.id)}>
              {`${task.assignedTasker.firstName} ${task.assignedTasker.lastName}`}
            </Text>
          </>
        ) : null}
      </View>

      {canSeeChat ? (
        <Button title="Chat öffnen" variant="outline" onPress={handleOpenChat} loading={openingChat} style={{ marginBottom: spacing.md }} />
      ) : null}

      {canApply ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Bewerben</Text>
          <TextField
            placeholder="Nachricht an den Auftraggeber (optional)"
            value={applyMessage}
            onChangeText={setApplyMessage}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />
          <TextField
            placeholder="Vorschlagspreis in € (optional)"
            keyboardType="decimal-pad"
            value={applyPrice}
            onChangeText={setApplyPrice}
          />
          <Button title="Bewerbung senden" onPress={handleApply} loading={applying} />
        </View>
      ) : myApplication ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Deine Bewerbung</Text>
          <SimpleStatusBadge status={myApplication.status} />
          {myApplication.message ? <Text style={styles.description}>{myApplication.message}</Text> : null}
        </View>
      ) : null}

      {isPoster ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Bewerbungen ({task.applications?.length ?? 0})</Text>
          {(task.applications ?? []).length === 0 ? (
            <Text style={styles.mutedText}>Noch keine Bewerbungen.</Text>
          ) : (
            task.applications?.map((application) => (
              <View key={application.id} style={styles.applicationRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.linkText}
                    onPress={() => application.tasker && goToPublicProfile(application.tasker.id)}
                  >
                    {application.tasker ? `${application.tasker.firstName} ${application.tasker.lastName}` : 'Helfer'}
                  </Text>
                  {application.message ? <Text style={styles.mutedText}>{application.message}</Text> : null}
                  {application.proposedCents ? (
                    <Text style={styles.mutedText}>Vorschlag: {formatCents(application.proposedCents)}</Text>
                  ) : null}
                  <SimpleStatusBadge status={application.status} />
                </View>
                {task.status === 'POSTED' && application.status === 'PENDING' ? (
                  <Button
                    title="Annehmen"
                    onPress={() => handleAccept(application.id)}
                    loading={actionLoading === `accept-${application.id}`}
                    style={styles.smallButton}
                  />
                ) : null}
              </View>
            ))
          )}

          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Helfer einladen</Text>
          <Text style={styles.mutedText}>
            Vereinfachung: Einladung erfolgt per Nutzer-ID (keine Nutzersuche in dieser Version).
          </Text>
          <TextField placeholder="Nutzer-ID des Helfers" value={inviteTaskerId} onChangeText={setInviteTaskerId} />
          <Button title="Einladen" variant="outline" onPress={handleInvite} loading={inviting} />

          {(task.invitations ?? []).length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              {task.invitations?.map((invitation) => (
                <View key={invitation.id} style={styles.applicationRow}>
                  <Text style={styles.mutedText}>
                    {invitation.tasker ? `${invitation.tasker.firstName} ${invitation.tasker.lastName}` : invitation.taskerId}
                  </Text>
                  <SimpleStatusBadge status={invitation.status} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {isPoster && task.status === 'ASSIGNED' ? (
          <Button
            title={paid ? 'Bezahlt ✓ (Testmodus)' : 'Jetzt bezahlen (Testmodus)'}
            onPress={handlePay}
            loading={actionLoading === 'pay'}
            disabled={paid}
          />
        ) : null}
        {(isPoster || isAssignedTasker) && task.status === 'ASSIGNED' ? (
          <Button title="Aufgabe starten" variant="outline" onPress={handleStart} loading={actionLoading === 'start'} />
        ) : null}
        {isPoster && task.status === 'IN_PROGRESS' ? (
          <Button title="Als erledigt markieren" onPress={handleComplete} loading={actionLoading === 'complete'} />
        ) : null}
        {isPoster && (task.status === 'POSTED' || task.status === 'ASSIGNED') ? (
          <Button title="Aufgabe stornieren" variant="danger" onPress={handleCancel} loading={actionLoading === 'cancel'} />
        ) : null}
      </View>

      {task.status === 'COMPLETED' && isParticipant ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Bewertung abgeben</Text>
          {reviewSubmitted ? (
            <Text style={styles.mutedText}>Danke für deine Bewertung!</Text>
          ) : (
            <>
              <StarRating rating={reviewRating} onChange={setReviewRating} />
              <TextField
                placeholder="Kommentar (optional)"
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { marginTop: spacing.sm }]}
              />
              <View style={styles.switchRow}>
                <Text style={styles.mutedText}>Anonym bewerten</Text>
                <Switch value={reviewAnonymous} onValueChange={setReviewAnonymous} trackColor={{ true: colors.primary }} />
              </View>
              <Button title="Bewertung senden" onPress={handleSubmitReview} loading={submittingReview} />
            </>
          )}

          {isAssignedTasker ? (
            <>
              <Button
                title="Auszahlung anfordern"
                variant="outline"
                onPress={handlePayout}
                loading={actionLoading === 'payout'}
                style={{ marginTop: spacing.md }}
              />
              {payoutInfo ? <Text style={styles.mutedText}>{payoutInfo}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { color: colors.textMuted },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 },
  cancelledNote: { color: colors.danger, marginTop: spacing.sm, fontWeight: '600' },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  stepperItem: { flex: 1, alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  stepLabelActive: { color: colors.primary, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  description: { fontSize: 14, color: colors.text, lineHeight: 20 },
  metaGrid: { marginTop: spacing.sm, gap: 6 },
  metaItem: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { color: colors.textMuted, fontSize: 13 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  mutedText: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  applicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  smallButton: { paddingVertical: 8, paddingHorizontal: spacing.md, minHeight: 0 },
  actionsRow: { gap: spacing.sm, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
});
