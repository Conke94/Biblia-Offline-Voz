import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCommunication } from '@/context/CommunicationContext';

/**
 * Tela de conexão. Compor mensagem vive dentro do chat (voz e teclado juntos),
 * então aqui ficou só o que é sobre estar disponível e conectado.
 */
export default function ConnectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    connectedDeviceCount, peers, localName, isNearbyAvailable, isConnecting,
    startNearby, stopNearby, error, backgroundEnabled, setBackgroundEnabled,
  } = useCommunication();

  const named = localName.trim().length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
      testID="connection-screen"
    >
      <Pressable
        testID="open-profile"
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Feather name="user" size={19} color={colors.primary} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {named ? localName : 'Defina seu nome'}
          </Text>
          <Text style={[styles.cardDetail, { color: colors.mutedForeground }]}>
            {named ? 'É assim que você aparece para os outros. Toque para trocar.' : 'Necessário para conectar.'}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: connectedDeviceCount > 0 ? colors.muted : colors.secondary }]}>
          <Feather name={connectedDeviceCount > 0 ? 'radio' : 'wifi-off'} size={19} color={colors.primary} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {connectedDeviceCount > 0
              ? `${connectedDeviceCount} conectado${connectedDeviceCount === 1 ? '' : 's'}`
              : 'Nenhum aparelho conectado'}
          </Text>
          <Text style={[styles.cardDetail, { color: colors.mutedForeground }]}>
            {isNearbyAvailable ? 'Comunicação local, sem internet' : 'Indisponível neste Preview'}
          </Text>
        </View>
        {isNearbyAvailable && (
          <Pressable
            testID="start-nearby"
            disabled={isConnecting}
            onPress={() => {
              if (!named) return router.push('/profile');
              return connectedDeviceCount > 0 ? void stopNearby() : void startNearby();
            }}
            style={({ pressed }) => [styles.smallButton, { borderColor: colors.primary, opacity: isConnecting ? 0.55 : pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.smallButtonText, { color: colors.foreground }]}>
              {isConnecting ? 'Buscando' : !named ? 'Definir nome' : connectedDeviceCount > 0 ? 'Desligar' : 'Conectar'}
            </Text>
          </Pressable>
        )}
      </View>

      {isNearbyAvailable && (
        <Pressable
          testID="toggle-background"
          onPress={() => void setBackgroundEnabled(!backgroundEnabled)}
          style={({ pressed }) => [styles.card, {
            backgroundColor: backgroundEnabled ? colors.muted : colors.card,
            borderColor: backgroundEnabled ? colors.primary : colors.border,
            opacity: pressed ? 0.85 : 1,
          }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name={backgroundEnabled ? 'bell' : 'bell-off'} size={19} color={colors.primary} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {backgroundEnabled ? 'Disponível com o app fechado' : 'Ficar disponível com o app fechado'}
            </Text>
            <Text style={[styles.cardDetail, { color: colors.mutedForeground }]}>
              {backgroundEnabled
                ? 'Notificação fixa ativa. Toque para desligar.'
                : 'Continua recebendo e avisando. Gasta mais bateria.'}
            </Text>
          </View>
        </Pressable>
      )}

      {peers.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONECTADOS AGORA</Text>
          {peers.map((peer) => (
            <Pressable
              key={peer.id}
              testID={`peer-${peer.id}`}
              onPress={() => router.push(`/chat/${encodeURIComponent(peer.id)}`)}
              style={({ pressed }) => [styles.peerRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.peerName, { color: colors.foreground }]}>{peer.name}</Text>
              <Feather name="message-circle" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      )}

      {error && (
        <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]} testID="connection-error">
          <Feather name="alert-circle" size={19} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>{error}</Text>
        </View>
      )}

      <Pressable
        testID="open-conversations"
        onPress={() => router.push('/inbox')}
        style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.72 : 1 }]}
      >
        <Feather name="message-circle" size={18} color={colors.primaryForeground} />
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Abrir conversas</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  cardDetail: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
  smallButton: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  smallButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  section: { gap: 8, marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  peerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  peerName: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  notice: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 13 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  primaryButton: { marginTop: 6, minHeight: 50, borderRadius: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
