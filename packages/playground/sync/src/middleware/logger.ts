import { SyncMiddleware } from '.';

export function loggerMiddleware(clientId: string): SyncMiddleware {
	return {
		beforeSend: (envelope) => {
			if (envelope.length > 0) {
				console.log(`[${clientId}] Sending changes`, envelope);
			}
			return envelope;
		},
		afterReceive: (envelope) => {
			console.log(`[${clientId}] Received changes`, envelope);
			return envelope;
		},
	};
}
