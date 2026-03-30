import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataReferenceResolverImpl } from './resolver';
import {
	isInlineFile,
	isInlineDirectory,
	isUrlReference,
	isExecutionContextPath,
	isGitPath,
	parseSlugWithVersion,
	normalizePath,
} from './resolver';
import { DataReferenceResolutionError } from '../types';

describe('DataReferenceResolverImpl', () => {
	let resolver: DataReferenceResolverImpl;

	beforeEach(() => {
		resolver = new DataReferenceResolverImpl();
		vi.restoreAllMocks();
	});

	describe('resolveFile', () => {
		it('resolves an inline file reference', async () => {
			const ref = {
				filename: 'hello.php',
				content: '<?php echo "hi"; ?>',
			};
			const result = await resolver.resolveFile(ref);
			expect(result.name).toBe('hello.php');
			expect(new TextDecoder().decode(result.contents)).toBe(
				'<?php echo "hi"; ?>'
			);
		});

		it('resolves a URL reference', async () => {
			const body = new Uint8Array([1, 2, 3, 4]);
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(body, { status: 200 })
			);

			const result = await resolver.resolveFile(
				'https://example.com/archive.zip'
			);
			expect(result.name).toBe('archive.zip');
			expect(result.contents).toEqual(body);
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://example.com/archive.zip'
			);
		});

		it('uses corsProxy when configured', async () => {
			resolver = new DataReferenceResolverImpl({
				corsProxy: 'https://proxy.example.com/',
			});
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(new Uint8Array([5]), { status: 200 })
			);

			await resolver.resolveFile('https://example.com/file.zip');
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://proxy.example.com/' + 'https://example.com/file.zip'
			);
		});

		it('throws DataReferenceResolutionError on fetch failure', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(null, {
					status: 404,
					statusText: 'Not Found',
				})
			);
			await expect(
				resolver.resolveFile('https://example.com/missing.zip')
			).rejects.toThrow(DataReferenceResolutionError);
		});

		it('resolves an execution context path', async () => {
			const fileContents = new Uint8Array([10, 20, 30]);
			resolver = new DataReferenceResolverImpl({
				executionContext: {
					readFileAsBuffer: vi.fn().mockResolvedValue(fileContents),
					listFiles: vi.fn(),
				},
			});
			const result = await resolver.resolveFile('./my-plugin.zip');
			expect(result.name).toBe('my-plugin.zip');
			expect(result.contents).toEqual(fileContents);
		});

		it('throws when execution context is missing for path ref', async () => {
			await expect(
				resolver.resolveFile('./some-file.txt')
			).rejects.toThrow(DataReferenceResolutionError);
		});

		it('throws for git path references (not yet supported)', async () => {
			const ref = {
				gitRepository: 'https://github.com/example/repo' as const,
			};
			await expect(resolver.resolveFile(ref)).rejects.toThrow(
				DataReferenceResolutionError
			);
		});
	});

	describe('resolveDirectory', () => {
		it('resolves an inline directory reference', async () => {
			const ref = {
				directoryName: 'my-plugin',
				files: {
					'index.php': '<?php // entry',
					lib: {
						directoryName: 'lib',
						files: {
							'util.php': '<?php // util',
						},
					},
				},
			};
			const result = await resolver.resolveDirectory(ref);
			expect(result.name).toBe('my-plugin');
			expect(Object.keys(result.files)).toContain('index.php');
			expect(result.files['index.php']).toBeInstanceOf(Uint8Array);
			expect(
				new TextDecoder().decode(
					result.files['index.php'] as Uint8Array
				)
			).toBe('<?php // entry');

			const subdir = result.files['lib'] as {
				name: string;
				files: Record<string, unknown>;
			};
			expect(subdir.name).toBe('lib');
			expect(
				new TextDecoder().decode(subdir.files['util.php'] as Uint8Array)
			).toBe('<?php // util');
		});
	});

	describe('resolvePluginReference', () => {
		it('resolves a simple plugin slug', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(new Uint8Array([1]), { status: 200 })
			);
			const result = await resolver.resolvePluginReference('jetpack');
			expect(result.name).toBe('jetpack.zip');
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://downloads.wordpress.org/plugin/jetpack.zip'
			);
		});

		it('resolves a versioned plugin slug', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(new Uint8Array([2]), { status: 200 })
			);
			const result =
				await resolver.resolvePluginReference('jetpack@6.4.3');
			expect(result.name).toBe('jetpack.6.4.3.zip');
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://downloads.wordpress.org/plugin/' + 'jetpack.6.4.3.zip'
			);
		});
	});

	describe('resolveThemeReference', () => {
		it('resolves a simple theme slug', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(new Uint8Array([3]), { status: 200 })
			);
			const result =
				await resolver.resolveThemeReference('twentytwentyfour');
			expect(result.name).toBe('twentytwentyfour.zip');
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://downloads.wordpress.org/theme/' +
					'twentytwentyfour.zip'
			);
		});

		it('resolves a versioned theme slug', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(new Uint8Array([4]), { status: 200 })
			);
			const result =
				await resolver.resolveThemeReference('adventurer@4.6.0');
			expect(result.name).toBe('adventurer.4.6.0.zip');
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://downloads.wordpress.org/theme/' +
					'adventurer.4.6.0.zip'
			);
		});
	});
});

