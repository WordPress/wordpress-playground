import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlueprintBundle } from '@wp-playground/blueprints';
import {
	fetchBlueprint,
	prepareBlueprintForRemoteInstall,
	resolveBlueprintForInstall,
} from './blueprint-install';

describe('prepareBlueprintForRemoteInstall', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps the original blueprint URL when forwarding to the main tab', async () => {
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
		expect(result.blueprintUrl).toBe('https://example.com/blueprint.json');
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

		const blueprint = await resolveBlueprintForInstall(
			'https://example.com/blueprint.json',
			'https://proxy.example.com/'
		);

		expect(isBlueprintBundle(blueprint)).toBe(true);

		const proxiedRequest = fetchMock.mock.calls[1][0] as Request;
		expect(proxiedRequest.url).toBe(
			'https://proxy.example.com/https://example.com/blueprint.json'
		);
	});

	it('keeps bundled resources available relative to JSON blueprints', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						steps: [
							{
								step: 'writeFile',
								path: '/wordpress/hello.txt',
								data: {
									resource: 'bundled',
									path: '/hello.txt',
								},
							},
						],
					})
				)
			)
			.mockResolvedValueOnce(new Response('Hello from bundle'));
		vi.stubGlobal('fetch', fetchMock);

		const blueprint = await resolveBlueprintForInstall(
			'https://example.com/blueprints/app/blueprint.json'
		);
		const bundledFile = await blueprint.read('/hello.txt');

		await expect(bundledFile.text()).resolves.toBe('Hello from bundle');
		expect(fetchMock.mock.calls[1][0]).toBe(
			'https://example.com/blueprints/app/hello.txt'
		);
	});

	it('fetchBlueprint returns the declaration from the resolved bundle', async () => {
		stubFetchBlueprint({
			landingPage: '/wp-admin/',
			steps: [],
		});

		await expect(
			fetchBlueprint('https://example.com/blueprint.json')
		).resolves.toEqual({
			landingPage: '/wp-admin/',
			steps: [],
		});
	});
});

function stubFetchBlueprint(blueprint: object): void {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(new Response(JSON.stringify(blueprint)))
	);
}

function isBlueprintBundle(value: unknown): value is BlueprintBundle {
	return (
		!!value &&
		typeof value === 'object' &&
		'read' in value &&
		typeof value.read === 'function'
	);
}
