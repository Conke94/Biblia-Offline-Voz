import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useCommunication } from '@/context/CommunicationContext';
import { getSpeechRecognition } from '@/services/nativeBridge';

const MAX_RECORDING_MS = 15_000;

export default function TranscribeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { connectedDeviceCount, isNearbyAvailable, isConnecting, startNearby, sendText, error, clearError } = useCommunication();
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [partialText, setPartialText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSequence = useRef(0);
  const activeSession = useRef<number | null>(null);
  const heldSession = useRef<number | null>(null);

  useEffect(() => {
    Promise.resolve(getSpeechRecognition().isAvailable()).then(setIsSupported).catch(() => setIsSupported(false));
    return () => {
      sessionSequence.current += 1;
      activeSession.current = null;
      heldSession.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void getSpeechRecognition().cancel();
    };
  }, []);

  const clearRecordingTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const finishSession = (sessionId: number) => {
    if (activeSession.current !== sessionId) return false;
    activeSession.current = null;
    if (heldSession.current === sessionId) heldSession.current = null;
    clearRecordingTimer();
    setIsListening(false);
    setIsPressing(false);
    return true;
  };

  const beginListening = async () => {
    const sessionId = sessionSequence.current + 1;
    sessionSequence.current = sessionId;
    activeSession.current = sessionId;
    heldSession.current = sessionId;
    setIsPressing(true);
    setIsListening(false);
    clearRecordingTimer();
    await getSpeechRecognition().cancel();
    if (activeSession.current !== sessionId) return;
    if (heldSession.current !== sessionId) {
      finishSession(sessionId);
      return;
    }
    clearError();
    setLocalError(null);
    const speech = getSpeechRecognition();
    if (!(await speech.isAvailable())) {
      finishSession(sessionId);
      setLocalError('O reconhecimento de voz não está disponível neste dispositivo.');
      return;
    }
    if (activeSession.current !== sessionId) return;
    if (heldSession.current !== sessionId) {
      finishSession(sessionId);
      return;
    }
    const granted = await speech.requestPermission();
    if (activeSession.current !== sessionId) return;
    if (heldSession.current !== sessionId) {
      finishSession(sessionId);
      return;
    }
    if (!granted) {
      finishSession(sessionId);
      setPermissionNeeded(true);
      setLocalError('Permita o uso do microfone para transcrever sua voz.');
      return;
    }
    setPermissionNeeded(false);
    setPartialText('');
    try {
      await speech.start({
        onPartial: (text) => {
          if (activeSession.current === sessionId) setPartialText(text);
        },
        onFinal: (text) => {
          if (!finishSession(sessionId)) return;
          setFinalText((current) => `${current} ${text}`.trim());
          setPartialText('');
        },
        onError: (message) => {
          if (!finishSession(sessionId)) return;
          setLocalError(message);
        },
      });
      if (activeSession.current !== sessionId) return;
      if (heldSession.current !== sessionId) {
        setIsListening(true);
        await speech.stop();
        return;
      }
      setIsListening(true);
      timeoutRef.current = setTimeout(() => {
        if (activeSession.current !== sessionId) return;
        setIsPressing(false);
        setIsListening(false);
        void speech.stop();
        setLocalError('O limite de 15 segundos foi atingido. Revise a mensagem.');
      }, MAX_RECORDING_MS);
    } catch (reason) {
      finishSession(sessionId);
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a transcrição.');
    }
  };

  const releaseListening = () => {
    heldSession.current = null;
    setIsPressing(false);
    if (activeSession.current !== null) void getSpeechRecognition().stop();
  };

  const message = `${finalText}${finalText && partialText ? ' ' : ''}${partialText}`;
  const handleSend = async () => {
    const didSend = await sendText(message);
    if (didSend) {
      setFinalText('');
      setPartialText('');
    }
  };

  const displayedError = localError ?? error;
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: (Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom) + 18 }]} testID="transcribe-screen">
      <View style={[styles.connection, { backgroundColor: connectedDeviceCount > 0 ? colors.muted : colors.secondary }]}>
        <Feather name={connectedDeviceCount > 0 ? 'radio' : 'wifi-off'} size={18} color={colors.primary} />
        <View style={styles.connectionCopy}>
          <Text style={[styles.connectionTitle, { color: colors.foreground }]}>
            {connectedDeviceCount > 0 ? `${connectedDeviceCount} dispositivo${connectedDeviceCount === 1 ? '' : 's'} conectado${connectedDeviceCount === 1 ? '' : 's'}` : 'Nenhum dispositivo conectado'}
          </Text>
          <Text style={[styles.connectionDetail, { color: colors.mutedForeground }]}>
            {isNearbyAvailable ? 'Comunicação local Nearby' : 'Nearby indisponível neste Preview'}
          </Text>
        </View>
        {connectedDeviceCount === 0 && isNearbyAvailable && (
          <Pressable testID="start-nearby" disabled={isConnecting} onPress={() => void startNearby()} style={({ pressed }) => [styles.connectButton, { borderColor: colors.primary, opacity: isConnecting ? .55 : pressed ? .7 : 1 }]}>
            <Text style={[styles.connectText, { color: colors.foreground }]}>{isConnecting ? 'Buscando' : 'Conectar'}</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.transcriptCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>REVISE A MENSAGEM</Text>
        <TextInput
          testID="transcript-input"
          value={message}
          onChangeText={(text) => { setFinalText(text); setPartialText(''); }}
          multiline
          placeholder="Mantenha o botão pressionado e fale."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
          textAlignVertical="top"
        />
        {isListening && <Text style={[styles.partial, { color: colors.primary }]}>Ouvindo… até 15 segundos</Text>}
      </View>

      {(displayedError || permissionNeeded) && (
        <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]} testID="voice-error">
          <Feather name="alert-circle" size={19} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>{displayedError}</Text>
        </View>
      )}
      {!isSupported && (
        <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]} testID="native-unavailable">
          <Feather name="info" size={19} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>A voz e a conexão Nearby precisam da versão Android. Você ainda pode digitar uma mensagem para revisar.</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable testID="hold-to-talk" disabled={!isSupported} onPressIn={() => void beginListening()} onPressOut={releaseListening} style={({ pressed }) => [styles.micButton, { backgroundColor: isListening ? colors.foreground : colors.primary, opacity: !isSupported ? .35 : pressed ? .76 : 1 }]}>
          <Feather name={isListening ? 'mic-off' : 'mic'} size={32} color={isListening ? colors.background : colors.primaryForeground} />
        </Pressable>
        <Text style={[styles.holdLabel, { color: colors.foreground }]}>{isPressing ? 'Solte para finalizar' : isListening ? 'Finalizando a transcrição…' : 'Mantenha pressionado para falar'}</Text>
        <Pressable testID="send-transcript" disabled={!message.trim() || connectedDeviceCount === 0 || isListening} onPress={() => void handleSend()} style={({ pressed }) => [styles.sendButton, { backgroundColor: colors.primary, opacity: !message.trim() || connectedDeviceCount === 0 || isListening ? .4 : pressed ? .72 : 1 }]}>
          <Feather name="send" size={18} color={colors.primaryForeground} />
          <Text style={[styles.sendText, { color: colors.primaryForeground }]}>Enviar mensagem</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  connection: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, gap: 10 },
  connectionCopy: { flex: 1 }, connectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' }, connectionDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  connectButton: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 }, connectText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  transcriptCard: { flex: 1, marginTop: 18, borderWidth: 1, borderRadius: 16, padding: 18 },
  label: { fontSize: 11, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  input: { flex: 1, fontSize: 19, lineHeight: 28, fontFamily: 'Inter_400Regular', minHeight: 130 },
  partial: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 10 },
  notice: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 14 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  actions: { alignItems: 'center', paddingTop: 16 }, micButton: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  holdLabel: { marginTop: 9, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sendButton: { marginTop: 14, minHeight: 48, paddingHorizontal: 18, borderRadius: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});