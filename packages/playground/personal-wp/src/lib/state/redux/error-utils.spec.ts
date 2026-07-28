import { describe, expect, it } from 'vitest';
import { findDownloadErrorInCauseChain } from './error-utils';

describe('findDownloadErrorInCauseChain', () => {
	it('detects Safari module worker startup failures', () => {
		const error = new Error(
			'WebWorker failed to load at ' +
				'https://my.wordpress.net/playground-worker-endpoint-blueprints-v1.js. ' +
				'Original error: Service Worker context closed'
		);

		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});
});
