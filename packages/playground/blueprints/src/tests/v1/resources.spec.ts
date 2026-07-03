import {
	UrlResource,
	GitDirectoryResource,
	BundledResource,
	isGithubProxyUrl,
	rewriteGithubProxyUrl,
	ZipResource,
	Resource,
} from '../../lib/v1/resources';
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import { StreamedFile } from '@php-wasm/stream-compression';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync, type ExecSyncOptions } from 'child_process';

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

	it('should translate github.com raw URLs into raw.githubusercontent.com URLs', () => {
		const resource = new UrlResource({
			resource: 'url',
			url: 'https://github.com/adamziel/blueprints/raw/f49382e89099806a8eede4feba41a9a7ab89bcfe/blueprints%2Fbeta-rc%2Fblueprint.json',
			caption: 'Example',
		});
		expect(resource.getURL()).toBe(
			'https://raw.githubusercontent.com/adamziel/blueprints/f49382e89099806a8eede4feba41a9a7ab89bcfe/blueprints%2Fbeta-rc%2Fblueprint.json'
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

		it('includes a .git directory when requested', async () => {
			const commit = '05138293dd39e25a9fa8e43a9cc775d6fb780e37';
			const resource = new GitDirectoryResource({
				resource: 'git:directory',
				url: 'https://github.com/WordPress/wordpress-playground',
				ref: commit,
				refType: 'commit',
				path: 'packages/docs/site/docs/blueprints/tutorial',
				'.git': true,
			});

			const { files } = await resource.resolve();

			// Create a temporary directory and write all files to disk
			const tmpDir = await mkdtemp(join(tmpdir(), 'git-test-'));
			try {
				// Write all files to the temporary directory
				for (const [path, content] of Object.entries(files)) {
					const fullPath = join(tmpDir, path);
					const dir = join(fullPath, '..');
					await mkdir(dir, { recursive: true });

					if (typeof content === 'string') {
						await writeFile(fullPath, content, 'utf8');
					} else {
						await writeFile(fullPath, content);
					}
				}

				// Run git commands to verify the repository state
				const gitEnv: ExecSyncOptions = {
					cwd: tmpDir,
					encoding: 'utf8',
					maxBuffer: 10 * 1024 * 1024, // 10MB buffer to handle large output
					stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr to avoid buffer overflow
				};

				// Verify we're on the expected commit
				const currentCommit = execSync('git rev-parse HEAD', gitEnv)
					.toString()
					.trim();
				expect(currentCommit).toBe(commit);

				// Verify the remote is configured correctly
				const remoteUrl = execSync('git remote get-url origin', gitEnv)
					.toString()
					.trim();
				expect(remoteUrl).toBe(
					'https://github.com/WordPress/wordpress-playground'
				);

				// Verify this is a shallow clone
				const isShallow = execSync(
					'git rev-parse --is-shallow-repository',
					gitEnv
				)
					.toString()
					.trim();
				expect(isShallow).toBe('true');

				// Verify the shallow file contains the expected commit
				const shallowCommit = execSync('cat .git/shallow', gitEnv)
					.toString()
					.trim();
				expect(shallowCommit).toBe(commit);

				// Verify the expected files exist in the git index
				const lsFiles = execSync('git ls-files', gitEnv)
					.toString()
					.trim()
					.split('\n')
					.filter((f) => f.length > 0)
					.sort();
				expect(lsFiles).toEqual([
					'01-what-are-blueprints-what-you-can-do-with-them.md',
					'02-how-to-load-run-blueprints.md',
					'03-build-your-first-blueprint.md',
					'index.md',
				]);

				// Verify we can run git log to see commit history
				const logOutput = execSync('git log --oneline -n 1', gitEnv)
					.toString()
					.trim();
				expect(logOutput).toContain(commit.substring(0, 7));

				// Update the git index to match the actual files on disk
				execSync('git add -A', gitEnv);

				// Modify a file and verify git status detects the change
				const fileToModify = join(tmpDir, 'index.md');
				await writeFile(fileToModify, 'modified content\n', 'utf8');
				const statusAfterModification = execSync(
					'git status --porcelain',
					gitEnv
				)
					.toString()
					.trim();
				// Git status should show the file as modified (can be ' M' or 'M ')
				expect(statusAfterModification).toMatch(/M.*index\.md/);
			} finally {
				// Clean up the temporary directory
				await rm(tmpDir, { recursive: true, force: true });
			}
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

	describe('CORS handling', () => {
		let originalFetch: typeof global.fetch;

		beforeEach(() => {
			originalFetch = global.fetch;
		});

		afterEach(() => {
			global.fetch = originalFetch;
		});

		it('should unwrap CORS URL in GitAuthenticationError', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
			});

			const githubUrl = 'https://github.com/user/private-repo';
			const resource = new GitDirectoryResource(
				{
					resource: 'git:directory',
					url: githubUrl,
					ref: 'main',
				},
				undefined,
				{
					corsProxy: 'https://cors-proxy.com/',
				}
			);

			await expect(resource.resolve()).rejects.toMatchObject({
				name: 'GitAuthenticationError',
				repoUrl: githubUrl,
				status: 401,
			});
		});

		it('should preserve GitHub URL in GitAuthenticationError without CORS proxy', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
			});

			const githubUrl = 'https://github.com/user/private-repo';
			const resource = new GitDirectoryResource({
				resource: 'git:directory',
				url: githubUrl,
				ref: 'main',
			});

			await expect(resource.resolve()).rejects.toMatchObject({
				name: 'GitAuthenticationError',
				repoUrl: githubUrl,
				status: 401,
			});
		});

		it('should call gitAdditionalHeadersCallback without CORS proxy', async () => {
			const githubUrl = 'https://github.com/user/private-repo';
			const headerCallback = vi.fn().mockReturnValue({
				Authorization: 'Bearer test-token',
			});

			const resource = new GitDirectoryResource(
				{
					resource: 'git:directory',
					url: githubUrl,
					ref: 'main',
				},
				undefined,
				{
					additionalHeaders: headerCallback,
				}
			);

			// Call resolve - it will fail but that's okay, we just want to verify the callback
			try {
				await resource.resolve();
			} catch {
				// Expected to fail - we're not mocking the entire git resolution
			}

			// Verify the callback was called with the GitHub URL (not CORS-wrapped)
			expect(headerCallback).toHaveBeenCalledWith(githubUrl);
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

describe('isGithubProxyUrl', () => {
	it('should return true for github-proxy.com URLs', () => {
		expect(
			isGithubProxyUrl('https://github-proxy.com/proxy/?repo=owner/name')
		).toBe(true);
		expect(
			isGithubProxyUrl(
				'https://github-proxy.com/https://github.com/owner/repo'
			)
		).toBe(true);
	});

	it('should return false for non-github-proxy.com URLs', () => {
		expect(isGithubProxyUrl('https://example.com/file.zip')).toBe(false);
		expect(isGithubProxyUrl('https://github.com/owner/repo')).toBe(false);
	});

	it('should return false for invalid URLs', () => {
		expect(isGithubProxyUrl('not a url')).toBe(false);
	});
});

describe('rewriteGithubProxyUrl', () => {
	it('should return null for non-github-proxy.com URLs', () => {
		expect(
			rewriteGithubProxyUrl('https://example.com/file.zip')
		).toBeNull();
		expect(
			rewriteGithubProxyUrl('https://github.com/owner/repo')
		).toBeNull();
	});

	it('should return null for invalid URLs', () => {
		expect(rewriteGithubProxyUrl('not a url')).toBeNull();
	});

	it('should return null for github-proxy.com URLs without repo parameter', () => {
		expect(
			rewriteGithubProxyUrl(
				'https://github-proxy.com/proxy/?branch=trunk'
			)
		).toBeNull();
	});

	it('should rewrite basic repo URL (default branch)', () => {
		const result = rewriteGithubProxyUrl(
			'https://github-proxy.com/proxy/?repo=owner/name'
		);
		expect(result).toEqual({
			resource: 'zip',
			inner: {
				resource: 'git:directory',
				url: 'https://github.com/owner/name',
				ref: 'HEAD',
			},
		});
	});

	it('should rewrite repo URL with branch', () => {
		const result = rewriteGithubProxyUrl(
			'https://github-proxy.com/proxy/?repo=owner/name&branch=trunk'
		);
		expect(result).toEqual({
			resource: 'zip',
			inner: {
				resource: 'git:directory',
				url: 'https://github.com/owner/name',
				ref: 'trunk',
			},
		});
	});
});

describe('ZipResource', () => {
	it('should wrap a literal directory resource in a ZIP', async () => {
		const innerResource = Resource.create(
			{
				resource: 'literal:directory',
				name: 'my-plugin',
				files: {
					'readme.txt': 'Hello World',
					'plugin.php': '<?php // Plugin',
				},
			},
			{}
		);

		const zipResource = new ZipResource(
			{
				resource: 'zip',
				inner: {
					resource: 'literal:directory',
					name: 'my-plugin',
					files: {},
				},
			},
			innerResource
		);

		const zipFile = await zipResource.resolve();

		expect(zipFile).toBeInstanceOf(File);
		expect(zipFile.name).toBe('my-plugin.zip');
		expect(zipFile.size).toBeGreaterThan(0);
	});

	it('should use custom name if provided', async () => {
		const innerResource = Resource.create(
			{
				resource: 'literal:directory',
				name: 'my-plugin',
				files: { 'test.txt': 'test' },
			},
			{}
		);

		const zipResource = new ZipResource(
			{
				resource: 'zip',
				inner: {
					resource: 'literal:directory',
					name: 'my-plugin',
					files: {},
				},
				name: 'custom.zip',
			},
			innerResource
		);

		const zipFile = await zipResource.resolve();
		expect(zipFile.name).toBe('custom.zip');
	});

	it('should not double .zip extension', async () => {
		const innerResource = Resource.create(
			{
				resource: 'literal:directory',
				name: 'already.zip',
				files: { 'test.txt': 'test' },
			},
			{}
		);

		const zipResource = new ZipResource(
			{
				resource: 'zip',
				inner: {
					resource: 'literal:directory',
					name: 'already.zip',
					files: {},
				},
			},
			innerResource
		);

		const zipFile = await zipResource.resolve();
		expect(zipFile.name).toBe('already.zip');
	});
});

describe('Resource.create with github-proxy.com URLs', () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleWarnSpy.mockRestore();
	});

	it('should rewrite github-proxy.com URL to zip resource and emit warning', () => {
		const resource = Resource.create(
			{
				resource: 'url',
				url: 'https://github-proxy.com/proxy/?repo=owner/name&branch=trunk',
			},
			{}
		);

		// Check that a warning was emitted
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining('github-proxy.com is deprecated')
		);

		// The resource should be a ZipResource (wrapped in decorators)
		expect(resource).toBeDefined();
	});

	it('should not emit warning for non-github-proxy.com URLs', () => {
		Resource.create(
			{
				resource: 'url',
				url: 'https://example.com/file.zip',
			},
			{}
		);

		expect(consoleWarnSpy).not.toHaveBeenCalled();
	});
});
