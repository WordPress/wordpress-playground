import { joinPaths } from '@php-wasm/util';
import { exposeAPI } from '@php-wasm/web';
import {
	OPFS_SITE_METADATA_FILENAME,
	OPFS_SITES_ROOT_PATH,
	OpfsFilesystemBackend,
	getCandidateDirectoryNamesForSlug,
} from '@wp-playground/storage';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';
import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';

export interface ZipOpfsSiteOptions {
	exclude?: string[];
}

export interface OpfsBridgeClient {
	zipSite(slug: string, options?: ZipOpfsSiteOptions): Promise<Uint8Array>;
}

export async function bootOpfsBridge() {
	const [setAPIReady, , bridge] = exposeAPI<OpfsBridgeClient, undefined>({
		zipSite,
	});
	setAPIReady();
	return bridge;
}

export async function zipSite(slug: string, options: ZipOpfsSiteOptions = {}) {
	const filesystem = await getOpfsSiteFilesystem(slug);
	return await zipFilesystem(filesystem, options);
}

async function getOpfsSiteFilesystem(slug: string) {
	for (const directoryName of getCandidateDirectoryNamesForSlug(slug)) {
		const sitePath = joinPaths(OPFS_SITES_ROOT_PATH, directoryName);
		try {
			const filesystem = await OpfsFilesystemBackend.fromPath(sitePath);
			if (
				await filesystem.fileExists(`/${OPFS_SITE_METADATA_FILENAME}`)
			) {
				return filesystem;
			}
		} catch (error) {
			if (!isMissingOpfsEntry(error)) {
				throw error;
			}
		}
	}

	throw new DOMException(`Site not found: ${slug}`, 'NotFoundError');
}

async function zipFilesystem(
	filesystem: TraversableFilesystemBackend,
	options: ZipOpfsSiteOptions
) {
	const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
	const shouldExclude = createPathExcluder(options.exclude ?? []);
	try {
		await addDirectoryEntries(
			zipWriter,
			filesystem,
			'/',
			'',
			shouldExclude
		);
		const blob = await zipWriter.close();
		return new Uint8Array(await blob.arrayBuffer());
	} catch (error) {
		await zipWriter.close().catch(() => undefined);
		throw error;
	}
}

async function addDirectoryEntries(
	zipWriter: ZipWriter<Blob>,
	filesystem: TraversableFilesystemBackend,
	dirPath: string,
	relativeDirPath: string,
	shouldExclude: (path: string) => boolean
) {
	const entries = await filesystem.listFiles(dirPath);
	for (const name of entries) {
		const absolutePath = joinPaths(dirPath, name);
		const relativePath = relativeDirPath
			? joinPaths(relativeDirPath, name)
			: name;
		if (shouldExclude(relativePath)) {
			continue;
		}

		if (await filesystem.isDir(absolutePath)) {
			await addDirectoryEntries(
				zipWriter,
				filesystem,
				absolutePath,
				relativePath,
				shouldExclude
			);
		} else {
			const file = await filesystem.read(absolutePath);
			const buffer = new Uint8Array(await file.arrayBuffer());
			await zipWriter.add(relativePath, new Uint8ArrayReader(buffer));
		}
	}
}

function createPathExcluder(patterns: string[]) {
	const matchers = patterns
		.map(normalizeGlobPattern)
		.filter((pattern) => pattern.length > 0)
		.map(globPatternToRegExp);

	return (path: string) => {
		const normalizedPath = path.replace(/^\/+/, '');
		return matchers.some((matcher) => matcher.test(normalizedPath));
	};
}

function normalizeGlobPattern(pattern: string) {
	return pattern.replace(/^\/+/, '').replace(/\/+$/, '');
}

function globPatternToRegExp(pattern: string) {
	let source = '^';
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		const nextChar = pattern[i + 1];
		if (char === '*' && nextChar === '*') {
			source += '.*';
			i++;
		} else if (char === '*') {
			source += '[^/]*';
		} else if (char === '?') {
			source += '[^/]';
		} else {
			source += escapeRegExp(char);
		}
	}
	source += '$';
	return new RegExp(source);
}

function escapeRegExp(char: string) {
	return char.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function isMissingOpfsEntry(error: unknown) {
	const name = (error as DOMException | undefined)?.name;
	return name === 'NotFoundError' || name === 'TypeMismatchError';
}
