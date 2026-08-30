import { Platform } from 'react-native';
import {
  offlineSpeech,
  type SpeechErrorEvent,
  type SpeechResultEvent,
} from '@/modules/offlineSpeech';
import {
  nearbyConnections,
  type NearbyEvent,
} from '@/modules/nearbyConnections';

export type RecognitionCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
};

export type SpeechRecognitionBridge = {
  isAvailable: () => boolean | Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  start: (callbacks: RecognitionCallbacks) => void | Promise<void>;
  stop: () => void | Promise<void>;
  cancel: () => void | Promise<void>;
};

// id = deviceId persistente do outro aparelho (nao o endpointId efemero).
export type NearbyPeer = { id: string; name: string };

export type NearbyStatus = {
  connectedDeviceCount: number;
  peers: NearbyPeer[];
  isRunning?: boolean;
  error?: string;
};

export type IncomingMessage = { text: string; peerId: string; peerName: string };

// Pedido de conexao aguardando as duas pessoas conferirem o mesmo codigo.
export type PairingRequest = {
  endpointId: string;
  peerId: string;
  peerName: string;
  digits: string;
  incoming: boolean;
};

export const BROADCAST_TARGET = 'all';

export type NearbyBridge = {
  isAvailable: () => boolean | Promise<boolean>;
  start: (name: string, deviceId: string) => void | Promise<void>;
  stop: () => void | Promise<void>;
  send: (text: string, target: string) => void | Promise<void>;
  addMessageListener: (listener: (message: IncomingMessage) => void) => (() => void) | void;
  addStatusListener: (listener: (status: NearbyStatus) => void) => (() => void) | void;
  addPairingListener: (listener: (request: PairingRequest) => void) => (() => void) | void;
  acceptPairing: (endpointId: string) => Promise<void>;
  rejectPairing: (endpointId: string) => Promise<void>;
  setBackground: (enabled: boolean) => Promise<void>;
};

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
};

const SERVICE_ID = 'com.bibliaofflinevoz.messages';
let speechSubscriptions: Array<{ remove(): void }> = [];
let webSpeechBridge: SpeechRecognitionBridge | null = null;
// peerKey (deviceId estavel) -> { endpointId atual, nome }
const connectedEndpoints = new Map<string, { endpointId: string; name: string }>();
const statusListeners = new Set<(status: NearbyStatus) => void>();
let nearbyRunning = false;
let nearbySubscriptionsInstalled = false;

function currentPeers(): NearbyPeer[] {
  return Array.from(connectedEndpoints, ([id, value]) => ({ id, name: value.name }));
}

function notifyNearbyStatus(error?: string): void {
  const status: NearbyStatus = {
    connectedDeviceCount: connectedEndpoints.size,
    peers: currentPeers(),
    isRunning: nearbyRunning,
    error,
  };
  statusListeners.forEach((listener) => listener(status));
}

function clearSpeechSubscriptions(): void {
  speechSubscriptions.forEach((subscription) => subscription.remove());
  speechSubscriptions = [];
}

function endpointId(event: NearbyEvent): string | null {
  return typeof event.endpointId === 'string' ? event.endpointId : null;
}

function installNearbyStatusSubscriptions(): void {
  if (nearbySubscriptionsInstalled || !nearbyConnections.isAvailable) return;
  nearbySubscriptionsInstalled = true;
  nearbyConnections.addListener('nearbyConnectionResult', (event) => {
    const id = endpointId(event);
    const key = typeof event.peerKey === 'string' && event.peerKey ? event.peerKey : id;
    if (!id || !key) return;
    if (event.connected === true) {
      connectedEndpoints.set(key, {
        endpointId: id,
        name: typeof event.endpointName === 'string' ? event.endpointName : 'Aparelho',
      });
    } else {
      connectedEndpoints.delete(key);
    }
    notifyNearbyStatus();
  });
  nearbyConnections.addListener('nearbyDisconnected', (event) => {
    const key = typeof event.peerKey === 'string' && event.peerKey ? event.peerKey : endpointId(event);
    if (key) connectedEndpoints.delete(key);
    notifyNearbyStatus();
  });
  nearbyConnections.addListener('nearbyStopped', () => {
    nearbyRunning = false;
    connectedEndpoints.clear();
    notifyNearbyStatus();
  });
  nearbyConnections.addListener('nearbyError', (event) => {
    const message = typeof event.message === 'string'
      ? event.message
      : 'A comunicação Nearby encontrou um erro.';
    notifyNearbyStatus(message);
  });
}

