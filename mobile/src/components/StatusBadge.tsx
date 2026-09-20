import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import type { ApplicationStatus, InvitationStatus, TaskStatus } from '../types';

const TASK_LABELS: Record<TaskStatus, string> = {
  POSTED: 'Gepostet',
  ASSIGNED: 'Zugewiesen',
  IN_PROGRESS: 'In Bearbeitung',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
};

const TASK_COLORS: Record<TaskStatus, string> = {
  POSTED: colors.info,
  ASSIGNED: colors.warning,
  IN_PROGRESS: colors.primary,
  COMPLETED: '#166534',
  CANCELLED: colors.danger,
};

const APPLICATION_LABELS: Record<ApplicationStatus | InvitationStatus, string> = {
  PENDING: 'Ausstehend',
  ACCEPTED: 'Angenommen',
  DECLINED: 'Abgelehnt',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${TASK_COLORS[status]}1A` }]}>
      <Text style={[styles.text, { color: TASK_COLORS[status] }]}>{TASK_LABELS[status]}</Text>
    </View>
  );
}

export function SimpleStatusBadge({ status }: { status: ApplicationStatus | InvitationStatus }) {
  const color = status === 'ACCEPTED' ? colors.success : status === 'DECLINED' ? colors.danger : colors.warning;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.text, { color }]}>{APPLICATION_LABELS[status]}</Text>
    </View>
  );
}

export const taskStatusLabel = (status: TaskStatus): string => TASK_LABELS[status];
export const TASK_STATUS_ORDER: TaskStatus[] = ['POSTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
