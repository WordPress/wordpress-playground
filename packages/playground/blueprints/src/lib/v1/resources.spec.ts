import {
	UrlResource,
	GitDirectoryResource,
	BundledResource,
} from './resources';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import { StreamedFile } from '@php-wasm/stream-compression';

describe('UrlResource', () => {
	it('should create a new instance of UrlResource', () => {
		const resource = new UrlResource({
			resource: 'url',
			url: 'https://example.com',
			caption: 'Example',
		});
		expect(resource).toBeInstanceOf(UrlResource);
	});

	it('should translate github.com URLs into raw.githubusercontent.com URLs', () => {
		const resource = new UrlResource({
			resource: 'url',
			url: 'https://github.com/WordPress/wordpress-develop/blob/trunk/src/wp-includes/version.php',
			caption: 'Example',
		});
		expect(resource.getURL()).toBe(
			'https://raw.githubusercontent.com/WordPress/wordpress-develop/trunk/src/wp-includes/version.php'
		);
	});
});

describe('GitDirectoryResource', () => {
	describe('resolve', () => {
		it.each([
			'packages/docs/site/docs/blueprints/tutorial',
			'/packages/docs/site/docs/blueprints/tutorial',
		])(
			'should return a list of files in the directory (path: %s)',
			async (path) => {
				const resource = new GitDirectoryResource({
					resource: 'git:directory',
					url: 'https://github.com/WordPress/wordpress-playground',
					ref: '05138293dd39e25a9fa8e43a9cc775d6fb780e37',
					refType: 'commit',
					path,
				});
				const { files } = await resource.resolve();
				expect(Object.keys(files)).toEqual([
					'01-what-are-blueprints-what-you-can-do-with-them.md',
					'02-how-to-load-run-blueprints.md',
					'03-build-your-first-blueprint.md',
					'index.md',
				]);
			}
		);

		it('defaults to the repo root when path is omitted', async () => {
			const url = 'https://github.com/WordPress/wordpress-playground';
			const resource = new GitDirectoryResource({
				resource: 'git:directory',
				url,
				ref: 'trunk',
				// A path with only a few files to avoid timing out.
				path: '.github',
			});
			const { files, name } = await resource.resolve();

			// Human-readable name
			expect(resource.name).toBe(
				'https://github.com/WordPress/wordpress-playground (trunk) at .github'
			);

			// Filename
			expect(name).toBe(
				'https-github.com-WordPress-wordpress-playground-trunk-at-.github'
			);
			expect(files['dependabot.yml']).toBeInstanceOf(Uint8Array);
		});
	});

	describe('name', () => {
		it('should return a non-empty name when path is omitted', async () => {
			const resource = new GitDirectoryResource({
				resource: 'git:directory',
				url: 'https://github.com/WordPress/link-manager',
				ref: 'trunk',
			});
			const { name } = await resource.resolve();
			expect(name).toBe('https-github.com-WordPress-link-manager-trunk');
		});

		it('should return a non-empty name when path is empty', async () => {
			const resource = new GitDirectoryResource({
				resource: 'git:directory',
				url: 'https://github.com/WordPress/link-manager',
				ref: 'trunk',
				path: '',
			});
			const { name } = await resource.resolve();
			expect(name).toBe('https-github.com-WordPress-link-manager-trunk');
		});

		it('should return a non-empty name when path has no letters', async () => {
			const resource = new GitDirectoryResource({
				resource: 'git:directory',
				url: 'https://github.com/WordPress/link-manager',
				ref: 'trunk',
				// A path with only a few files to avoid timing out.
				path: '/',
			});
			const { name } = await resource.resolve();
			expect(name).toBe('https-github.com-WordPress-link-manager-trunk');
		});
	});
});

describe('BlueprintResource', () => {
	let mockStream: ReadableStream;
	let mockStreamFile: BundledResource['streamBundledFile'];

	beforeEach(() => {
		// Create a mock ReadableStream that returns a simple text file
		const encoder = new TextEncoder();
		const fileContent = encoder.encode('Test file content');

		mockStream = new ReadableStream({
			start(controller) {
				controller.enqueue(fileContent);
				controller.close();
			},
		});

		mockStreamFile = vi.fn(
			async () =>
				new StreamedFile(mockStream, 'test.txt', {
					filesize: fileContent.length,
				})
		);
	});

	it('should create a new instance of BlueprintResource', () => {
		const resource = new BundledResource(
			{
				resource: 'bundled',
				path: 'test.txt',
			},
			mockStreamFile
		);

		expect(resource).toBeInstanceOf(BundledResource);
		expect(resource.name).toBe('test.txt');
		expect(resource.isAsync).toBe(true);
	});

	it('should resolve a file from the filesystem', async () => {
		const resource = new BundledResource(
			{
				resource: 'bundled',
				path: 'test.txt',
			},
			mockStreamFile
		);

		const file = await resource.resolve();

		expect(mockStreamFile).toHaveBeenCalledWith('test.txt');
		expect(file).toBeInstanceOf(File);
		expect(file.name).toBe('test.txt');

		// Verify the file content
		const content = await file.text();
		expect(content).toBe('Test file content');
	});

	it('should handle errors when reading from the filesystem', async () => {
		const streamFile = vi.fn(() =>
			Promise.reject(new Error('File not found'))
		);
		const resource = new BundledResource(
			{
				resource: 'bundled',
				path: 'missing.txt',
			},
			streamFile
		);

		await expect(resource.resolve()).rejects.toThrow(
			/This Blueprint refers to a/
		);
		expect(streamFile).toHaveBeenCalledWith('missing.txt');
	});
});
