import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type RecognitionEvent = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type RecognitionConstructor = new () => RecognitionInstance;

export default function TranscribeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const recognition = useRef<RecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const speechWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const instance = new Recognition();
    instance.lang = 'pt-BR';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let text = '';
      for (let index = 0; index < event.results.length; index += 1) {
        text += event.results[index]?.[0]?.transcript ?? '';
      }
      setTranscript(text.trim());
    };
    instance.onend = () => setIsListening(false);
    instance.onerror = () => setIsListening(false);
    recognition.current = instance;
    setSupported(true);

    return () => instance.stop();
  }, []);

  const toggleListening = () => {
    if (!recognition.current) return;
    if (isListening) {
      recognition.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognition.current.start();
      setIsListening(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.status, { backgroundColor: isListening ? colors.muted : colors.secondary }]}>
        <View style={[styles.dot, { backgroundColor: isListening ? colors.primary : colors.mutedForeground }]} />
        <Text style={[styles.statusText, { color: colors.foreground }]}>
          {isListening ? 'Escutando agora…' : 'Pronto para escutar'}
        </Text>
      </View>

      <View style={[styles.transcriptCard, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>TRANSCRIÇÃO</Text>
        <Text style={[styles.transcript, { color: transcript ? colors.foreground : colors.mutedForeground }]}>
          {transcript || 'O texto reconhecido aparecerá aqui enquanto você fala.'}
        </Text>
      </View>

      {!supported && (
        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={20} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>
            Nesta validação, a transcrição funciona no Preview aberto pelo Chrome. O reconhecimento offline nativo no Android será ativado em uma compilação própria do aplicativo.
          </Text>
        </View>
      )}

      <View style={styles.actionArea}>
        <Pressable
          testID="toggle-listening"
          disabled={!supported}
          onPress={toggleListening}
          style={({ pressed }) => [
            styles.micButton,
            {
              backgroundColor: isListening ? colors.foreground : colors.primary,
              opacity: !supported ? 0.35 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather name={isListening ? 'square' : 'mic'} size={34} color={colors.primaryForeground} />
        </Pressable>
        <Text style={[styles.actionLabel, { color: colors.foreground }]}>
          {isListening ? 'Toque para parar' : 'Toque e comece a falar'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  transcriptCard: { flex: 1, marginTop: 24, borderWidth: 1, borderRadius: 16, padding: 22 },
  label: { fontSize: 12, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', marginBottom: 18 },
  transcript: { fontSize: 22, lineHeight: 33, fontFamily: 'Inter_400Regular' },
  notice: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, marginTop: 16 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  actionArea: { alignItems: 'center', paddingTop: 28 },
  micButton: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { marginTop: 12, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});