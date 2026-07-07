// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDatabaseDownloadScript,
	downloadDatabase,
} from './download-database';

describe('downloadDatabase', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('downloads through a token-gated PHP script instead of buffering in JS', async () => {
		const databasePath = '/wordpress/wp-content/database/.ht.sqlite';
		const playground = createPlaygroundClient(databasePath);
		const appendChildSpy = vi.spyOn(document.body, 'appendChild');

		try {
			await downloadDatabase(playground, databasePath);

			expect(playground.readFileAsBuffer).not.toHaveBeenCalled();
			expect(playground.writeFile).toHaveBeenCalledOnce();
			const [scriptPath, script] = playground.writeFile.mock.calls[0];
			expect(scriptPath).toMatch(
				/^\/wordpress\/\.playground-database-download-[a-f0-9]{32}\.php$/
			);
			expect(script).toContain(
				"$databasePath = '/wordpress/wp-content/database/.ht.sqlite';"
			);
			expect(script).toContain('fread($handle, 1048576)');

			const frame = appendChildSpy.mock.calls[0][0] as HTMLIFrameElement;
			expect(frame.src).toMatch(
				/^https:\/\/example\.test\/scope:test\/\.playground-database-download-[a-f0-9]{32}\.php\?token=[a-f0-9]{32}$/
			);
			expect(frame.hidden).toBe(true);
			expect(frame.getAttribute('aria-hidden')).toBe('true');
			expect(playground.unlink).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(60_000);
			expect(playground.unlink).toHaveBeenCalledWith(scriptPath);
			expect(frame.isConnected).toBe(true);

			await vi.advanceTimersByTimeAsync(9 * 60_000);
			expect(frame.isConnected).toBe(false);
		} finally {
			appendChildSpy.mockRestore();
		}
	});
});

describe('createDatabaseDownloadScript', () => {
	it('escapes PHP string literals and stays compatible with legacy PHP', () => {
		const script = createDatabaseDownloadScript(
			"/wordpress/wp-content/weird'\\db.sqlite",
			'abcdef0123456789abcdef0123456789'
		);

		expect(script).toContain(
			"$databasePath = '/wordpress/wp-content/weird\\'\\\\db.sqlite';"
		);
		expect(script).toContain(
			"register_shutdown_function('playground_database_download_cleanup_abcdef0123456789abcdef0123456789')"
		);
		expect(script).toContain('$providedToken !== $expectedToken');
		expect(script).toContain("is_string($_GET['token'])");
		expect(script).toContain('fread($handle, 1048576)');
		expect(script).not.toContain('function ()');
		expect(script).not.toContain('=>');
	});

	it('rejects tokens that cannot be embedded in PHP function names', () => {
		expect(() =>
			createDatabaseDownloadScript(
				'/wordpress/database.sqlite',
				'bad-token'
			)
		).toThrow('Invalid database download token.');
	});
});

function createPlaygroundClient(databasePath: string) {
	return {
		absoluteUrl: Promise.resolve('https://example.test/scope:test'),
		documentRoot: Promise.resolve('/wordpress'),
		fileExists: vi.fn(async (path: string) => path === databasePath),
		readFileAsBuffer: vi.fn(),
		unlink: vi.fn(async (path: string) => {
			void path;
		}),
		writeFile: vi.fn(async (path: string, contents: string) => {
			void path;
			void contents;
		}),
	};
}
