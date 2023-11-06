import { TransportEnvelope } from '../transports';

export type SyncMiddleware = {
	beforeSend: (
		message: TransportEnvelope
	) => TransportEnvelope | Promise<TransportEnvelope>;
	afterReceive: (
		message: TransportEnvelope
	) => TransportEnvelope | Promise<TransportEnvelope>;
};

export { trackAutoincrementMiddleware } from './track-autoincrement';
export { loggerMiddleware } from './logger';
export { marshallSiteURLMiddleware } from './marshall-site-url';
