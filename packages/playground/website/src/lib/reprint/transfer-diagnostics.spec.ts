import type { PlaygroundClient } from '@wp-playground/client';
import { getTransferDiagnostics } from './transfer-diagnostics';

// Direct file reads do not queue behind a PHP request, but they still need
// the worker to answer. Keep partial records if that worker stops responding.
describe('Reprint transfer diagnostics', () => {
	it('reads the failed stage and audit tail without running PHP or exporting site data', async () => {
		const root = '/tmp/playground-reprint-state/site';
		const files: Record<string, string> = {
			[root + '/operation.json']: '{"kind":"pull","stage":"files-pull"}',
			[root + '/pull-state/progress.json']: '{"status":"partial"}',
			[root + '/pull-state/audit.log']:
				'old line\n'.repeat(2000) +
				'Failed path with -----BEGIN PRIVATE KEY-----\nprivate-key\n-----END PRIVATE KEY-----\n',
			[root + '/pull-state/db.sql']: 'private database',
		};
		const playground = {
			fileExists: vi.fn(
				async (path: string) =>
					path === '/tmp/playground-reprint-state' || path in files
			),
			listFiles: vi.fn(async () => ['site']),
			readFileAsText: vi.fn(async (path: string) => files[path]),
			run: vi.fn(() => new Promise(() => {})),
		} as unknown as PlaygroundClient;
		const report = await getTransferDiagnostics(playground);
		expect(report).toContain('"stage":"files-pull"');
		expect(report).toContain('"status":"partial"');
		expect(report).toContain('Failed path with [redacted]');
		expect(report).not.toContain('private-key');
		expect(report).not.toContain('private database');
		expect(report.length).toBeLessThan(13000);
		expect(playground.run).not.toHaveBeenCalled();
		expect(playground.readFileAsText).not.toHaveBeenCalledWith(
			root + '/pull-state/db.sql'
		);
	});
	it.each(['root', 'directories', 'record', 'contents'])(
		'stops queueing worker reads after timing out at %s',
		async (pause) => {
			vi.useFakeTimers();
			try {
				let unblock!: (value: unknown) => void;
				const blocked = new Promise((resolve) => {
					unblock = resolve;
				});
				const root = '/tmp/playground-reprint-state';
				const fileExists = vi.fn(async (path: string) =>
					(pause === 'root' && path === root) ||
					(pause === 'record' &&
						path === root + '/site/operation.json')
						? blocked
						: true
				);
				const listFiles = vi.fn(async () =>
					pause === 'directories' ? blocked : ['site']
				);
				const readFileAsText = vi.fn(async () =>
					pause === 'contents' ? blocked : '{}'
				);
				const report = getTransferDiagnostics({
					fileExists,
					listFiles,
					readFileAsText,
				} as unknown as PlaygroundClient);
				await vi.advanceTimersByTimeAsync(10000);
				expect(await report).toContain('did not answer');
				const calls = [fileExists, listFiles, readFileAsText].map(
					(method) => method.mock.calls.length
				);
				unblock(
					pause === 'directories'
						? ['site']
						: pause === 'contents'
							? '{}'
							: true
				);
				await vi.advanceTimersByTimeAsync(0);
				expect(
					[fileExists, listFiles, readFileAsText].map(
						(method) => method.mock.calls.length
					)
				).toEqual(calls);
				expect(vi.getTimerCount()).toBe(0);
			} finally {
				vi.useRealTimers();
			}
		}
	);
	it('returns the records already read when the worker stops answering', async () => {
		vi.useFakeTimers();
		try {
			const playground = {
				fileExists: vi.fn(async () => true),
				listFiles: vi.fn(async () => ['site']),
				readFileAsText: vi
					.fn()
					.mockResolvedValueOnce('{"stage":"files-pull"}')
					.mockImplementation(() => new Promise(() => {})),
			} as unknown as PlaygroundClient;
			const report = getTransferDiagnostics(playground);
			await vi.advanceTimersByTimeAsync(10000);
			expect(await report).toContain('"stage":"files-pull"');
			expect(await report).toContain('did not answer');
			expect(await report).toContain('pull-state/progress.json');
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});