function browserSpeech(): SpeechRecognitionBridge {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return {
      isAvailable: () => false,
      requestPermission: async () => false,
      start: async () => undefined,
      stop: async () => undefined,
      cancel: async () => undefined,
    };
  }
  const recognitionWindow = window as typeof window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Constructor = recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition;
  if (!Constructor) {
    return {
      isAvailable: () => false,
      requestPermission: async () => false,
      start: async () => undefined,
      stop: async () => undefined,
      cancel: async () => undefined,
    };
  }
  let active: BrowserRecognition | null = null;
  return {
    isAvailable: () => true,
    requestPermission: async () => true,
    start: (callbacks) => {
      active = new Constructor();
      active.lang = 'pt-BR';
      active.continuous = true;
      active.interimResults = true;
      active.onresult = (event) => {
        let partial = '';
        let final = '';
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result?.isFinal) final += result[0]?.transcript ?? '';
          else partial += result?.[0]?.transcript ?? '';
        }
        if (final.trim()) callbacks.onFinal(final.trim());
        callbacks.onPartial(partial.trim());
      };
      active.onerror = () => callbacks.onError('O navegador não conseguiu reconhecer sua voz.');
      active.start();
    },
    stop: () => active?.stop(),
    cancel: () => active?.stop(),
  };
}

const androidSpeech: SpeechRecognitionBridge = {
  isAvailable: offlineSpeech.isAvailable,
  requestPermission: offlineSpeech.requestPermission,
  start: async (callbacks) => {
    clearSpeechSubscriptions();
    speechSubscriptions = [
      offlineSpeech.addPartialResultListener((event: SpeechResultEvent) =>
        callbacks.onPartial(event.results[0] ?? ''),
      ),
      offlineSpeech.addResultListener((event: SpeechResultEvent) => {
        callbacks.onFinal(event.results[0] ?? '');
        clearSpeechSubscriptions();
      }),
      offlineSpeech.addErrorListener((event: SpeechErrorEvent) => {
        callbacks.onError(event.message);
        clearSpeechSubscriptions();
      }),
    ];
    try {
      await offlineSpeech.start();
    } catch (error) {
      clearSpeechSubscriptions();
      throw error;
    }
  },
  stop: offlineSpeech.stop,
  cancel: async () => {
    await offlineSpeech.cancel();
    clearSpeechSubscriptions();
  },
};

const nearbyBridge: NearbyBridge = {
  isAvailable: () => nearbyConnections.isAvailable,
  start: async (name: string, deviceId: string) => {
    // Guarda contra toque duplo: sem isso o segundo start bate em
    // STATUS_ALREADY_DISCOVERING (8002).
    if (nearbyRunning) return;
    installNearbyStatusSubscriptions();
    const granted = await nearbyConnections.requestPermissions();
    if (!granted) throw new Error('Permita localização, Bluetooth e dispositivos próximos para conectar os celulares.');
    await nearbyConnections.start(SERVICE_ID, name, deviceId);
    nearbyRunning = true;
    notifyNearbyStatus();
  },
  stop: async () => {
    await nearbyConnections.stop();
    nearbyRunning = false;
    connectedEndpoints.clear();
    notifyNearbyStatus();
  },
  send: async (text, target) => {
    if (target === BROADCAST_TARGET) {
      const recipients = await nearbyConnections.broadcastText(text);
      if (recipients === 0) throw new Error('Nenhum aparelho conectado recebeu a mensagem.');
      return;
    }
    const peer = connectedEndpoints.get(target);
    if (!peer) {
      throw new Error('Esse contato não está mais conectado.');
    }
    await nearbyConnections.sendTextTo(peer.endpointId, text);
  },
  addMessageListener: (listener) => {
    const subscription = nearbyConnections.addListener('nearbyPayload', (event) => {
      if (typeof event.text !== 'string') return;
      listener({
        text: event.text,
        peerId: typeof event.peerKey === 'string' && event.peerKey
          ? event.peerKey
          : (typeof event.endpointId === 'string' ? event.endpointId : 'desconhecido'),
        peerName: typeof event.endpointName === 'string' ? event.endpointName : 'Aparelho',
      });
    });
    return () => subscription.remove();
  },
  addPairingListener: (listener) => {
    const subscription = nearbyConnections.addListener('nearbyAuthRequest', (event) => {
      if (typeof event.endpointId !== 'string' || typeof event.digits !== 'string') return;
      listener({
        endpointId: event.endpointId,
        peerId: typeof event.peerKey === 'string' && event.peerKey ? event.peerKey : event.endpointId,
        peerName: typeof event.endpointName === 'string' ? event.endpointName : 'Aparelho',
        digits: event.digits,
        incoming: event.isIncomingConnection === true,
      });
    });
    return () => subscription.remove();
  },
  acceptPairing: (endpointId) => nearbyConnections.acceptPeer(endpointId),
  rejectPairing: (endpointId) => nearbyConnections.rejectPeer(endpointId),
  setBackground: (enabled) =>
    enabled ? nearbyConnections.enableBackground() : nearbyConnections.disableBackground(),
  addStatusListener: (listener) => {
    installNearbyStatusSubscriptions();
    statusListeners.add(listener);
    listener({ connectedDeviceCount: connectedEndpoints.size, peers: currentPeers(), isRunning: nearbyRunning });
    return () => statusListeners.delete(listener);
  },
};

export function getSpeechRecognition(): SpeechRecognitionBridge {
  if (Platform.OS !== 'web') return androidSpeech;
  webSpeechBridge ??= browserSpeech();
  return webSpeechBridge;
}

export function getNearby(): NearbyBridge {
  return nearbyBridge;
}