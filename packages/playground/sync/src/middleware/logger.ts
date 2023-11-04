import { SyncMiddleware } from '.';

export function loggerMiddleware(clientId: string): SyncMiddleware {
	return {
        beforeSend: (message) => {
            if (message.length > 0) {
                console.log(`[${clientId}] Sending changes`, message);
            }
			return message;
		},
		afterReceive: (message) => {
			console.log(`[${clientId}] Received changes`, message);
			return message;
		},
	};
}
