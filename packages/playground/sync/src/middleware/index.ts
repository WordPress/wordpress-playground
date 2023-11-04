import { TransportEnvelope } from '../transports';

export type SyncMiddleware = {
	beforeSend: (envelopes: TransportEnvelope[]) => TransportEnvelope[];
	afterReceive: (envelopes: TransportEnvelope[]) => TransportEnvelope[];
};

export { trackAutoincrementMiddleware } from './track-autoincrement';
export { loggerMiddleware } from './logger';
export { marshallSiteURLMiddleware } from './marshall-site-url';
