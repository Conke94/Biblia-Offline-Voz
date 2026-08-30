import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getNearby } from '@/services/nativeBridge';

const INBOX_STORAGE_KEY = '@biblia-offline-voz/inbox';
export const INBOX_LIMIT = 10;

export interface InboxMessage {
  id: string;
  text: string;
  receivedAt: string;
}

interface CommunicationContextValue {
  inbox: InboxMessage[];
  isLoading: boolean;
  isNearbyAvailable: boolean;
  isConnecting: boolean;
  connectedDeviceCount: number;
  error: string | null;
  startNearby: () => Promise<void>;
  stopNearby: () => Promise<void>;
  sendText: (text: string) => Promise<boolean>;
  deleteMessage: (id: string) => void;
  clearError: () => void;
}

const CommunicationContext = createContext<CommunicationContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function CommunicationProvider({ children }: { children: ReactNode }) {
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNearbyAvailable, setIsNearbyAvailable] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDeviceCount, setConnectedDeviceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inboxCount = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(INBOX_STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const restored = parsed.filter((item): item is InboxMessage =>
            typeof item?.id === 'string' && typeof item?.text === 'string' && typeof item?.receivedAt === 'string',
          ).slice(0, INBOX_LIMIT);
          inboxCount.current = restored.length;
          setInbox(restored);
        }
      })
      .catch(() => setError('Não foi possível abrir a caixa de entrada local.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const nearby = getNearby();
    Promise.resolve(nearby.isAvailable()).then(setIsNearbyAvailable).catch(() => setIsNearbyAvailable(false));
    const removeMessage = nearby.addMessageListener((text) => {
      const cleanText = text.trim();
      if (!cleanText) return;
      if (inboxCount.current >= INBOX_LIMIT) {
        setError('Caixa de entrada cheia. A nova mensagem foi ignorada.');
        return;
      }
      inboxCount.current += 1;
      setInbox((current) => {
        return [{ id: makeId(), text: cleanText, receivedAt: new Date().toISOString() }, ...current];
      });
      Speech.stop();
      Speech.speak(cleanText, { language: 'pt-BR', rate: 1 });
    });
    const removeStatus = nearby.addStatusListener((status) => {
      setConnectedDeviceCount(Math.max(0, status.connectedDeviceCount));
      setIsConnecting(false);
      if (status.error) setError(status.error);
    });
    return () => {
      removeMessage?.();
      removeStatus?.();
      void nearby.stop();
    };
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(inbox)).catch(() =>
        setError('Não foi possível salvar a caixa de entrada local.'),
      );
    }
  }, [inbox, isLoading]);

  const startNearby = useCallback(async () => {
    const nearby = getNearby();
    if (!(await nearby.isAvailable())) {
      setError('A comunicação Nearby exige a versão Android do aplicativo.');
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      await nearby.start();
    } catch (reason) {
      setIsConnecting(false);
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a comunicação Nearby.');
    }
  }, []);

  const stopNearby = useCallback(async () => {
    setIsConnecting(false);
    try {
      await getNearby().stop();
    } finally {
      setConnectedDeviceCount(0);
    }
  }, []);

  const sendText = useCallback(async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) {
      setError('Revise a transcrição antes de enviar.');
      return false;
    }
    if (connectedDeviceCount === 0) {
      setError('Conecte um dispositivo antes de enviar.');
      return false;
    }
    try {
      await getNearby().send(cleanText);
      setError(null);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a mensagem.');
      return false;
    }
  }, [connectedDeviceCount]);

  const deleteMessage = useCallback((id: string) => {
    setInbox((current) => {
      const next = current.filter((message) => message.id !== id);
      inboxCount.current = next.length;
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    inbox, isLoading, isNearbyAvailable, isConnecting, connectedDeviceCount, error,
    startNearby, stopNearby, sendText, deleteMessage, clearError: () => setError(null),
  }), [inbox, isLoading, isNearbyAvailable, isConnecting, connectedDeviceCount, error, startNearby, stopNearby, sendText, deleteMessage]);

  return <CommunicationContext.Provider value={value}>{children}</CommunicationContext.Provider>;
}

export function useCommunication(): CommunicationContextValue {
  const context = useContext(CommunicationContext);
  if (!context) throw new Error('useCommunication must be used within CommunicationProvider');
  return context;
}