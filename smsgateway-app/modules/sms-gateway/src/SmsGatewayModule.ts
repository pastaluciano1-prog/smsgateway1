import { NativeModule, requireNativeModule } from 'expo';

export type SimInfo = {
  slot: number;
  subscriptionId: number;
  carrier: string;
  number: string;
};

export type DeviceInfo = {
  manufacturer: string;
  brand: string;
  model: string;
  name: string;
  androidRelease: string;
  sdkInt: number;
};

declare class SmsGatewayModule extends NativeModule<{}> {
  getSimInfo(): SimInfo[];
  getDeviceInfo(): DeviceInfo;
  // Resolves after the platform confirms the send; rejects on real failures
  // (no credit, no service, radio off, timeout).
  sendSms(to: string, body: string, subscriptionId: number): Promise<boolean>;
  // Native foreground poll loop (runs with the app minimized / screen off).
  startService(host: string, apiKey: string, interval: number): boolean;
  stopService(): boolean;
  getCounters(): { sent: number; failed: number; received: number };
  resetCounters(): boolean;
  // Battery-optimization exemption for reliable background operation.
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): boolean;
}

export default requireNativeModule<SmsGatewayModule>('SmsGateway');