import fs from 'fs';
import path from 'path';
import {
	ZipFilesystem,
	NodeJsFilesystem,
	OverlayFilesystem,
	InMemoryFilesystem,
} from '@wp-playground/storage';
import { resolveRemoteBlueprint } from '@wp-playground/blueprints';
import { ReportableError } from './reportable-error';

type ResolveBlueprintOptions = {
	sourceString: string | undefined;
	blueprintMayReadAdjacentFiles: boolean;
};

/**
 * Resolves a blueprint from a URL or a local path.
 *
 * @TODO: Extract the common Blueprint resolution logic between CLI and
 *        the website into a single, isomorphic resolveBlueprint() function.
 *        Still retain the CLI-specific bits in the CLI package.
 *
 * @param sourceString - The source string to resolve the blueprint from.
 * @param blueprintMayReadAdjacentFiles - Whether the blueprint may read adjacent files.
 * @returns The resolved blueprint.
 */
export async function resolveBlueprint({
	sourceString,
	blueprintMayReadAdjacentFiles,
}: ResolveBlueprintOptions) {
	if (!sourceString) {
		return undefined;
	}

	if (
		sourceString.startsWith('http://') ||
		sourceString.startsWith('https://')
	) {
		return await resolveRemoteBlueprint(sourceString);
	}

	// If the sourceString does not refer to a remote blueprint, try to
	// resolve it from a local filesystem.

	let blueprintPath = path.resolve(process.cwd(), sourceString);
	if (!fs.existsSync(blueprintPath)) {
		throw new Error(`Blueprint file does not exist: ${blueprintPath}`);
	}

	const stat = fs.statSync(blueprintPath);
	if (stat.isDirectory()) {
		blueprintPath = path.join(blueprintPath, 'blueprint.json');
	}

	if (!stat.isFile() && stat.isSymbolicLink()) {
		throw new Error(
			`Blueprint path is neither a file nor a directory: ${blueprintPath}`
		);
	}

	const extension = path.extname(blueprintPath);
	switch (extension) {
		case '.zip':
			return ZipFilesystem.fromArrayBuffer(
				fs.readFileSync(blueprintPath).buffer as ArrayBuffer
			);
		case '.json': {
			const blueprintText = fs.readFileSync(blueprintPath, 'utf-8');
			try {
				JSON.parse(blueprintText);
			} catch {
				throw new Error(
					`Blueprint file at ${blueprintPath} is not a valid JSON file`
				);
			}

			const contextPath = path.dirname(blueprintPath);
			const nodeJsFilesystem = new NodeJsFilesystem(contextPath);
			return new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': blueprintText,
				}),
				/**
				 * Wrap the NodeJS filesystem to prevent access to local files
				 * unless the user explicitly allowed it.
				 */
				{
					read(path) {
						if (!blueprintMayReadAdjacentFiles) {
							throw new ReportableError(
								`Error: Blueprint contained tried to read a local file at path "${path}" (via a resource of type "bundled"). ` +
									`Playground restricts access to local resources by default as a security measure. \n\n` +
									`You can allow this Blueprint to read files from the same parent directory by explicitly adding the ` +
									`--blueprint-may-read-adjacent-files option to your command.`
							);
						}
						return nodeJsFilesystem.read(path);
					},
				},
			]);
		}
		default:
			throw new Error(
				`Unsupported blueprint file extension: ${extension}. Only .zip and .json files are supported.`
			);
	}
}
