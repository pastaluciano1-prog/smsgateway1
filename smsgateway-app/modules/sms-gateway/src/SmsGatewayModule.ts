import { NativeModule, requireNativeModule } from 'expo';

export type SimInfo = {
  slot: number;
  subscriptionId: number;
  carrier: string;
  number: string;
};

declare class SmsGatewayModule extends NativeModule<{}> {
  getSimInfo(): SimInfo[];
  // Resolves after the platform confirms the send; rejects on real failures
  // (no credit, no service, radio off, timeout).
  sendSms(to: string, body: string, subscriptionId: number): Promise<boolean>;
  // Foreground service that keeps polling alive while the screen is off.
  startService(): boolean;
  stopService(): boolean;
  // Battery-optimization exemption for reliable background operation.
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): boolean;
}

export default requireNativeModule<SmsGatewayModule>('SmsGateway');