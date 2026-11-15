import { NativeModules, Platform } from 'react-native';

export type Stats = {
  running: boolean;
  blocked: number;
  total: number;
  listSize: number;
  recent: string[];
  allowed: string[];
};

type AdBlockNative = {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  getStats(): Promise<Stats>;
  updateBlocklist(): Promise<number>;
  setAllowed(domain: string, allow: boolean): Promise<boolean>;
};

const native: AdBlockNative | undefined = NativeModules.AdBlock;

export const isSupported = Platform.OS === 'android' && !!native;

function requireNative(): AdBlockNative {
  if (!native) {
    throw new Error('O bloqueio só funciona no Android.');
  }
  return native;
}

export const AdBlock = {
  start: () => requireNative().start(),
  stop: () => requireNative().stop(),
  getStats: () => requireNative().getStats(),
  updateBlocklist: () => requireNative().updateBlocklist(),
  setAllowed: (domain: string, allow: boolean) =>
    requireNative().setAllowed(domain, allow),
};
