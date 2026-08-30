import React, { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useColors } from '@/hooks/useColors';
import { useCommunication, InboxMessage } from '@/context/CommunicationContext';

function InboxCard({ item }: { item: InboxMessage }) {
  const colors = useColors();
  const { deleteMessage } = useCommunication();
  const [speaking, setSpeaking] = useState(false);
  const play = () => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(item.text, { language: 'pt-BR', onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  useEffect(() => () => { Speech.stop(); }, []);
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.messageText, { color: colors.foreground }]}>{item.text}</Text>
    <Text style={[styles.date, { color: colors.mutedForeground }]}>{new Date(item.receivedAt).toLocaleString('pt-BR')}</Text>
    <View style={styles.cardActions}>
      <Pressable testID={`play-message-${item.id}`} onPress={play} style={styles.iconButton}><Feather name={speaking ? "volume-2" : "play-circle"} size={23} color={colors.primary} /></Pressable>
      <Pressable testID={`delete-message-${item.id}`} onPress={() => deleteMessage(item.id)} style={styles.iconButton}><Feather name="trash-2" size={21} color={colors.destructive} /></Pressable>
    </View>
  </View>;
}

export default function InboxScreen() {
  const colors = useColors();
  const { inbox, isLoading } = useCommunication();
  return <View style={[styles.container, { backgroundColor: colors.background }]} testID="inbox-screen">
    <FlatList data={inbox} keyExtractor={(item) => item.id} renderItem={({ item }) => <InboxCard item={item} />}
      contentContainerStyle={[styles.list, inbox.length === 0 && styles.emptyList, { paddingBottom: Platform.OS === 'web' ? 34 : 20 }]}
      ListEmptyComponent={<View style={styles.empty}><Feather name="inbox" size={42} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isLoading ? 'Abrindo mensagens…' : 'Sua caixa está vazia'}</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Mensagens recebidas por Nearby aparecem aqui. A caixa guarda até 10 mensagens.</Text></View>}
    />
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, list: { padding: 20, gap: 12 }, emptyList: { flexGrow: 1, justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 }, messageText: { fontSize: 16, lineHeight: 23, fontFamily: 'Inter_400Regular' }, date: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 12 },
  cardActions: { flexDirection: 'row', gap: 18, marginTop: 12 }, iconButton: { padding: 4 },
  empty: { alignItems: 'center', paddingHorizontal: 30 }, emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 15 }, emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 7 },
});