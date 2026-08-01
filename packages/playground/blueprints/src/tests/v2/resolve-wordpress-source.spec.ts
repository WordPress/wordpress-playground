import { StreamedFile } from '@php-wasm/stream-compression';
import { ZipFilesystem } from '@wp-playground/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBlueprintV2WordPressSource } from '../../lib/v2/compile';
import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

const gitMocks = vi.hoisted(() => ({
	listGitFiles: vi.fn(),
	resolveCommitHash: vi.fn(),
	sparseCheckout: vi.fn(),
}));

vi.mock('@wp-playground/storage', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		listGitFiles: gitMocks.listGitFiles,
		resolveCommitHash: gitMocks.resolveCommitHash,
		sparseCheckout: gitMocks.sparseCheckout,
	};
});

describe('resolveBlueprintV2WordPressSource', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		gitMocks.resolveCommitHash.mockResolvedValue('abc123');
		gitMocks.listGitFiles.mockResolvedValue([
			{
				name: 'src',
				type: 'folder',
				children: [
					{ name: 'index.php', type: 'file' },
					{ name: 'wp-config-sample.php', type: 'file' },
				],
			},
		]);
		gitMocks.sparseCheckout.mockResolvedValue({
			files: {
				'src/index.php': '<?php',
				'src/wp-config-sample.php': '<?php',
			},
		});
	});

	it('loads WordPress archives from the Blueprint execution context', async () => {
		const streamBundledFile = vi.fn(async (path: string) =>
			streamFile('wordpress archive', path)
		);

		const archive = await resolveBlueprintV2WordPressSource(
			{
				version: 2,
				wordpressVersion: './assets/wordpress.zip',
			},
			{ streamBundledFile }
		);

		expect(streamBundledFile).toHaveBeenCalledWith('assets/wordpress.zip');
		await expect(archive?.text()).resolves.toBe('wordpress archive');
	});

	it('loads inline WordPress archives', async () => {
		const archive = await resolveBlueprintV2WordPressSource({
			version: 2,
			wordpressVersion: {
				filename: 'wordpress.zip',
				content: 'inline archive',
			},
		});

		expect(archive?.name).toBe('wordpress.zip');
		await expect(archive?.text()).resolves.toBe('inline archive');
	});

	it('packages inline WordPress directories as archives', async () => {
		const archive = await resolveBlueprintV2WordPressSource({
			version: 2,
			wordpressVersion: {
				directoryName: 'wordpress',
				files: {
					'index.php': '<?php',
					'wp-includes': {
						files: {
							'version.php': '<?php $wp_version = "7.0";',
						},
					},
				},
			},
		});

		const zip = await openZip(archive);
		expect(await zip.getAllFilePaths()).toEqual(
			expect.arrayContaining([
				'wordpress/index.php',
				'wordpress/wp-includes/version.php',
			])
		);
		await expect(
			(await zip.read('wordpress/wp-includes/version.php')).text()
		).resolves.toContain('$wp_version = "7.0"');
	});

	it('checks out and packages Git WordPress directories', async () => {
		const archive = await resolveBlueprintV2WordPressSource({
			version: 2,
			wordpressVersion: {
				gitRepository: 'https://example.com/wordpress.git',
				ref: 'trunk',
				pathInRepository: 'src',
			},
		});

		expect(gitMocks.resolveCommitHash).toHaveBeenCalledWith(
			'https://example.com/wordpress.git',
			{ value: 'trunk', type: 'infer' },
			{}
		);
		expect(gitMocks.sparseCheckout).toHaveBeenCalledWith(
			'https://example.com/wordpress.git',
			'abc123',
			['src/index.php', 'src/wp-config-sample.php'],
			{ withObjects: undefined, additionalHeaders: {} }
		);
		const zip = await openZip(archive);
		expect(
			(await zip.getAllFilePaths()).some((path) =>
				path.endsWith('/wp-config-sample.php')
			)
		).toBe(true);
	});

	it.each([
		undefined,
		'latest',
		'https://example.com/wordpress.zip',
		{ min: '6.8' },
	] as const)(
		'leaves existing WordPress source %j to the normal download path',
		async (wordpressVersion) => {
			await expect(
				resolveBlueprintV2WordPressSource({
					version: 2,
					wordpressVersion,
				} as BlueprintV2Declaration)
			).resolves.toBeUndefined();
		}
	);
});

function streamFile(contents: string, name: string) {
	const blob = new Blob([contents]);
	return new StreamedFile(blob.stream(), name, { filesize: blob.size });
}

async function openZip(file: File | undefined) {
	if (!file) {
		throw new Error('Expected a WordPress archive');
	}
	return ZipFilesystem.fromArrayBuffer(await file.arrayBuffer());
}
