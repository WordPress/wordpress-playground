import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	fetchBlueprint,
	prepareBlueprintForRemoteInstall,
} from './blueprint-install';

describe('prepareBlueprintForRemoteInstall', () => {
	beforeEach(() => {
		vi.stubGlobal('btoa', (value: string) =>
			Buffer.from(value, 'binary').toString('base64')
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('removes landingPage before forwarding a blueprint to the main tab', async () => {
		stubFetchBlueprint({
			meta: {
				title: 'Friends',
			},
			landingPage: '/wp-admin/admin.php?page=friends',
			steps: [
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'url',
						url: 'https://example.com/friends.zip',
					},
				},
			],
		});

		const result = await prepareBlueprintForRemoteInstall(
			'https://example.com/blueprint.json'
		);

		expect(result.landingPage).toBe('/wp-admin/admin.php?page=friends');
		expect(result.blueprintUrl).toMatch(/^data:application\/json;base64,/);
		expect(decodeDataUrlBlueprint(result.blueprintUrl)).toEqual({
			meta: {
				title: 'Friends',
			},
			steps: [
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'url',
						url: 'https://example.com/friends.zip',
					},
				},
			],
		});
	});

	it('keeps the original blueprint URL when there is no landingPage', async () => {
		stubFetchBlueprint({
			steps: [
				{
					step: 'activatePlugin',
					pluginPath: 'friends/friends.php',
				},
			],
		});

		await expect(
			prepareBlueprintForRemoteInstall(
				'https://example.com/blueprint.json'
			)
		).resolves.toEqual({
			blueprintUrl: 'https://example.com/blueprint.json',
		});
	});

	it('fetches remote blueprints through the CORS proxy fallback', async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ steps: [] }), {
					headers: {
						'X-Playground-Cors-Proxy': '1',
					},
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			fetchBlueprint(
				'https://example.com/blueprint.json',
				'https://proxy.example.com/'
			)
		).resolves.toEqual({ steps: [] });

		const proxiedRequest = fetchMock.mock.calls[1][0] as Request;
		expect(proxiedRequest.url).toBe(
			'https://proxy.example.com/https://example.com/blueprint.json'
		);
	});
});

function stubFetchBlueprint(blueprint: object): void {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => blueprint,
		})
	);
}

function decodeDataUrlBlueprint(blueprintUrl: string): unknown {
	const encoded = blueprintUrl.replace(/^data:application\/json;base64,/, '');
	return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