describe('type guard helpers', () => {
	it('isInlineFile detects inline files', () => {
		expect(isInlineFile({ filename: 'a.txt', content: 'hello' })).toBe(
			true
		);
		expect(isInlineFile('https://example.com' as any)).toBe(false);
		expect(
			isInlineFile({
				directoryName: 'd',
				files: {},
			} as any)
		).toBe(false);
	});

	it('isInlineDirectory detects inline directories', () => {
		expect(
			isInlineDirectory({
				directoryName: 'dir',
				files: {},
			})
		).toBe(true);
		expect(
			isInlineDirectory({
				filename: 'a.txt',
				content: '',
			} as any)
		).toBe(false);
	});

	it('isUrlReference detects HTTP(S) URLs', () => {
		expect(isUrlReference('https://example.com/f.zip')).toBe(true);
		expect(isUrlReference('http://example.com/f.zip')).toBe(true);
		expect(isUrlReference('./local-file.zip')).toBe(false);
		expect(isUrlReference('/absolute-path')).toBe(false);
	});

	it('isExecutionContextPath detects ./ and / paths', () => {
		expect(isExecutionContextPath('./file.txt')).toBe(true);
		expect(isExecutionContextPath('/file.txt')).toBe(true);
		expect(isExecutionContextPath('https://example.com')).toBe(false);
		expect(isExecutionContextPath('slug-name')).toBe(false);
	});

	it('isGitPath detects git repository references', () => {
		expect(
			isGitPath({
				gitRepository: 'https://github.com/x/y',
			} as any)
		).toBe(true);
		expect(
			isGitPath({
				filename: 'a.txt',
				content: '',
			} as any)
		).toBe(false);
	});
});

describe('parseSlugWithVersion', () => {
	it('parses unversioned slug', () => {
		expect(parseSlugWithVersion('jetpack')).toEqual({
			name: 'jetpack',
			version: undefined,
		});
	});

	it('parses versioned slug', () => {
		expect(parseSlugWithVersion('jetpack@6.4.3')).toEqual({
			name: 'jetpack',
			version: '6.4.3',
		});
	});

	it('parses slug with two-part version', () => {
		expect(parseSlugWithVersion('akismet@5.3')).toEqual({
			name: 'akismet',
			version: '5.3',
		});
	});
});

describe('normalizePath', () => {
	it('strips ./ prefix', () => {
		expect(normalizePath('./my-file.txt')).toBe('my-file.txt');
	});

	it('strips / prefix', () => {
		expect(normalizePath('/my-file.txt')).toBe('my-file.txt');
	});

	it('throws on .. traversal', () => {
		expect(() => normalizePath('./../escape')).toThrow(
			DataReferenceResolutionError
		);
	});

	it('throws on embedded .. traversal', () => {
		expect(() => normalizePath('./dir/../../escape')).toThrow(
			DataReferenceResolutionError
		);
	});
});
