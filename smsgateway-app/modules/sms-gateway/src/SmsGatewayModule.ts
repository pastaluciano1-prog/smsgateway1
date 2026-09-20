import { NativeModule, requireNativeModule } from 'expo';

export type SimInfo = {
  slot: number;
  subscriptionId: number;
  carrier: string;
  number: string;
};

declare class SmsGatewayModule extends NativeModule<{}> {
  getSimInfo(): SimInfo[];
  sendSms(to: string, body: string, subscriptionId: number): boolean;
}

export default requireNativeModule<SmsGatewayModule>('SmsGateway');