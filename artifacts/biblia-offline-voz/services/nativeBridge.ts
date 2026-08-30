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

export type NearbyStatus = { connectedDeviceCount: number; isRunning?: boolean; error?: string };

export type NearbyBridge = {
  isAvailable: () => boolean | Promise<boolean>;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  send: (text: string) => void | Promise<void>;
  addMessageListener: (listener: (text: string) => void) => (() => void) | void;
  addStatusListener: (listener: (status: NearbyStatus) => void) => (() => void) | void;
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
const connectedEndpoints = new Set<string>();
const statusListeners = new Set<(status: NearbyStatus) => void>();
let nearbyRunning = false;
let nearbySubscriptionsInstalled = false;

function notifyNearbyStatus(error?: string): void {
  const status = { connectedDeviceCount: connectedEndpoints.size, isRunning: nearbyRunning, error };
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
    if (!id) return;
    if (event.connected === true) connectedEndpoints.add(id);
    else connectedEndpoints.delete(id);
    notifyNearbyStatus();
  });
  nearbyConnections.addListener('nearbyDisconnected', (event) => {
    const id = endpointId(event);
    if (id) connectedEndpoints.delete(id);
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
  start: async () => {
    installNearbyStatusSubscriptions();
    const granted = await nearbyConnections.requestPermissions();
    if (!granted) throw new Error('Permita Bluetooth e dispositivos próximos para conectar os celulares.');
    await nearbyConnections.start(SERVICE_ID);
    nearbyRunning = true;
    notifyNearbyStatus();
  },
  stop: async () => {
    await nearbyConnections.stop();
    nearbyRunning = false;
    connectedEndpoints.clear();
    notifyNearbyStatus();
  },
  send: async (text) => {
    const recipients = await nearbyConnections.broadcastText(text);
    if (recipients === 0) throw new Error('Nenhum aparelho conectado recebeu a mensagem.');
  },
  addMessageListener: (listener) => {
    const subscription = nearbyConnections.addListener('nearbyPayload', (event) => {
      if (typeof event.text === 'string') listener(event.text);
    });
    return () => subscription.remove();
  },
  addStatusListener: (listener) => {
    installNearbyStatusSubscriptions();
    statusListeners.add(listener);
    listener({ connectedDeviceCount: connectedEndpoints.size, isRunning: nearbyRunning });
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