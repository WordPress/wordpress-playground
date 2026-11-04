import { afterEach, expect, it, vi } from 'vitest';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';

vi.mock('./config', () => ({
	playgroundOrigin: 'http://playground.localhost:9500',
	wordPressSiteUrl: 'http://wp.playground.localhost:9500',
}));
vi.mock('@wp-playground/wordpress', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getLoadedWordPressVersion: async () => '6.9',
}));

afterEach(() => vi.unstubAllGlobals());

it('recovers a missing asset list from the shared origin for a stored minified site', async () => {
	vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
	const fetch = vi.fn(
		async () => new Response('wp-includes/js/jquery/jquery.min.js')
	);
	vi.stubGlobal('fetch', fetch);
	const writeFile = vi.fn();
	const php = {
		fileExists: () => false,
		writeFile,
		isFile: () => true,
		readFileAsText: () => 'wp-includes/js/jquery/jquery.min.js',
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
	const paths = new Set<string>();
	await endpoint.recoverAssetList(paths);

	expect(fetch).toHaveBeenCalledWith(
		new URL(
			'http://playground.localhost:9500/wp-6.9/wordpress-remote-asset-paths'
		)
	);
	expect(writeFile).toHaveBeenCalledWith(
		'/wordpress/wordpress-remote-asset-paths',
		'wp-includes/js/jquery/jquery.min.js'
	);
	expect(paths.has('/wp-includes/js/jquery/jquery.min.js')).toBe(true);
});
