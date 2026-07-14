import { describe, expect, it } from 'vitest';
import { RequestRouter } from './request-router';
import type { RouterFilesystem, ResolvedRoute } from './request-router';
import { PHPResponse } from './php-response';

/**
 * Creates a mock RouterFilesystem backed by a Map.
 */
function createMockFs(entries: Map<string, 'file' | 'dir'>): RouterFilesystem {
	return {
		isFile: (path: string) => entries.get(path) === 'file',
		isDir: (path: string) => entries.get(path) === 'dir',
	};
}

describe('RequestRouter', () => {
	describe('static files', () => {
		it('resolves a static file', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/style.css', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({ url: '/style.css' });
			expect(route).toEqual({
				type: 'static-file',
				fsPath: '/www/style.css',
			});
		});

		it('resolves nested static files', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/assets/img/logo.png', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({
				url: '/assets/img/logo.png',
			});
			expect(route).toEqual({
				type: 'static-file',
				fsPath: '/www/assets/img/logo.png',
			});
		});
	});

	describe('PHP files', () => {
		it('resolves a PHP file', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({ url: '/index.php' });
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/index.php',
			});
		});

		it('resolves partial path (PATH_INFO) to PHP file', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/file.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({
				url: '/file.php/extra/path',
			});
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/file.php',
			});
		});
	});

	describe('directories', () => {
		it('redirects dir without trailing slash', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/subdir', 'dir'],
					['/www/subdir/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({ url: '/subdir' });
			expect(route).toEqual({
				type: 'redirect',
				statusCode: 301,
				headers: { location: ['/subdir/'] },
			});
		});

		it('resolves dir with trailing slash to index.php', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/subdir', 'dir'],
					['/www/subdir/', 'dir'],
					['/www/subdir/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({ url: '/subdir/' });
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/subdir/index.php',
			});
		});

		it('resolves dir with trailing slash to index.html', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/docs', 'dir'],
					['/www/docs/', 'dir'],
					['/www/docs/index.html', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({ url: '/docs/' });
			expect(route).toEqual({
				type: 'static-file',
				fsPath: '/www/docs/index.html',
			});
		});
	});

	describe('file not found', () => {
		it('returns 404 by default', () => {
			const fs = createMockFs(new Map([['/www', 'dir']]));
			const router = new RequestRouter({
				documentRoot: '/www',
				fs,
			});

			const route = router.resolve({ url: '/nonexistent.txt' });
			expect(route).toEqual({ type: '404' });
		});

		it('handles internal-redirect action (WordPress fallback)', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				getFileNotFoundAction: () => ({
					type: 'internal-redirect',
					uri: '/index.php',
				}),
				fs,
			});

			const route = router.resolve({
				url: '/pretty-permalink',
			});
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/index.php',
			});
		});

		it('handles response action', () => {
			const customResponse = new PHPResponse(
				403,
				{ 'content-type': ['text/plain'] },
				new Uint8Array(Buffer.from('Forbidden'))
			);
			const fs = createMockFs(new Map([['/www', 'dir']]));
			const router = new RequestRouter({
				documentRoot: '/www',
				getFileNotFoundAction: () => ({
					type: 'response',
					response: customResponse,
				}),
				fs,
			});

			const route = router.resolve({ url: '/secret' });
			expect(route.type).toBe('response');
			expect(
				(route as Extract<ResolvedRoute, { type: 'response' }>).response
			).toBe(customResponse);
		});
	});

	describe('rewrite rules', () => {
		it('applies rewrite rules before routing', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				rewriteRules: [
					{
						match: /^\/api\/(.*)$/,
						replacement: '/index.php?route=$1',
					},
				],
				getFileNotFoundAction: () => ({
					type: 'internal-redirect',
					uri: '/index.php',
				}),
				fs,
			});

			const route = router.resolve({ url: '/api/users' });
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/index.php',
			});
		});

		it('WordPress multisite rewrite rule strips site prefix', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/wp-admin/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				rewriteRules: [
					{
						match: new RegExp(
							`^(/[_0-9a-zA-Z-]+)?(/wp-(content|admin|includes).*)`
						),
						replacement: '$2',
					},
				],
				fs,
			});

			const route = router.resolve({
				url: '/mysite/wp-admin/index.php',
			});
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/wp-admin/index.php',
			});
		});
	});

	describe('path aliases', () => {
		it('resolves aliased paths', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/tools/phpmyadmin', 'dir'],
					['/tools/phpmyadmin/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				pathAliases: [
					{
						urlPrefix: '/phpmyadmin',
						fsPath: '/tools/phpmyadmin',
					},
				],
				fs,
			});

			const route = router.resolve({
				url: '/phpmyadmin/index.php',
			});
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/tools/phpmyadmin/index.php',
			});
		});

		it('falls back to document root for non-aliased paths', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/index.php', 'file'],
					['/tools/phpmyadmin', 'dir'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				pathAliases: [
					{
						urlPrefix: '/phpmyadmin',
						fsPath: '/tools/phpmyadmin',
					},
				],
				fs,
			});

			const route = router.resolve({ url: '/index.php' });
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/index.php',
			});
		});

		it('matches alias exactly at prefix boundary', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/phpmyadmin-extra', 'dir'],
					['/www/phpmyadmin-extra/index.php', 'file'],
					['/tools/phpmyadmin', 'dir'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				pathAliases: [
					{
						urlPrefix: '/phpmyadmin',
						fsPath: '/tools/phpmyadmin',
					},
				],
				fs,
			});

			const route = router.resolve({
				url: '/phpmyadmin-extra/index.php',
			});
			// Should resolve in document root, not alias
			expect(route).toMatchObject({
				type: 'php',
				fsPath: '/www/phpmyadmin-extra/index.php',
			});
		});
	});

	describe('URL pathname prefix', () => {
		it('strips pathname prefix before resolving', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/style.css', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				pathname: '/scope:mysite',
				fs,
			});

			const route = router.resolve({
				url: '/scope:mysite/style.css',
			});
			expect(route).toEqual({
				type: 'static-file',
				fsPath: '/www/style.css',
			});
		});
	});

	/**
	 * PHPRequestHandler derives $_SERVER['PHP_SELF'] and the relative URI it
	 * hands to PHP from `rewrittenRequestUrl`, so the router must report the
	 * URL it actually resolved `fsPath` from — including the directory index
	 * file it appended and the query string the rewrite rules produced.
	 */
	describe('rewritten request URL of PHP routes', () => {
		function resolvePhpRoute(
			router: RequestRouter,
			url: string
		): Extract<ResolvedRoute, { type: 'php' }> {
			const route = router.resolve({ url });
			if (route.type !== 'php') {
				throw new Error(`Expected a PHP route, got '${route.type}'`);
			}
			return route;
		}

		it('appends the resolved index file for a directory request', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/subdir', 'dir'],
					['/www/subdir/', 'dir'],
					['/www/subdir/index.php', 'file'],
				])
			);
			const router = new RequestRouter({ documentRoot: '/www', fs });

			const route = resolvePhpRoute(router, '/subdir/');
			expect(route.rewrittenRequestUrl.pathname).toBe(
				'/subdir/index.php'
			);
			expect(route.originalRequestUrl.pathname).toBe('/subdir/');
		});

		it('appends the resolved index file for the document root', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					// `/` resolves to the document root with a trailing slash.
					['/www/', 'dir'],
					['/www/index.php', 'file'],
				])
			);
			const router = new RequestRouter({ documentRoot: '/www', fs });

			expect(
				resolvePhpRoute(router, '/').rewrittenRequestUrl.pathname
			).toBe('/index.php');
		});

		it('preserves the query string of a directory request', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/subdir', 'dir'],
					['/www/subdir/', 'dir'],
					['/www/subdir/index.php', 'file'],
				])
			);
			const router = new RequestRouter({ documentRoot: '/www', fs });

			const route = resolvePhpRoute(router, '/subdir/?foo=bar');
			expect(route.rewrittenRequestUrl.pathname).toBe(
				'/subdir/index.php'
			);
			expect(route.rewrittenRequestUrl.search).toBe('?foo=bar');
		});

		it('reports the rewritten path and merged query string', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				rewriteRules: [
					{
						match: /^\/api\/(.*)$/,
						replacement: '/index.php?route=$1',
					},
				],
				fs,
			});

			const route = resolvePhpRoute(router, '/api/users?page=2');
			expect(route.rewrittenRequestUrl.pathname).toBe('/index.php');
			expect(route.rewrittenRequestUrl.searchParams.get('route')).toBe(
				'users'
			);
			expect(route.rewrittenRequestUrl.searchParams.get('page')).toBe(
				'2'
			);
			expect(route.originalRequestUrl.pathname).toBe('/api/users');
		});

		it('keeps the pathname prefix in the rewritten URL', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/wp-admin', 'dir'],
					['/www/wp-admin/', 'dir'],
					['/www/wp-admin/index.php', 'file'],
				])
			);
			const router = new RequestRouter({
				documentRoot: '/www',
				pathname: '/scope:mysite',
				fs,
			});

			const route = resolvePhpRoute(router, '/scope:mysite/wp-admin/');
			expect(route.rewrittenRequestUrl.pathname).toBe(
				'/scope:mysite/wp-admin/index.php'
			);
		});

		it('leaves the trailing path info of a partial path match', () => {
			const fs = createMockFs(
				new Map([
					['/www', 'dir'],
					['/www/file.php', 'file'],
				])
			);
			const router = new RequestRouter({ documentRoot: '/www', fs });

			const route = resolvePhpRoute(router, '/file.php/extra/path');
			expect(route.fsPath).toBe('/www/file.php');
			expect(route.rewrittenRequestUrl.pathname).toBe(
				'/file.php/extra/path'
			);
		});
	});
});
