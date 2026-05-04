import { mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
	assertDockerIsAvailable,
	buildBaseImage,
	buildExtensionImage,
	createDockerContext,
	runExtensionBuild,
} from './docker';
import type {
	AsyncMode,
	BuiltArtifact,
	ExtensionManifestExtraFiles,
} from './manifest';
import { createManifest, ExtensionAsyncMode, writeManifest } from './manifest';

export const SupportedExtensionPHPVersions = [
	'8.5',
	'8.4',
	'8.3',
	'8.2',
	'8.1',
	'8.0',
	'7.4',
] as const;

const PHP_RELEASE_BY_MINOR: Record<string, string> = {
	'8.5': '8.5.5',
	'8.4': '8.4.20',
	'8.3': '8.3.30',
	'8.2': '8.2.30',
	'8.1': '8.1.34',
	'8.0': '8.0.30',
	'7.4': '7.4.33',
};

export interface CompileExtensionOptions {
	workspaceRoot: string;
	sourceDir: string;
	outDir: string;
	name: string;
	phpVersions: string[];
	extraCflags?: string;
	extraLdflags?: string;
	configArgs: string[];
	optimize: string;
	jobs?: number;
	/** Sidecar files to record at the manifest level. */
	extraFiles?: ExtensionManifestExtraFiles;
}

export interface PrepareExtensionBuildImagesOptions {
	workspaceRoot: string;
	phpVersions: string[];
	jobs?: number;
}

export async function prepareExtensionBuildImages(
	options: PrepareExtensionBuildImagesOptions
) {
	await assertDockerIsAvailable();

	const context = await createDockerContext(options.workspaceRoot);
	const matrix: Array<{ phpVersion: string; asyncMode: AsyncMode }> =
		options.phpVersions.map((phpVersion) => ({
			phpVersion,
			asyncMode: ExtensionAsyncMode,
		}));

	await buildBaseImage(context);

	const images = await mapLimit(
		matrix,
		normalizeJobCount(options.jobs, matrix.length),
		async ({ phpVersion, asyncMode }) => {
			const imageTag = await buildExtensionImage({
				...context,
				phpVersion,
				phpRelease: resolvePHPRelease(phpVersion),
				asyncMode,
			});
			return { phpVersion, asyncMode, imageTag };
		}
	);

	return { images };
}

export async function compileExtensionMatrix(options: CompileExtensionOptions) {
	const outDir = path.resolve(options.workspaceRoot, options.outDir);
	const sourceDir = path.resolve(options.workspaceRoot, options.sourceDir);
	await assertDockerIsAvailable();

	const context = await createDockerContext(options.workspaceRoot);
	const version = await detectManifestVersion(sourceDir);
	const matrix: Array<{ phpVersion: string; asyncMode: AsyncMode }> =
		options.phpVersions.map((phpVersion) => ({
			phpVersion,
			asyncMode: ExtensionAsyncMode,
	}));

	await mkdir(outDir, { recursive: true });
	await buildBaseImage(context);

	const artifacts = await mapLimit(
		matrix,
		normalizeJobCount(options.jobs, matrix.length),
		async ({ phpVersion, asyncMode }) => {
			const phpRelease = resolvePHPRelease(phpVersion);
			const artifactFile = `${options.name}-php${phpVersion}-${asyncMode}.so`;
			await buildExtensionImage({
				...context,
				phpVersion,
				phpRelease,
				asyncMode,
			});
			await runExtensionBuild({
				...context,
				sourceDir,
				outDir,
				name: options.name,
				phpVersion,
				phpRelease,
				asyncMode,
				artifactFile,
				optimize: options.optimize,
				extraCflags: options.extraCflags,
				extraLdflags: options.extraLdflags,
				configArgs: options.configArgs,
			});
			return {
				phpVersion,
				sourcePath: artifactFile,
				path: path.join(outDir, artifactFile),
			} satisfies BuiltArtifact;
		}
	);

	const manifest = await createManifest({
		name: options.name,
		version,
		artifacts,
		extraFiles: options.extraFiles,
	});
	const manifestPath = await writeManifest({ outDir, manifest });
	return { manifestPath, artifacts, manifest };
}

export function resolvePHPRelease(phpVersion: string): string {
	return PHP_RELEASE_BY_MINOR[phpVersion] ?? phpVersion;
}

async function detectManifestVersion(sourceDir: string): Promise<string> {
	try {
		const packageJson = JSON.parse(
			await readFile(path.join(sourceDir, 'package.json'), 'utf8')
		) as { version?: unknown };
		if (typeof packageJson.version === 'string') {
			return packageJson.version;
		}
	} catch {
		// Native PHP extension sources usually do not contain package.json.
	}
	return '0.0.0';
}

async function mapLimit<T, R>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length) as R[];
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const index = nextIndex++;
				results[index] = await worker(items[index]);
			}
		}
	);
	await Promise.all(workers);
	return results;
}

function normalizeJobCount(
	jobs: number | undefined,
	taskCount: number
): number {
	if (taskCount === 0) {
		return 1;
	}
	if (jobs && jobs > 0) {
		return Math.min(jobs, taskCount);
	}
	return Math.min(os.availableParallelism?.() ?? os.cpus().length, taskCount);
}
