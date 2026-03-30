import type { V2StepHandler } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { joinPaths, phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface UnzipArgs {
	source: DataSources.DataReference;
	target: string;
}

/**
 * Resolves a data reference to a zip file, writes it to a
 * temporary location, then extracts it to the target path
 * using PHP ZipArchive.
 */
const handler: V2StepHandler<UnzipArgs> = async (args, context) => {
	const { php, dataReferenceResolver } = context;
	const docroot = await php.documentRoot;
	const target = resolveSitePath(args.target, docroot);

	const file = await dataReferenceResolver.resolveFile(args.source);
	const tempZipPath = '/tmp/unzip-step.zip';
	await php.writeFile(tempZipPath, file.contents);

	await php.run({
		code: `<?php
$zip = new ZipArchive();
$res = $zip->open(${phpVar(tempZipPath)});
if ($res !== true) {
	throw new Exception('Failed to open zip: error code ' . $res);
}
@mkdir(${phpVar(target)}, 0777, true);
$zip->extractTo(${phpVar(target)});
$zip->close();
unlink(${phpVar(tempZipPath)});
`,
	});
};

/**
 * Resolves a "site:" prefixed path to an absolute path
 * relative to the WordPress document root.
 */
function resolveSitePath(path: string, documentRoot: string): string {
	if (path.startsWith('site:')) {
		return joinPaths(documentRoot, path.slice(5));
	}
	return path;
}

registerV2StepHandler('unzip', handler);
