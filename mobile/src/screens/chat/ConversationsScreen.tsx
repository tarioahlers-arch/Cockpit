import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchConversations } from '../../api/conversations';
import { colors, radius, spacing } from '../../constants/theme';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import type { ChatStackParamList } from '../../navigation/types';
import type { Conversation } from '../../types';

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversations'>;

export default function ConversationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 15000,
  });

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const conversations = query.data?.conversations ?? [];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={conversations}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyState title="Noch keine Unterhaltungen" subtitle="Chats erscheinen, sobald eine Bewerbung angenommen wurde." />}
      renderItem={({ item }) => (
        <ConversationRow
          conversation={item}
          isCustomer={user?.id === item.customer.id}
          onPress={() => navigation.navigate('Chat', { conversationId: item.id, title: item.task.title })}
        />
      )}
    />
  );
}

function ConversationRow({
  conversation,
  isCustomer,
  onPress,
}: {
  conversation: Conversation;
  isCustomer: boolean;
  onPress: () => void;
}) {
  const other = isCustomer ? conversation.tasker : conversation.customer;
  const lastMessage = conversation.messages?.[0];

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar firstName={other.firstName} lastName={other.lastName} avatarUrl={other.avatarUrl} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {other.firstName} {other.lastName}
        </Text>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {conversation.task.title}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {lastMessage?.text ?? (lastMessage?.attachmentUrl ? '📎 Anhang' : 'Noch keine Nachrichten')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  listContent: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  taskTitle: { fontSize: 12, color: colors.primaryDark, marginTop: 1 },
  preview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
