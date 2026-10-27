import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceSiteUrl } from '@wp-playground/blueprints';

vi.mock('@wp-playground/blueprints', () => ({
	replaceSiteUrl: vi.fn(),
}));
vi.mock('./config', () => ({
	playgroundOrigin: 'https://playground.wordpress.net',
}));

describe('stored site URL migration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
	});

	afterEach(() => vi.unstubAllGlobals());

	it('migrates a stored site once and saves its data before its completion record', async () => {
		const { endpoint, php, files } = await createMigration();
		const siteUrl = 'https://wpsandbox.wordpress.net/scope:saved-site/';
		endpoint.flushOpfs.mockImplementation(async () => {
			if (endpoint.flushOpfs.mock.calls.length === 1) {
				expect(files.has('/wordpress/.playground-site-url')).toBe(
					false
				);
			}
		});

		await endpoint.migrateSiteUrl(php, siteUrl);
		const reopened = await createMigration(files);
		await reopened.endpoint.migrateSiteUrl(reopened.php, siteUrl);

		expect(replaceSiteUrl).toHaveBeenCalledTimes(1);
		expect(replaceSiteUrl).toHaveBeenCalledWith(
			php,
			'/wordpress',
			'https://playground.wordpress.net/scope:saved-site',
			siteUrl
		);
		expect(endpoint.flushOpfs).toHaveBeenCalledTimes(2);
		expect(reopened.endpoint.flushOpfs).not.toHaveBeenCalled();
		expect(files.get('/wordpress/.playground-site-url')).toBe(siteUrl);
	});

	it('does not record completion when saving the migrated data fails', async () => {
		const { endpoint, php, files } = await createMigration();
		const failure = new Error('Storage full');
		endpoint.flushOpfs.mockRejectedValueOnce(failure);
		const siteUrl = 'https://wpsandbox.wordpress.net/scope:saved-site/';

		await expect(endpoint.migrateSiteUrl(php, siteUrl)).rejects.toBe(
			failure
		);
		expect(files.has('/wordpress/.playground-site-url')).toBe(false);
		await endpoint.migrateSiteUrl(php, siteUrl);
		expect(replaceSiteUrl).toHaveBeenCalledTimes(2);
	});

	it('records the URL of a new site without scanning its database', async () => {
		const { endpoint, php, files } = await createMigration();
		endpoint.hasOpfsMount.mockResolvedValue(false);
		const siteUrl = 'https://wpsandbox.wordpress.net/scope:new-site/';

		await endpoint.migrateSiteUrl(php, siteUrl);

		expect(replaceSiteUrl).not.toHaveBeenCalled();
		expect(endpoint.flushOpfs).not.toHaveBeenCalled();
		expect(files.get('/wordpress/.playground-site-url')).toBe(siteUrl);
	});
});

/** Creates a worker fixture that can reopen the same saved URL record. */
async function createMigration(files = new Map<string, string>()) {
	const { PlaygroundWorkerEndpointBlueprints } =
		await import('./blueprints-worker');
	const endpoint = Object.create(
		PlaygroundWorkerEndpointBlueprints.prototype
	) as any;
	endpoint.scope = 'saved-site';
	endpoint.hasOpfsMount = vi.fn(async () => true);
	endpoint.flushOpfs = vi.fn(async () => {});
	const php = {
		documentRoot: '/wordpress',
		fileExists: (path: string) => files.has(path),
		readFileAsText: (path: string) => files.get(path),
		writeFile: (path: string, contents: string) =>
			files.set(path, contents),
	};
	return { endpoint, php, files };
}
