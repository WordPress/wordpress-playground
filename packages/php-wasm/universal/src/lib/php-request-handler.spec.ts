import { describe, expect, it, vi } from 'vitest';
import { PHPRequestHandler } from './php-request-handler';
import { PHPResponse, StreamedPHPResponse } from './php-response';
import type { PHP } from './php';

/**
 * Creates a mock PHP instance with a simulated filesystem.
 * The filesystem is represented as a Map where keys are paths and values
 * indicate whether the path is a file ('file'), directory ('dir'), or doesn't exist.
 */
function createMockPHP(filesystem: Map<string, 'file' | 'dir'>) {
	const mockPHP = {
		chdir: vi.fn(),
		mkdir: vi.fn(),
		isDir: vi.fn((path: string) => filesystem.get(path) === 'dir'),
		isFile: vi.fn((path: string) => filesystem.get(path) === 'file'),
		readFileAsBuffer: vi.fn((path: string) => {
			if (filesystem.get(path) === 'file') {
				return new Uint8Array(Buffer.from(`Content of ${path}`));
			}
			throw new Error(`File not found: ${path}`);
		}),
		addEventListener: vi.fn(),
		onMessage: vi.fn(() => Promise.resolve(() => {})),
		dispatchEvent: vi.fn(),
		defineConstant: vi.fn(),
		setPhpIniEntry: vi.fn(),
		run: vi.fn(() =>
			Promise.resolve(
				new PHPResponse(
					200,
					{ 'Content-Type': ['text/html'] },
					new Uint8Array(Buffer.from('<?php response'))
				)
			)
		),
		runStream: vi.fn(() =>
			Promise.resolve(
				StreamedPHPResponse.fromPHPResponse(
					new PHPResponse(
						200,
						{ 'Content-Type': ['text/html'] },
						new Uint8Array(Buffer.from('<?php response'))
					)
				)
			)
		),
	} as unknown as PHP;
	return mockPHP;
}

