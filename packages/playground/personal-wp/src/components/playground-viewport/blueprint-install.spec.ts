import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlueprintBundle } from '@wp-playground/blueprints';
import {
	fetchBlueprint,
	getBlueprintInstallPreview,
	getBlueprintInstallSource,
	getTrustedBlueprintInstallSource,
	prepareBlueprintForRemoteInstall,
	resolveBlueprintForInstall,
	resolveBlueprintForInstallExecution,
	shouldSkipBlueprintInstallConfirmation,
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

	it('removes login directives from install execution blueprints', async () => {
		const installPluginStep = {
			step: 'installPlugin',
			pluginData: {
				resource: 'wordpress.org/plugins',
				slug: 'friends',
			},
		};
		const expectedDeclaration = {
			landingPage: '/friends/',
			steps: [installPluginStep],
		};
		stubFetchBlueprint({
			login: true,
			landingPage: '/friends/',
			steps: [
				{
					step: 'login',
					username: 'admin',
				},
				installPluginStep,
			],
		});

		const { blueprint, declaration } =
			await resolveBlueprintForInstallExecution(
				'https://example.com/blueprint.json'
			);
		const bundledDeclaration = JSON.parse(
			await (await blueprint.read('blueprint.json')).text()
		);

		expect(declaration).toEqual(expectedDeclaration);
		expect(bundledDeclaration).toEqual(expectedDeclaration);
	});

	it('builds a blueprint preview for the install dialog', async () => {
		const blueprint = {
			meta: {
				title: 'Friends',
				description: 'A private social app for WordPress.',
				author: 'wordpress',
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
		};
		stubFetchBlueprint(blueprint);

		const preview = await getBlueprintInstallPreview(
			'https://example.com/blueprint.json'
		);

		expect(preview).toEqual({
			title: 'Friends',
			description: 'A private social app for WordPress.',
			author: 'wordpress',
			warnings: [
				expect.objectContaining({
					severity: 'warning',
					title: 'Installs plugin from an external source',
				}),
			],
			json: JSON.stringify(blueprint, null, 2),
		});
	});

	it('describes data URL app requests as coming from this page', () => {
		expect(
			getBlueprintInstallSource(
				'data:application/json;base64,eyJzdGVwcyI6W119'
			)
		).toEqual({ label: 'this page' });
	});

	it('falls back to a protocol label for hostless URLs', () => {
		expect(getBlueprintInstallSource('about:blank')).toEqual({
			label: 'about source',
		});
	});

	it('preserves empty metadata strings in the preview', async () => {
		const blueprint = {
			meta: {
				title: '',
				description: '',
				author: '',
			},
			steps: [],
		};
		stubFetchBlueprint(blueprint);

		await expect(
			getBlueprintInstallPreview('https://example.com/blueprint.json')
		).resolves.toEqual({
			title: '',
			description: '',
			author: '',
			warnings: [],
			json: JSON.stringify(blueprint, null, 2),
		});
	});

	it('skips confirmation for My Apps locations', () => {
		expect(shouldSkipBlueprintInstallConfirmation('/my-apps/')).toBe(true);
		expect(shouldSkipBlueprintInstallConfirmation('/my-apps')).toBe(true);
		expect(
			shouldSkipBlueprintInstallConfirmation('/my-apps/?category=forms')
		).toBe(true);
		expect(
			shouldSkipBlueprintInstallConfirmation(
				'https://playground.local/scope:test-site/my-apps/?category=forms'
			)
		).toBe(true);
	});

	it('reports the trusted My Apps install source', () => {
		expect(getTrustedBlueprintInstallSource('/my-apps/')).toBe('my-apps');
		expect(getTrustedBlueprintInstallSource('/my-apps')).toBe('my-apps');
		expect(
			getTrustedBlueprintInstallSource(
				'https://playground.local/scope:test-site/my-apps/?category=forms'
			)
		).toBe('my-apps');
		expect(
			getTrustedBlueprintInstallSource('/wp-admin/admin.php?page=my-apps')
		).toBeUndefined();
	});

	it('requires an exact trusted path before skipping confirmation', () => {
		expect(shouldSkipBlueprintInstallConfirmation('/')).toBe(false);
		expect(shouldSkipBlueprintInstallConfirmation('/my-apps-copy/')).toBe(
			false
		);
		expect(
			shouldSkipBlueprintInstallConfirmation(
				'/wp-admin/admin.php?page=my-apps'
			)
		).toBe(false);
		expect(shouldSkipBlueprintInstallConfirmation(undefined)).toBe(false);
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
