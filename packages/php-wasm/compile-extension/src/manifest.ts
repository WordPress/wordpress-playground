import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ExtensionAsyncMode = 'jspi';
export type AsyncMode = typeof ExtensionAsyncMode;

export interface ExtensionArtifact {
	phpVersion: string;
	file: string;
	sha256: string;
}

export interface ExtensionManifest {
	name: string;
	version: string;
	artifacts: ExtensionArtifact[];
}

export interface BuiltArtifact {
	phpVersion: string;
	file: string;
	path: string;
}

export async function sha256File(filePath: string): Promise<string> {
	const hash = createHash('sha256');
	await new Promise<void>((resolve, reject) => {
		const stream = createReadStream(filePath);
		stream.on('data', (chunk) => hash.update(chunk));
		stream.on('error', reject);
		stream.on('end', resolve);
	});
	return hash.digest('hex');
}

export async function createManifest(options: {
	name: string;
	version: string;
	artifacts: BuiltArtifact[];
}): Promise<ExtensionManifest> {
	return {
		name: options.name,
		version: options.version,
		artifacts: await Promise.all(
			options.artifacts.map(async (artifact) => ({
				phpVersion: artifact.phpVersion,
				file: artifact.file,
				sha256: await sha256File(artifact.path),
			}))
		),
	};
}

export async function writeManifest(options: {
	outDir: string;
	manifest: ExtensionManifest;
}): Promise<string> {
	await mkdir(options.outDir, { recursive: true });
	const manifestPath = path.join(options.outDir, 'manifest.json');
	await writeFile(
		manifestPath,
		`${JSON.stringify(options.manifest, null, 2)}\n`
	);
	return manifestPath;
}

export function findExtensionArtifact(
	manifest: ExtensionManifest,
	phpVersion: string
): ExtensionArtifact | undefined {
	return manifest.artifacts.find(
		(artifact) => artifact.phpVersion === phpVersion
	);
}
