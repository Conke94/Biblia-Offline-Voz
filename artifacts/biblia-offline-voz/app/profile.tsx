import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCommunication } from '@/context/CommunicationContext';

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { localName, setLocalName } = useCommunication();
  const [draft, setDraft] = useState(localName);

  const canSave = draft.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    setLocalName(draft);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.container, { backgroundColor: colors.background, paddingBottom: 20 }]}
      testID="profile-screen"
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>SEU NOME</Text>
        <TextInput
          testID="name-input"
          value={draft}
          onChangeText={setDraft}
          placeholder="Ex.: Lucas"
          placeholderTextColor={colors.mutedForeground}
          maxLength={24}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        />
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          É este nome que as outras pessoas veem na lista de conectados. Fica salvo só neste aparelho.
        </Text>
      </View>

      <Pressable
        testID="save-name"
        disabled={!canSave}
        onPress={save}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: !canSave ? 0.4 : pressed ? 0.72 : 1 },
        ]}
      >
        <Feather name="check" size={18} color={colors.primaryForeground} />
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Salvar</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
  label: { fontSize: 11, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontFamily: 'Inter_400Regular' },
  help: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginTop: 12 },
  button: { marginTop: 18, minHeight: 48, borderRadius: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
