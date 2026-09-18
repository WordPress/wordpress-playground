import type { AddressInfo } from 'net';
import { logger } from '@php-wasm/logger';

export function debugLog(message: any, ...args: any[]) {
	if (process.env['DEV'] && !process.env['TEST']) {
		logger.log(message, ...args);
	}
}

export function getServerPort(server: {
	address(): AddressInfo | string | null;
}): number {
	const address = server.address();
	if (address === null || typeof address === 'string') {
		throw new Error('Server address is not available');
	}

	return address.port;
}
