import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchMessages } from '../../api/conversations';
import { resolveUploadUrl, uploadFile } from '../../api/uploads';
import { getApiErrorMessage } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../constants/theme';
import type { ChatStackParamList } from '../../navigation/types';
import type { Message } from '../../types';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

const TYPING_THROTTLE_MS = 2000;
const TYPING_INDICATOR_TIMEOUT_MS = 3000;

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const { user } = useAuth();
  const socket = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMessages(conversationId)
      .then(({ messages: history }) => {
        if (!cancelled) setMessages(history);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Nachrichten konnten nicht geladen werden.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('conversation:join', conversationId);

    function onNewMessage(message: Message) {
      if (message.conversationId === conversationId) appendMessage(message);
    }
    function onTyping(payload: { userId: string }) {
      if (payload.userId === user?.id) return;
      setPeerTyping(true);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      typingClearTimer.current = setTimeout(() => setPeerTyping(false), TYPING_INDICATOR_TIMEOUT_MS);
    }

    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);

    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.off('message:new', onNewMessage);
      socket.off('typing', onTyping);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    };
  }, [socket, conversationId, appendMessage, user?.id]);

  function handleTextChange(value: string) {
    setText(value);
    const now = Date.now();
    if (socket && now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      socket.emit('typing', { conversationId });
    }
  }

  function sendViaSocket(payload: { text?: string; attachmentUrl?: string }): Promise<Message> {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Keine Verbindung zum Chat-Server.'));
        return;
      }
      socket.emit('message:send', { conversationId, ...payload }, (response: { message?: Message; error?: string }) => {
        if (response?.message) resolve(response.message);
        else reject(new Error(response?.error ?? 'Nachricht konnte nicht gesendet werden.'));
      });
    });
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const message = await sendViaSocket({ text: trimmed });
      appendMessage(message);
      setText('');
    } catch (error) {
      Alert.alert('Senden fehlgeschlagen', error instanceof Error ? error.message : 'Unbekannter Fehler');
    } finally {
      setSending(false);
    }
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Zugriff verweigert', 'Bitte erlaube den Zugriff auf deine Fotos, um ein Bild zu senden.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const upload = await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `bild-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      const message = await sendViaSocket({ attachmentUrl: upload.url });
      appendMessage(message);
    } catch (error) {
      Alert.alert('Bild konnte nicht gesendet werden', getApiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const orderedForInvertedList = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loadError ? <Text style={styles.errorBanner}>{loadError}</Text> : null}
      <FlatList
        inverted
        data={orderedForInvertedList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <MessageBubble message={item} isOwn={item.senderId === user?.id} />}
      />
      {peerTyping ? <Text style={styles.typingText}>schreibt…</Text> : null}
      <View style={styles.inputRow}>
        <Pressable style={styles.attachButton} onPress={handlePickImage} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.attachIcon}>📎</Text>}
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Nachricht schreiben…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!text.trim() || sending}>
          <Text style={styles.sendButtonText}>{sending ? '…' : 'Senden'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {message.attachmentUrl ? (
          <Image source={{ uri: resolveUploadUrl(message.attachmentUrl) }} style={styles.attachmentImage} resizeMode="cover" />
        ) : null}
        {message.text ? (
          <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{message.text}</Text>
        ) : null}
        <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
          {new Date(message.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorBanner: { backgroundColor: '#FEE2E2', color: colors.danger, padding: spacing.sm, textAlign: 'center', fontSize: 12 },
  listContent: { padding: spacing.md, gap: 8 },
  typingText: { paddingHorizontal: spacing.md, paddingBottom: 4, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: colors.text },
  bubbleTextOwn: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.75)' },
  attachmentImage: { width: 200, height: 150, borderRadius: radius.md, marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  attachButton: { padding: 10, alignItems: 'center', justifyContent: 'center' },
  attachIcon: { fontSize: 20 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
