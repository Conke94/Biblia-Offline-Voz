import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCommunication } from '@/context/CommunicationContext';

/**
 * Confirmação humana do código antes de aceitar a conexão.
 *
 * O Google é explícito: conexões aceitas sem autenticação são inseguras.
 * Sem esta etapa, qualquer pessoa por perto com o mesmo APK entra no grupo.
 */
export function PairingDialog() {
  const colors = useColors();
  const { pairing, acceptPairing, rejectPairing } = useCommunication();

  return (
    <Modal visible={pairing !== null} transparent animationType="fade" onRequestClose={() => void rejectPairing()}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="pairing-dialog">
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="shield" size={24} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Conectar com {pairing?.peerName}?</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Confirme que o código abaixo é <Text style={{ fontFamily: 'Inter_700Bold' }}>o mesmo</Text> que aparece no outro aparelho.
            Se for diferente, recuse.
          </Text>

          <View style={[styles.codeBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.code, { color: colors.foreground }]} testID="pairing-code">{pairing?.digits ?? ''}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              testID="pairing-reject"
              onPress={() => void rejectPairing()}
              style={({ pressed }) => [styles.button, styles.reject, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Recusar</Text>
            </Pressable>
            <Pressable
              testID="pairing-accept"
              onPress={() => void acceptPairing()}
              style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.72 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>É o mesmo código</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 14, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 8, textAlign: 'center' },
  codeBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 14, marginTop: 16 },
  code: { fontSize: 34, letterSpacing: 8, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  button: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reject: { borderWidth: 1 },
  buttonText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
