import { useEffect, useRef, useState } from 'react';
import { getSpeechRecognition } from '@/services/nativeBridge';

export const MAX_RECORDING_MS = 15_000;

/**
 * Sessão de reconhecimento de voz com botão "segurar para falar".
 *
 * O controle por sessão existe porque o usuário pode soltar o botão antes do
 * motor nativo iniciar. Sem isso, uma sessão abandonada sobrescreve o texto de
 * uma sessão mais nova.
 */
export function useVoiceInput(onText: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSequence = useRef(0);
  const activeSession = useRef<number | null>(null);
  const heldSession = useRef<number | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => { onTextRef.current = onText; }, [onText]);

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

  const begin = async () => {
    const sessionId = sessionSequence.current + 1;
    sessionSequence.current = sessionId;
    activeSession.current = sessionId;
    heldSession.current = sessionId;
    setIsPressing(true);
    setIsListening(false);
    clearRecordingTimer();
    await getSpeechRecognition().cancel();
    if (activeSession.current !== sessionId) return;
    if (heldSession.current !== sessionId) { finishSession(sessionId); return; }

    setError(null);
    const speech = getSpeechRecognition();
    if (!(await speech.isAvailable())) {
      finishSession(sessionId);
      setError('O reconhecimento de voz não está disponível neste dispositivo.');
      return;
    }
    if (activeSession.current !== sessionId) return;
    if (heldSession.current !== sessionId) { finishSession(sessionId); return; }

    const granted = await speech.requestPermission();
    if (activeSession.current !== sessionId) return;
    if (heldSession.current !== sessionId) { finishSession(sessionId); return; }
    if (!granted) {
      finishSession(sessionId);
      setError('Permita o uso do microfone para transcrever sua voz.');
      return;
    }

    setPartialText('');
    try {
      await speech.start({
        onPartial: (text) => {
          if (activeSession.current === sessionId) setPartialText(text);
        },
        onFinal: (text) => {
          if (!finishSession(sessionId)) return;
          onTextRef.current(text);
          setPartialText('');
        },
        onError: (message) => {
          if (!finishSession(sessionId)) return;
          setError(message);
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
        setError('O limite de 15 segundos foi atingido. Revise a mensagem.');
      }, MAX_RECORDING_MS);
    } catch (reason) {
      finishSession(sessionId);
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a transcrição.');
    }
  };

  const release = () => {
    heldSession.current = null;
    setIsPressing(false);
    if (activeSession.current !== null) void getSpeechRecognition().stop();
  };

  return { isSupported, isListening, isPressing, partialText, error, begin, release, clearError: () => setError(null) };
}
