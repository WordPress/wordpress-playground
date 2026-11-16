import { afterEach, expect, it, vi } from 'vitest';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';

const config = vi.hoisted(() => ({
	playgroundOrigin: 'http://playground.localhost:9500',
	wordPressSiteUrl: 'http://wp.playground.localhost:9500',
	releaseBase: '/',
}));
vi.mock('./config', () => config);
vi.mock('@wp-playground/wordpress', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getLoadedWordPressVersion: async () => '6.9',
}));

afterEach(() => vi.unstubAllGlobals());

it.each(['/', '/releases/stored/'])(
	'recovers a missing asset list from its runtime release: %s',
	async (releaseBase) => {
		config.releaseBase = releaseBase;
		const fetch = vi.fn(
			async () => new Response('wp-includes/js/jquery/jquery.min.js')
		);
		vi.stubGlobal('fetch', fetch);
		const { endpoint, writeFile } = await createEndpointFixture();
		const paths = new Set<string>();
		await endpoint.recoverAssetList(paths);

		expect(fetch).toHaveBeenCalledWith(
			new URL(
				`http://playground.localhost:9500${releaseBase}wp-6.9/wordpress-remote-asset-paths`
			)
		);
		expect(writeFile).toHaveBeenCalledWith(
			'/wordpress/wordpress-remote-asset-paths',
			'wp-includes/js/jquery/jquery.min.js'
		);
		expect(paths.has('/wp-includes/js/jquery/jquery.min.js')).toBe(true);
	}
);

// Contract: an unavailable list must not abort startup or become a saved file.
// fetch() resolves on HTTP errors, so a response check can independently regress
// from the catch that permits startup and a later boot's recovery attempt.
it.each([404, 500])(
	'continues after HTTP %s without saving the error page, and retries next boot',
	async (status) => {
		config.releaseBase = '/releases/current/';
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response('<h1>Error</h1>', { status }))
			.mockResolvedValueOnce(
				new Response('wp-includes/js/jquery/jquery.min.js')
			);
		vi.stubGlobal('fetch', fetch);
		const { endpoint, writeFile } = await createEndpointFixture();
		const paths = new Set<string>();

		await expect(endpoint.recoverAssetList(paths)).resolves.toBeUndefined();
		expect(writeFile).not.toHaveBeenCalled();
		expect(paths.size).toBe(0);

		await endpoint.recoverAssetList(paths);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(writeFile).toHaveBeenCalledOnce();
		expect(paths.has('/wp-includes/js/jquery/jquery.min.js')).toBe(true);
	}
);

async function createEndpointFixture() {
	vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
	let savedList: string | undefined;
	const writeFile = vi.fn((_path: string, contents: string) => {
		savedList = contents;
	});
	const php = {
		fileExists: () => savedList !== undefined,
		writeFile,
		isFile: () => savedList !== undefined,
		readFileAsText: () => savedList!,
	};
	const handler = {
		documentRoot: '/wordpress',
		getPrimaryPhp: async () => php,
	};
	const { PlaygroundWorkerEndpoint } =
		await import('./playground-worker-endpoint');
	class TestEndpoint extends PlaygroundWorkerEndpoint {
		/** This fixture exercises finalization directly, not the full boot sequence. */
		async boot() {}

		/** Run the post-boot asset recovery without downloading a PHP runtime. */
		async recoverAssetList(paths: Set<string>) {
			return this.finalizeAfterBoot(handler, false, paths);
		}
	}
	const endpoint = new TestEndpoint({} as EmscriptenDownloadMonitor);
	endpoint.requestedWordPressVersion = '6.9';
	return { endpoint, writeFile };
}
