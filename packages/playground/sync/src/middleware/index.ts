import { TransportMessage } from '../transports';

export type SyncMiddleware = {
	beforeSend: (message: TransportMessage[]) => TransportMessage[];
	afterReceive: (message: TransportMessage[]) => TransportMessage[];
};

export { trackAutoincrementMiddleware } from './track-autoincrement';
export { loggerMiddleware } from './logger';
export { marshallSiteURLMiddleware } from './marshall-site-url';
