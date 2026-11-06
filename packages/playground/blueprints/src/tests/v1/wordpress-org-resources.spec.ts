import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CorePluginResource,
	CoreThemeResource,
	Resource,
} from '../../lib/v1/resources';

describe('WordPress.org resource metadata', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		{
			reference: {
				resource: 'wordpress.org/plugins' as const,
				slug: 'wordpress-seo.23.0.zip',
			},
			metadata: {
				name: 'Yoast SEO',
				download_link: 'https://example.com/latest.zip',
			},
			url: 'https://downloads.wordpress.org/plugin/wordpress-seo.23.0.zip',
			fallbackName: 'Wordpress seo',
			slug: 'wordpress-seo',
		},
		{
			reference: {
				resource: 'wordpress.org/themes' as const,
				slug: 'twentytwentyfive.1.4.zip',
			},
			metadata: {
				name: 'Twenty Twenty-Five',
				download_link: 'https://example.com/latest.zip',
			},
			url: 'https://downloads.wordpress.org/theme/twentytwentyfive.1.4.zip',
			fallbackName: 'Twentytwentyfive',
			slug: 'twentytwentyfive',
		},
	])(
		'preserves the requested ZIP and filename for $reference.resource',
		async ({ reference, metadata, url, fallbackName, slug }) => {
			const originalReference = structuredClone(reference);
			const requests: string[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					requests.push(request.url);
					if (new URL(request.url).hostname === 'api.wordpress.org') {
						expect(
							new URL(request.url).searchParams.get('slug')
						).toBe(slug);
						return Response.json(metadata);
					}
					return new Response('requested archive');
				})
			);
			// Exercise the cache/decorator path used by the compiler, too.
			const resource = Resource.create(reference, {});
			const file = (await resource.resolve()) as File;
			expect(resource.name).toBe(metadata.name);
			expect(file.name).toBe(fallbackName);
			expect(await file.text()).toBe('requested archive');
			expect(requests[1]).toBe(url);
			expect(reference).toEqual(originalReference);
			await resource.resolve();
			expect(requests).toHaveLength(2);
		}
	);

	it.each([
		() => Promise.reject(new TypeError('Network unavailable')),
		() => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
		() => Promise.resolve(new Response('Unavailable', { status: 503 })),
		() => Promise.resolve(new Response('Invalid JSON')),
		() => Promise.resolve(Response.json(null)),
		() => Promise.resolve(Response.json({ name: 42 })),
	])(
		'downloads the archive when optional metadata is unavailable (%#)',
		async (metadataResponse) => {
			vi.stubGlobal(
				'fetch',
				vi.fn((request: Request) => {
					return new URL(request.url).hostname === 'api.wordpress.org'
						? metadataResponse()
						: Promise.resolve(new Response('archive'));
				})
			);
			for (const resource of [
				new CorePluginResource({
					resource: 'wordpress.org/plugins',
					slug: 'woocommerce',
				}),
				new CoreThemeResource({
					resource: 'wordpress.org/themes',
					slug: 'storefront',
				}),
			]) {
				const file = await resource.resolve();
				expect(await file.text()).toBe('archive');
				expect(file.name).toBe(resource.name);
			}
		}
	);

	it('decodes named and numeric HTML entities without a browser DOM', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn((request: Request) =>
				Promise.resolve(
					new URL(request.url).hostname === 'api.wordpress.org'
						? Response.json({
								name: 'Health Check &amp; Troubleshooting &#8212; &#x1F680;',
							})
						: new Response('archive')
				)
			)
		);
		const resource = new CorePluginResource({
			resource: 'wordpress.org/plugins',
			slug: 'health-check',
		});
		await resource.resolve();
		expect(resource.name).toBe('Health Check & Troubleshooting — 🚀');
	});
});
