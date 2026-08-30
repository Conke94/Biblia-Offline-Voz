import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";

type NearbyNativeModule = {
  addListener(eventName: string): void;
  removeListeners(count: number): void;
  start(serviceId: string, name: string, deviceId: string): Promise<void>;
  broadcastText(text: string): Promise<number>;
  sendTextTo(endpointId: string, text: string): Promise<number>;
  acceptPeer(endpointId: string): Promise<void>;
  rejectPeer(endpointId: string): Promise<void>;
  enableBackground(): Promise<void>;
  disableBackground(): Promise<void>;
  stop(): Promise<void>;
};

type Subscription = { remove(): void };
export type NearbyEvent = Record<string, unknown>;
const nativeModule = NativeModules.NearbyConnections as NearbyNativeModule | undefined;
const emitter = nativeModule ? new NativeEventEmitter(nativeModule) : null;
const unavailable = "Nearby Connections requires the Android custom development build.";

export const nearbyConnections = {
  isAvailable: Platform.OS === "android" && !!nativeModule,
  requestPermissions: async (): Promise<boolean> => {
    if (Platform.OS !== "android") return false;
    // Localizacao e exigida em TODOS os niveis: o Nearby ainda pede COARSE
    // acima da API 28 e startDiscovery falha com 8034 sem ela.
    // https://github.com/android/connectivity-samples/issues/297
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ];
    if (Platform.Version >= 31) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      );
    }
    if (Platform.Version >= 33) {
      permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    }
    // Notificacao e desejavel mas nao bloqueia a conexao: pedimos junto e
    // avaliamos separado.
    const optional = Platform.Version >= 33
      ? [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS]
      : [];
    const result = await PermissionsAndroid.requestMultiple([...permissions, ...optional]);
    const denied = permissions.filter((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied.length > 0) {
      console.warn("Nearby: permissoes negadas ->", denied.join(", "));
    }
    return denied.length === 0;
  },
  start: async (serviceId: string, name: string, deviceId: string): Promise<void> => {
    if (!nativeModule) throw new Error(unavailable);
    await nativeModule.start(serviceId, name, deviceId);
  },
  broadcastText: async (text: string): Promise<number> => {
    if (!nativeModule) throw new Error(unavailable);
    return nativeModule.broadcastText(text);
  },
  sendTextTo: async (endpointId: string, text: string): Promise<number> => {
    if (!nativeModule) throw new Error(unavailable);
    return nativeModule.sendTextTo(endpointId, text);
  },
  stop: async (): Promise<void> => { await nativeModule?.stop(); },
  acceptPeer: async (endpointId: string): Promise<void> => { await nativeModule?.acceptPeer(endpointId); },
  rejectPeer: async (endpointId: string): Promise<void> => { await nativeModule?.rejectPeer(endpointId); },
  enableBackground: async (): Promise<void> => { await nativeModule?.enableBackground(); },
  disableBackground: async (): Promise<void> => { await nativeModule?.disableBackground(); },
  addListener: (eventName: string, listener: (event: NearbyEvent) => void): Subscription =>
    emitter?.addListener(eventName, listener) ?? { remove() {} },
};