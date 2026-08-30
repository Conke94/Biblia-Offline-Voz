import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCommunication, BROADCAST_TARGET, InboxMessage } from '@/context/CommunicationContext';

type Thread = {
  peerId: string;
  peerName: string;
  last?: InboxMessage;
  queued: number;
  online: boolean;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function InboxScreen() {
  const colors = useColors();
  const router = useRouter();
  const { inbox, peers, isLoading } = useCommunication();

  const threads = useMemo<Thread[]>(() => {
    const byPeer = new Map<string, Thread>();

    // "Todos" sempre existe: é o broadcast.
    byPeer.set(BROADCAST_TARGET, { peerId: BROADCAST_TARGET, peerName: 'Todos', queued: 0, online: peers.length > 0 });

    // Contatos conectados agora, mesmo sem histórico.
    peers.forEach((peer) => {
      byPeer.set(peer.id, { peerId: peer.id, peerName: peer.name, queued: 0, online: true });
    });

    // Contatos que só existem no histórico (offline agora).
    inbox.forEach((message) => {
      const existing = byPeer.get(message.peerId);
      if (existing) {
        if (!existing.last) existing.last = message;
        if (message.delivery === 'queued') existing.queued += 1;
        return;
      }
      byPeer.set(message.peerId, {
        peerId: message.peerId,
        peerName: message.peerName,
        last: message,
        queued: message.delivery === 'queued' ? 1 : 0,
        online: false,
      });
    });

    return Array.from(byPeer.values()).sort((a, b) => {
      const at = a.last ? Date.parse(a.last.receivedAt) : 0;
      const bt = b.last ? Date.parse(b.last.receivedAt) : 0;
      return bt - at;
    });
  }, [inbox, peers]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="inbox-screen">
      <FlatList
        data={threads}
        keyExtractor={(item) => item.peerId}
        contentContainerStyle={[styles.list, { paddingBottom: 20 }]}
        renderItem={({ item }) => (
          <Pressable
            testID={`thread-${item.peerId}`}
            onPress={() => router.push(`/chat/${encodeURIComponent(item.peerId)}`)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Feather
                name={item.peerId === BROADCAST_TARGET ? 'users' : 'user'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{item.peerName}</Text>
                {item.online && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.last
                  ? `${item.last.direction === 'sent' ? 'Você: ' : ''}${item.last.text}`
                  : item.online ? 'Conectado. Nenhuma mensagem ainda.' : 'Sem mensagens'}
              </Text>
            </View>
            <View style={styles.rowEnd}>
              {item.last && <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatTime(item.last.receivedAt)}</Text>}
              {item.queued > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name="clock" size={11} color={colors.primary} />
                  <Text style={[styles.badgeText, { color: colors.foreground }]}>{item.queued}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={42} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {isLoading ? 'Abrindo conversas…' : 'Nenhuma conversa'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  preview: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3 },
  rowEnd: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 15 },
});
