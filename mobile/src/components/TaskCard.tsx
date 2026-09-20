import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { formatCents } from '../utils/money';
import type { Task } from '../types';
import { TaskStatusBadge } from './StatusBadge';

export default function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        <TaskStatusBadge status={task.status} />
      </View>
      <Text style={styles.meta} numberOfLines={2}>
        {task.description}
      </Text>
      <View style={styles.footerRow}>
        <Text style={styles.tag}>{task.category?.name ?? 'Sonstiges'}</Text>
        <Text style={styles.tag}>{task.city}</Text>
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.budget}>{formatCents(task.budgetCents)}</Text>
        {typeof task._count?.applications === 'number' ? (
          <Text style={styles.applications}>{task._count.applications} Bewerbungen</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  meta: { marginTop: 6, fontSize: 13, color: colors.textMuted },
  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  tag: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  budget: { fontSize: 16, fontWeight: '700', color: colors.primary },
  applications: { fontSize: 12, color: colors.textMuted },
});
