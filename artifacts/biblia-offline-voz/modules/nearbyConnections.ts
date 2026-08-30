import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";

type NearbyNativeModule = {
  addListener(eventName: string): void;
  removeListeners(count: number): void;
  start(serviceId: string): Promise<void>;
  broadcastText(text: string): Promise<number>;
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
    const permissions = Platform.Version >= 33
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        ]
      : Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
  },
  start: async (serviceId: string): Promise<void> => {
    if (!nativeModule) throw new Error(unavailable);
    await nativeModule.start(serviceId);
  },
  broadcastText: async (text: string): Promise<number> => {
    if (!nativeModule) throw new Error(unavailable);
    return nativeModule.broadcastText(text);
  },
  stop: async (): Promise<void> => { await nativeModule?.stop(); },
  addListener: (eventName: string, listener: (event: NearbyEvent) => void): Subscription =>
    emitter?.addListener(eventName, listener) ?? { remove() {} },
};