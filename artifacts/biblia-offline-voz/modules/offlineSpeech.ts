import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";

type SpeechNativeModule = {
  addListener(eventName: string): void;
  removeListeners(count: number): void;
  isRecognitionAvailable(): Promise<boolean>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  cancelListening(): Promise<void>;
};

export type SpeechResultEvent = { results: string[]; isFinal: boolean };
export type SpeechErrorEvent = { code: string | number; message: string };

const nativeModule = NativeModules.OfflineSpeech as SpeechNativeModule | undefined;
const emitter = nativeModule ? new NativeEventEmitter(nativeModule) : null;

export const offlineSpeech = {
  isAvailable: async (): Promise<boolean> =>
    Platform.OS === "android" && !!nativeModule && await nativeModule.isRecognitionAvailable(),

  requestPermission: async (): Promise<boolean> => {
    if (Platform.OS !== "android") return false;
    return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)) ===
      PermissionsAndroid.RESULTS.GRANTED;
  },

  start: async (): Promise<void> => {
    if (!nativeModule) throw new Error("Offline speech recognition requires the Android custom development build.");
    await nativeModule.startListening();
  },
  stop: async (): Promise<void> => { await nativeModule?.stopListening(); },
  cancel: async (): Promise<void> => { await nativeModule?.cancelListening(); },
  addPartialResultListener: (listener: (event: SpeechResultEvent) => void) =>
    emitter?.addListener("speechPartialResult", listener) ?? { remove() {} },
  addResultListener: (listener: (event: SpeechResultEvent) => void) =>
    emitter?.addListener("speechResult", listener) ?? { remove() {} },
  addErrorListener: (listener: (event: SpeechErrorEvent) => void) =>
    emitter?.addListener("speechError", listener) ?? { remove() {} },
};