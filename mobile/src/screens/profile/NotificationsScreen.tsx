import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import { colors, radius, spacing } from '../../constants/theme';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import type { AppNotification } from '../../types';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const notifications = query.data?.notifications ?? [];

  return (
    <View style={styles.container}>
      {notifications.some((n) => !n.readAt) ? (
        <Button title="Alle als gelesen markieren" variant="outline" onPress={handleMarkAllRead} style={styles.markAllButton} />
      ) : null}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="Keine Benachrichtigungen" />}
        renderItem={({ item }) => <NotificationRow notification={item} onPress={() => !item.readAt && handleMarkRead(item.id)} />}
      />
    </View>
  );
}

function NotificationRow({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const label = notification.title ?? notification.body ?? notification.message ?? notification.type;
  const isRead = Boolean(notification.readAt);
  return (
    <Pressable style={[styles.row, !isRead && styles.rowUnread]} onPress={onPress}>
      {!isRead ? <View style={styles.dot} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, !isRead && styles.labelUnread]}>{label}</Text>
        {notification.body && notification.title ? <Text style={styles.body}>{notification.body}</Text> : null}
        <Text style={styles.time}>{new Date(notification.createdAt).toLocaleString('de-DE')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  markAllButton: { margin: spacing.md, marginBottom: 0 },
  listContent: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  rowUnread: { borderColor: colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  label: { fontSize: 14, color: colors.text },
  labelUnread: { fontWeight: '700' },
  body: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