describe('PHPRequestHandler', () => {
	describe('resolves paths through aliases', () => {
		it('should resolve a URL matching an alias prefix to the alias filesystem path', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/tools/phpmyadmin', 'dir'],
				['/tools/phpmyadmin/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			await handler.request({
				url: '/phpmyadmin/index.php',
			});

			// The request should have checked if /tools/phpmyadmin/index.php is a file
			expect(mockPHP.isFile).toHaveBeenCalledWith(
				'/tools/phpmyadmin/index.php'
			);
			// Should NOT have checked /www/phpmyadmin/index.php (document root path)
			expect(mockPHP.isFile).not.toHaveBeenCalledWith(
				'/www/phpmyadmin/index.php'
			);
		});

		it('should resolve directory requests with trailing slash to index.php', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/tools/phpmyadmin', 'dir'],
				['/tools/phpmyadmin/', 'dir'],
				['/tools/phpmyadmin/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			await handler.request({
				url: '/phpmyadmin/',
			});

			// Should check for index.php in the aliased directory
			expect(mockPHP.isFile).toHaveBeenCalledWith(
				'/tools/phpmyadmin/index.php'
			);
		});

		it('should redirect directory requests without trailing slash to add trailing slash', async () => {
			// When the URL is a directory without trailing slash (e.g., /phpmyadmin),
			// the request handler redirects to add the trailing slash.
			// This matches Nginx/Apache behavior and ensures relative links work correctly.
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/tools/phpmyadmin', 'dir'],
				['/tools/phpmyadmin/', 'dir'],
				['/tools/phpmyadmin/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			const response = await handler.request({
				url: '/phpmyadmin',
			});

			// Should redirect to add trailing slash
			expect(response.httpStatusCode).toBe(301);
			expect(response.headers['Location']).toEqual(['/phpmyadmin/']);
		});

		it('should handle nested paths within an alias', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/tools/phpmyadmin', 'dir'],
				['/tools/phpmyadmin/libraries', 'dir'],
				['/tools/phpmyadmin/libraries/classes', 'dir'],
				['/tools/phpmyadmin/libraries/classes/Config.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			await handler.request({
				url: '/phpmyadmin/libraries/classes/Config.php',
			});

			expect(mockPHP.isFile).toHaveBeenCalledWith(
				'/tools/phpmyadmin/libraries/classes/Config.php'
			);
		});

		it('should fall back to document root for non-aliased paths', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/index.php', 'file'],
				['/tools/phpmyadmin', 'dir'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			await handler.request({
				url: '/index.php',
			});

			// Should check in document root, not in aliased path
			expect(mockPHP.isFile).toHaveBeenCalledWith('/www/index.php');
		});

		it('should support multiple path aliases', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/tools/phpmyadmin', 'dir'],
				['/tools/phpmyadmin/index.php', 'file'],
				['/tools/adminer', 'dir'],
				['/tools/adminer/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
					{ urlPrefix: '/adminer', fsPath: '/tools/adminer' },
				],
			});

			await handler.request({ url: '/phpmyadmin/index.php' });
			expect(mockPHP.isFile).toHaveBeenCalledWith(
				'/tools/phpmyadmin/index.php'
			);

			vi.clearAllMocks();

			await handler.request({ url: '/adminer/index.php' });
			expect(mockPHP.isFile).toHaveBeenCalledWith(
				'/tools/adminer/index.php'
			);
		});

		it('should match alias exactly at the prefix boundary', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/phpmyadmin-extra', 'dir'],
				['/www/phpmyadmin-extra/index.php', 'file'],
				['/tools/phpmyadmin', 'dir'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			await handler.request({ url: '/phpmyadmin-extra/index.php' });

			// Should NOT match the alias because 'phpmyadmin-extra' != 'phpmyadmin'
			// Should resolve to document root instead
			expect(mockPHP.isFile).toHaveBeenCalledWith(
				'/www/phpmyadmin-extra/index.php'
			);
			expect(mockPHP.isFile).not.toHaveBeenCalledWith(
				'/tools/phpmyadmin-extra/index.php'
			);
		});

		it('should serve static files from aliased paths', async () => {
			const cssContent = 'body { color: red; }';
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/tools/phpmyadmin', 'dir'],
				['/tools/phpmyadmin/styles.css', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);
			(
				mockPHP.readFileAsBuffer as ReturnType<typeof vi.fn>
			).mockImplementation((path: string) => {
				if (path === '/tools/phpmyadmin/styles.css') {
					return new Uint8Array(Buffer.from(cssContent));
				}
				throw new Error(`File not found: ${path}`);
			});

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
				pathAliases: [
					{ urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' },
				],
			});

			const response = await handler.request({
				url: '/phpmyadmin/styles.css',
			});

			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toBe(cssContent);
			expect(response.headers['content-type']).toEqual(['text/css']);
		});
	});

	describe('requestStreamed', () => {
		it('returns a StreamedPHPResponse for PHP files', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/index.php',
			});

			expect(response).toBeInstanceOf(StreamedPHPResponse);
		});

		it('returns a StreamedPHPResponse for static files', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/style.css', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/style.css',
			});

			expect(response).toBeInstanceOf(StreamedPHPResponse);
		});

		it('returns a StreamedPHPResponse for 404s', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/nonexistent.txt',
			});

			expect(response).toBeInstanceOf(StreamedPHPResponse);
			expect(await response.httpStatusCode).toBe(404);
		});

		it('returns a StreamedPHPResponse for directory redirects (301)', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/subdir', 'dir'],
				['/www/subdir/', 'dir'],
				['/www/subdir/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/subdir',
			});

			expect(response).toBeInstanceOf(StreamedPHPResponse);
			expect(await response.httpStatusCode).toBe(301);
		});

		it('static file content is accessible via stdoutBytes', async () => {
			const cssContent = 'body { margin: 0; }';
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/app.css', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);
			(
				mockPHP.readFileAsBuffer as ReturnType<typeof vi.fn>
			).mockImplementation((path: string) => {
				if (path === '/www/app.css') {
					return new Uint8Array(Buffer.from(cssContent));
				}
				throw new Error(`File not found: ${path}`);
			});

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/app.css',
			});

			const text = await response.stdoutText;
			expect(text).toBe(cssContent);
		});

		it('returns correct content-type header for CSS files', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/style.css', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/style.css',
			});

			const headers = await response.headers;
			expect(headers['content-type']).toEqual(['text/css']);
		});

		it('returns correct content-type header for JS files', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/app.js', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/app.js',
			});

			const headers = await response.headers;
			expect(headers['content-type']).toEqual(['application/javascript']);
		});

		it('returns correct content-type header for image files', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/logo.png', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.requestStreamed({
				url: '/logo.png',
			});

			const headers = await response.headers;
			expect(headers['content-type']).toEqual(['image/png']);
		});
	});

	describe('request() integration', () => {
		it('returns a buffered PHPResponse', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.request({
				url: '/index.php',
			});

			expect(response).toBeInstanceOf(PHPResponse);
		});

		it('result has all expected fields populated', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.request({
				url: '/index.php',
			});

			expect(response.httpStatusCode).toBeDefined();
			expect(response.headers).toBeDefined();
			expect(response.bytes).toBeInstanceOf(Uint8Array);
			expect(typeof response.exitCode).toBe('number');
		});

		it('rewrites HTTP status to 500 when exit code is non-zero', async () => {
			const filesystem = new Map<string, 'file' | 'dir'>([
				['/www', 'dir'],
				['/www/index.php', 'file'],
			]);
			const mockPHP = createMockPHP(filesystem);
			// Override runStream to return a 200 response with non-zero exit code
			mockPHP.runStream = vi.fn(() =>
				Promise.resolve(
					StreamedPHPResponse.fromPHPResponse(
						new PHPResponse(
							200,
							{ 'Content-Type': ['text/html'] },
							new Uint8Array(Buffer.from('partial output')),
							'Fatal error',
							1
						)
					)
				)
			) as any;

			const handler = new PHPRequestHandler({
				php: mockPHP,
				documentRoot: '/www',
				absoluteUrl: 'http://localhost/',
			});

			const response = await handler.request({
				url: '/index.php',
			});

			expect(response.httpStatusCode).toBe(500);
			expect(response.exitCode).toBe(1);
		});
	});
});
