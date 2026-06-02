import { describe, expect, it } from 'vitest';
import { resolveKnownRemoteAssetUrl } from './known-remote-asset';

describe('resolveKnownRemoteAssetUrl', () => {
	it('resolves a listed WordPress asset to the static assets directory', () => {
		const url = resolveKnownRemoteAssetUrl(
			new URL(
				'http://127.0.0.1:5400/wp-includes/css/dist/block-library/style.min.css?ver=6.8'
			),
			{
				staticAssetsDirectory: 'wp-6.8',
				remoteAssetPaths: [
					'/wp-includes/css/dist/block-library/style.min.css',
				],
			}
		);

		expect(url?.toString()).toBe(
			'http://127.0.0.1:5400/wp-6.8/wp-includes/css/dist/block-library/style.min.css?ver=6.8'
		);
	});

	it('does not resolve assets that are not listed as remote assets', () => {
		const url = resolveKnownRemoteAssetUrl(
			new URL('http://127.0.0.1:5400/wp-includes/js/jquery/jquery.js'),
			{
				staticAssetsDirectory: 'wp-6.8',
				remoteAssetPaths: ['/wp-includes/js/dist/editor.min.js'],
			}
		);

		expect(url).toBeUndefined();
	});

	it('does not resolve assets without a static assets directory', () => {
		const url = resolveKnownRemoteAssetUrl(
			new URL('http://127.0.0.1:5400/wp-includes/js/dist/editor.min.js'),
			{
				remoteAssetPaths: ['/wp-includes/js/dist/editor.min.js'],
			}
		);

		expect(url).toBeUndefined();
	});

	it('does not resolve the front page to a remote asset', () => {
		const url = resolveKnownRemoteAssetUrl(
			new URL('http://127.0.0.1:5400/'),
			{
				staticAssetsDirectory: 'wp-6.8',
				remoteAssetPaths: ['/'],
			}
		);

		expect(url).toBeUndefined();
	});
});
