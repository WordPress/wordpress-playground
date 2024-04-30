import { SyncMiddleware } from '.';
import { logger } from '@php-wasm/logger';

export function loggerMiddleware(clientId: string): SyncMiddleware {
	return {
		beforeSend: (envelope) => {
			if (envelope.sql.length > 0 || envelope.fs.length > 0) {
				logger.log(`[${clientId}] Sending changes`, envelope);
			}
			return envelope;
		},
		afterReceive: (envelope) => {
			logger.log(`[${clientId}] Received changes`, envelope);
			return envelope;
		},
	};
}
