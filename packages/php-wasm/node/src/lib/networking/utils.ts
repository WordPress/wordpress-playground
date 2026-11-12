import { logger } from '@php-wasm/logger';

export function debugLog(message: any, ...args: any[]) {
	if (process.env['DEV'] && !process.env['TEST']) {
		logger.log(message, ...args);
	}
}
