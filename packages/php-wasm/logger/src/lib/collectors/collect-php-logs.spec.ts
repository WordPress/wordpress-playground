import { describe, it, expect, vi } from 'vitest';
import { collectPhpLogs } from './collect-php-logs';
import type { UniversalPHP } from '../types';
import type { Logger } from '../logger';

describe('PHP log collection after a site import', () => {
	it('reads appended records once and restarts after replacement or removal', async () => {
		const logs = createCollector();
		await logs.request('old log');
		await logs.request('old log\nnew error');
		await logs.request('old log\nnew error');
		await logs.request('fatal');
		await logs.request('other'); // Same length, but an imported file.
		await logs.request('');
		await logs.request('fatal');
		expect(logs.messages()).toEqual([
			'old log',
			'\nnew error',
			'fatal',
			'other',
			'fatal',
		]);
	});
	it('does not share offsets between Playgrounds', async () => {
		const first = createCollector();
		const second = createCollector();
		await first.request('a much longer old log');
		await second.request('error');
		expect(second.messages()).toEqual(['error']);
	});
});

/** Captures request-end records from one independently tracked Playground log. */
function createCollector() {
	const callbacks: Record<string, () => Promise<void>> = {};
	let log = '';
	const logger = { logMessage: vi.fn() };
	collectPhpLogs(
		logger as unknown as Logger,
		{
			addEventListener: (name: string, callback: () => Promise<void>) => {
				callbacks[name] = callback;
			},
			fileExists: async () => !!log,
			readFileAsText: async () => log,
		} as unknown as UniversalPHP
	);
	return {
		request: async (next: string) => {
			log = next;
			await callbacks['request.end']();
		},
		messages: () =>
			logger.logMessage.mock.calls.map(([record]) => record.message),
	};
}
