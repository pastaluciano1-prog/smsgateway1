import { registerWebModule, NativeModule } from 'expo';

// SmsGatewayModule is not available on the web platform.
class SmsGatewayModule extends NativeModule<{}> {}

export default registerWebModule(SmsGatewayModule, 'SmsGatewayModule');
