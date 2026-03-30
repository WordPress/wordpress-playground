import type { V2StepHandler } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { registerV2StepHandler } from './index';
import { joinPaths } from '@php-wasm/util';

/**
 * Writes files to the virtual filesystem by resolving data
 * references and writing the resulting content to the specified
 * target paths.
 *
 * Each key in the `files` map is a target path using the `site:`
 * prefix (resolved relative to the WordPress document root).
 * Each value is a data reference that is resolved to obtain the
 * file contents.
 */
export const writeFilesHandler: V2StepHandler = async (args, context) => {
	const { files } = args as {
		files: Record<string, DataSources.DataReference>;
	};

	const documentRoot = await context.php.documentRoot;

	for (const [targetPath, dataRef] of Object.entries(files)) {
		const resolved =
			await context.dataReferenceResolver.resolveFile(dataRef);
		const absolutePath = resolveSitePath(targetPath, documentRoot);
		await context.php.writeFile(absolutePath, resolved.contents);
	}
};

/**
 * Resolves a `site:` prefixed path to an absolute path on the
 * virtual filesystem.
 */
function resolveSitePath(path: string, documentRoot: string): string {
	if (path.startsWith('site:')) {
		return joinPaths(documentRoot, path.slice(5));
	}
	return path;
}

registerV2StepHandler('writeFiles', writeFilesHandler);
