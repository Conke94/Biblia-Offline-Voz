import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getNearby, BROADCAST_TARGET, type NearbyPeer, type PairingRequest } from '@/services/nativeBridge';

const INBOX_STORAGE_KEY = '@biblia-offline-voz/inbox';
const NAME_STORAGE_KEY = '@biblia-offline-voz/name';
const DEVICE_ID_KEY = '@biblia-offline-voz/device-id';
export { BROADCAST_TARGET };
export type { NearbyPeer, PairingRequest };
// Janela deslizante: ao passar do teto, as mensagens mais antigas saem
// automaticamente. Nunca recusa uma mensagem nova.
export const CONVERSATION_LIMIT = 50;

export type MessageDirection = 'sent' | 'received';
// 'queued' = escrita mas ainda nao entregue: o contato estava fora de alcance.
export type DeliveryState = 'queued' | 'delivered';

export interface InboxMessage {
  id: string;
  text: string;
  receivedAt: string;
  direction: MessageDirection;
  // Com quem esta mensagem foi trocada. BROADCAST_TARGET para "Todos".
  peerId: string;
  peerName: string;
  delivery: DeliveryState;
}

interface CommunicationContextValue {
  inbox: InboxMessage[];
  peers: NearbyPeer[];
  pairing: PairingRequest | null;
  acceptPairing: () => Promise<void>;
  rejectPairing: () => Promise<void>;
  backgroundEnabled: boolean;
  setBackgroundEnabled: (enabled: boolean) => Promise<void>;
  localName: string;
  setLocalName: (name: string) => void;
  messagesFor: (peerId: string) => InboxMessage[];
  addSentMessage: (text: string, peerId: string, peerName: string) => void;
  isLoading: boolean;
  isNearbyAvailable: boolean;
  isConnecting: boolean;
  connectedDeviceCount: number;
  error: string | null;
  startNearby: () => Promise<void>;
  stopNearby: () => Promise<void>;
  sendText: (text: string, peerId: string, peerName: string) => Promise<boolean>;
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
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [pairing, setPairing] = useState<PairingRequest | null>(null);
  const [backgroundEnabled, setBackgroundEnabledState] = useState(false);
  const [localName, setLocalNameState] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const peersRef = useRef<NearbyPeer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inboxCount = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(NAME_STORAGE_KEY)
      .then((saved) => { if (saved) setLocalNameState(saved); })
      .catch(() => undefined);
    // Identidade estavel do aparelho: o endpointId do Nearby muda a cada
    // sessao, entao nao serve como chave de contato nem de fila offline.
    AsyncStorage.getItem(DEVICE_ID_KEY)
      .then((saved) => {
        if (saved) { setDeviceId(saved); return; }
        const fresh = makeId() + '-' + Math.random().toString(36).slice(2, 10);
        setDeviceId(fresh);
        AsyncStorage.setItem(DEVICE_ID_KEY, fresh).catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(INBOX_STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const restored = parsed
            .filter((item) =>
              typeof item?.id === 'string' && typeof item?.text === 'string' && typeof item?.receivedAt === 'string',
            )
            // Registros salvos antes do chat nao tinham direcao: eram todos recebidos.
            .map((item): InboxMessage => ({
              id: item.id,
              text: item.text,
              receivedAt: item.receivedAt,
              direction: item.direction === 'sent' ? 'sent' : 'received',
              // Historico anterior aos contatos: cai na conversa "Todos".
              peerId: typeof item.peerId === 'string' ? item.peerId : BROADCAST_TARGET,
              peerName: typeof item.peerName === 'string' ? item.peerName : 'Todos',
              delivery: item.delivery === 'queued' ? 'queued' : 'delivered',
            }))
            .slice(0, CONVERSATION_LIMIT);
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
    const removeMessage = nearby.addMessageListener(({ text, peerId, peerName }) => {
      const cleanText = text.trim();
      if (!cleanText) return;
      setInbox((current) => {
        const next = [
          {
            id: makeId(),
            text: cleanText,
            receivedAt: new Date().toISOString(),
            direction: 'received' as const,
            peerId,
            peerName,
            delivery: 'delivered' as const,
          },
          ...current,
        ].slice(0, CONVERSATION_LIMIT);
        inboxCount.current = next.length;
        return next;
      });
    });
    const removePairing = nearby.addPairingListener((request) => setPairing(request));
    const removeStatus = nearby.addStatusListener((status) => {
      setConnectedDeviceCount(Math.max(0, status.connectedDeviceCount));
      setPeers(status.peers ?? []);
      // So sai de "conectando" quando ha alguem conectado, quando a busca
      // parou ou quando deu erro. Zerar em qualquer status reabilitava o
      // botao no ato e o segundo toque causava ALREADY_DISCOVERING (8002).
      if (status.connectedDeviceCount > 0 || status.isRunning === false || status.error) {
        setIsConnecting(false);
      }
      if (status.error) setError(status.error);
    });
    return () => {
      removeMessage?.();
      removeStatus?.();
      removePairing?.();
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
    if (!localName.trim()) {
      setError('Defina seu nome antes de conectar.');
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      await nearby.start(localName.trim(), deviceId);
    } catch (reason) {
      setIsConnecting(false);
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a comunicação Nearby.');
    }
  }, [localName, deviceId]);

  const stopNearby = useCallback(async () => {
    setIsConnecting(false);
    try {
      await getNearby().stop();
    } finally {
      setConnectedDeviceCount(0);
      setPeers([]);
    }
  }, []);

  const setLocalName = useCallback((name: string) => {
    const clean = name.trim().slice(0, 24);
    setLocalNameState(clean);
    AsyncStorage.setItem(NAME_STORAGE_KEY, clean).catch(() => undefined);
  }, []);

  const messagesFor = useCallback(
    (peerId: string) => inbox.filter((message) => message.peerId === peerId),
    [inbox],
  );

  const addSentMessage = useCallback(
    (text: string, peerId: string, peerName: string, delivery: DeliveryState = 'delivered') => {
      setInbox((current) => {
        const next = [
          { id: makeId(), text, receivedAt: new Date().toISOString(), direction: 'sent' as const, peerId, peerName, delivery },
          ...current,
        ].slice(0, CONVERSATION_LIMIT);
        inboxCount.current = next.length;
        return next;
      });
    },
    [],
  );

  const sendText = useCallback(async (text: string, peerId: string, peerName: string) => {
    const cleanText = text.trim();
    if (!cleanText) {
      setError('Revise a transcrição antes de enviar.');
      return false;
    }
    // Broadcast nao entra na fila: "Todos" so faz sentido para quem esta
    // conectado agora. Fila offline vale para destinatario nomeado.
    if (peerId === BROADCAST_TARGET && connectedDeviceCount === 0) {
      setError('Conecte um dispositivo antes de enviar para todos.');
      return false;
    }
    const online = peers.some((peer) => peer.id === peerId);
    if (peerId !== BROADCAST_TARGET && !online) {
      addSentMessage(cleanText, peerId, peerName, 'queued');
      setError(null);
      return true;
    }
    try {
      await getNearby().send(cleanText, peerId);
      addSentMessage(cleanText, peerId, peerName, 'delivered');
      setError(null);
      return true;
    } catch (reason) {
      if (peerId !== BROADCAST_TARGET) {
        addSentMessage(cleanText, peerId, peerName, 'queued');
        setError(null);
        return true;
      }
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a mensagem.');
      return false;
    }
  }, [connectedDeviceCount, peers, addSentMessage]);

  // Guarda a fila em ref para o efeito de flush nao depender de `inbox`,
  // o que o re-dispararia a cada mensagem nova.
  const inboxRef = useRef<InboxMessage[]>([]);
  useEffect(() => { inboxRef.current = inbox; }, [inbox]);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  const flushingRef = useRef(false);

  // Quando um contato volta a ficar online, entrega o que estava na fila.
  useEffect(() => {
    if (peers.length === 0 || flushingRef.current) return;
    const queued = inboxRef.current
      .filter((m) => m.delivery === 'queued' && peers.some((p) => p.id === m.peerId))
      // Ordem cronologica: a lista e mais-nova-primeiro.
      .reverse();
    if (queued.length === 0) return;

    flushingRef.current = true;
    void (async () => {
      const delivered: string[] = [];
      for (const message of queued) {
        try {
          await getNearby().send(message.text, message.peerId);
          delivered.push(message.id);
        } catch {
          // Contato caiu no meio do envio: o resto continua na fila.
          break;
        }
      }
      if (delivered.length > 0) {
        setInbox((current) =>
          current.map((m) => (delivered.includes(m.id) ? { ...m, delivery: 'delivered' as const } : m)),
        );
      }
      flushingRef.current = false;
    })();
  }, [peers]);

  const acceptPairing = useCallback(async () => {
    if (!pairing) return;
    const current = pairing;
    setPairing(null);
    try {
      await getNearby().acceptPairing(current.endpointId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível confirmar a conexão.');
    }
  }, [pairing]);

  const rejectPairing = useCallback(async () => {
    if (!pairing) return;
    const current = pairing;
    setPairing(null);
    try {
      await getNearby().rejectPairing(current.endpointId);
    } catch {
      // Recusa e best-effort: o Nearby derruba a conexao de qualquer forma.
    }
  }, [pairing]);

  const setBackgroundEnabled = useCallback(async (enabled: boolean) => {
    try {
      await getNearby().setBackground(enabled);
      setBackgroundEnabledState(enabled);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível mudar o modo disponível.');
    }
  }, []);

  const deleteMessage = useCallback((id: string) => {
    setInbox((current) => {
      const next = current.filter((message) => message.id !== id);
      inboxCount.current = next.length;
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    inbox, peers, localName, setLocalName, messagesFor,
    pairing, acceptPairing, rejectPairing, backgroundEnabled, setBackgroundEnabled,
    isLoading, isNearbyAvailable, isConnecting, connectedDeviceCount, error,
    startNearby, stopNearby, sendText, addSentMessage, deleteMessage, clearError: () => setError(null),
  }), [inbox, peers, localName, setLocalName, messagesFor, pairing, acceptPairing, rejectPairing, backgroundEnabled, setBackgroundEnabled, isLoading, isNearbyAvailable, isConnecting, connectedDeviceCount, error, startNearby, stopNearby, sendText, addSentMessage, deleteMessage]);

  return <CommunicationContext.Provider value={value}>{children}</CommunicationContext.Provider>;
}

export function useCommunication(): CommunicationContextValue {
  const context = useContext(CommunicationContext);
  if (!context) throw new Error('useCommunication must be used within CommunicationProvider');
  return context;
}