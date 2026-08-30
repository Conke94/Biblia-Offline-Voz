import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Speech from 'expo-speech';
import { useColors } from '@/hooks/useColors';
import { useCommunication, BROADCAST_TARGET, InboxMessage } from '@/context/CommunicationContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Bubble({ item }: { item: InboxMessage }) {
  const colors = useColors();
  const { deleteMessage } = useCommunication();
  const [speaking, setSpeaking] = useState(false);
  const isSent = item.direction === 'sent';

  const play = () => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(item.text, {
      language: 'pt-BR',
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };
  useEffect(() => () => { Speech.stop(); }, []);

  return (
    <View style={[styles.row, isSent ? styles.rowSent : styles.rowReceived]}>
      <View
        testID={`message-${item.id}`}
        style={[
          styles.bubble,
          isSent
            ? { backgroundColor: colors.primary, borderColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.card, borderColor: colors.border, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.messageText, { color: isSent ? colors.primaryForeground : colors.foreground }]}>{item.text}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.date, { color: isSent ? colors.primaryForeground : colors.mutedForeground, opacity: isSent ? 0.8 : 1 }]}>
            {formatTime(item.receivedAt)}
          </Text>
          {isSent && (
            <Feather
              name={item.delivery === 'queued' ? 'clock' : 'check'}
              size={13}
              color={colors.primaryForeground}
              style={{ opacity: 0.85 }}
            />
          )}
        </View>
        <View style={styles.actions}>
          <Pressable testID={`play-message-${item.id}`} onPress={play} style={styles.iconButton} hitSlop={8}>
            <Feather name={speaking ? 'volume-2' : 'play-circle'} size={21} color={isSent ? colors.primaryForeground : colors.primary} />
          </Pressable>
          <Pressable testID={`delete-message-${item.id}`} onPress={() => deleteMessage(item.id)} style={styles.iconButton} hitSlop={8}>
            <Feather name="trash-2" size={19} color={isSent ? colors.primaryForeground : colors.destructive} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { peerId: rawPeerId } = useLocalSearchParams<{ peerId: string }>();
  const peerId = decodeURIComponent(rawPeerId ?? BROADCAST_TARGET);
  const colors = useColors();
  const navigation = useNavigation();
  const { messagesFor, peers, inbox, sendText, connectedDeviceCount } = useCommunication();
  const [draft, setDraft] = useState('');
  // Voz alimenta o mesmo rascunho do teclado: a pessoa pode falar e depois
  // corrigir digitando antes de enviar.
  const voice = useVoiceInput((text) => setDraft((current) => `${current} ${text}`.trim()));

  const messages = messagesFor(peerId);
  const online = peerId === BROADCAST_TARGET ? connectedDeviceCount > 0 : peers.some((p) => p.id === peerId);

  const peerName = useMemo(() => {
    if (peerId === BROADCAST_TARGET) return 'Todos';
    return peers.find((p) => p.id === peerId)?.name
      ?? inbox.find((m) => m.peerId === peerId)?.peerName
      ?? 'Contato';
  }, [peerId, peers, inbox]);

  useEffect(() => { navigation.setOptions({ title: peerName }); }, [navigation, peerName]);

  const canSend = draft.trim().length > 0 && (peerId !== BROADCAST_TARGET || connectedDeviceCount > 0);
  const send = async () => {
    if (!canSend) return;
    const ok = await sendText(draft, peerId, peerName);
    if (ok) setDraft('');
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.container, { backgroundColor: colors.background }]} testID="chat-screen">
      <View style={[styles.status, { backgroundColor: online ? colors.muted : colors.secondary }]}>
        <Feather name={online ? 'radio' : 'clock'} size={15} color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {online
            ? 'Conectado'
            : peerId === BROADCAST_TARGET
              ? 'Ninguém conectado. Conecte para enviar a todos.'
              : 'Fora de alcance. As mensagens ficam guardadas e saem sozinhas quando reconectar.'}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Bubble item={item} />}
        inverted={messages.length > 0}
        contentContainerStyle={[styles.list, messages.length === 0 && styles.emptyList]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={38} color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma mensagem com {peerName} ainda.</Text>
          </View>
        }
      />

      {(voice.isListening || voice.partialText.length > 0) && (
        <View style={[styles.listening, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="mic" size={15} color={colors.primary} />
          <Text style={[styles.listeningText, { color: colors.foreground }]} numberOfLines={2}>
            {voice.partialText || 'Ouvindo… até 15 segundos'}
          </Text>
        </View>
      )}
      {voice.error && (
        <View style={[styles.listening, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="alert-circle" size={15} color={colors.primary} />
          <Text style={[styles.listeningText, { color: colors.foreground }]}>{voice.error}</Text>
        </View>
      )}

      <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.card, paddingBottom: 10 }]}>
        <TextInput
          testID="chat-input"
          value={draft}
          onChangeText={setDraft}
          placeholder={online ? 'Escreva ou segure o microfone' : 'Escreva — envia quando reconectar'}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        />
        <Pressable
          testID="chat-mic"
          disabled={!voice.isSupported}
          onPressIn={() => void voice.begin()}
          onPressOut={voice.release}
          style={({ pressed }) => [
            styles.micButton,
            {
              backgroundColor: voice.isListening ? colors.foreground : colors.secondary,
              borderColor: colors.border,
              opacity: !voice.isSupported ? 0.35 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather
            name={voice.isListening ? 'mic-off' : 'mic'}
            size={19}
            color={voice.isListening ? colors.background : colors.primary}
          />
        </Pressable>
        <Pressable
          testID="chat-send"
          disabled={!canSend}
          onPress={() => void send()}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: colors.primary, opacity: !canSend ? 0.4 : pressed ? 0.72 : 1 },
          ]}
        >
          <Feather name={online ? 'send' : 'clock'} size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
  statusText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  list: { padding: 16, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', width: '100%' },
  rowSent: { justifyContent: 'flex-end' },
  rowReceived: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  messageText: { fontSize: 16, lineHeight: 23, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  date: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 7 },
  iconButton: { padding: 2 },
  empty: { alignItems: 'center', paddingHorizontal: 30 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 10 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9 },
  listeningText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  micButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, fontFamily: 'Inter_400Regular' },
  sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
