import fs from 'fs';
import path from 'path';
import type { RunCLIArgs } from '../run-cli';

const MARKDOWN_ROOT_VFS_PATH = '/markdown-root';
const MARKDOWN_EDITOR_MU_PLUGINS_VFS_PATH = '/wordpress/wp-content/mu-plugins';
const MARKDOWN_EDITOR_RELEASE_PHP_VERSION: NonNullable<RunCLIArgs['php']> =
	'8.4';
const EDIT_MARKDOWN_MODULE_DIR =
	typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
const MARKDOWN_EDITOR_RUNTIME_HOST_PATH = resolveMarkdownEditorRuntimePath();
const MARKDOWN_EDITOR_MU_PLUGIN_PATH = resolveMarkdownEditorRuntimeAssetPath(
	'edit-markdown-mu-plugin.php'
);
const SQLITE_MARKDOWN_MANIFEST_PATH = resolveMarkdownEditorRuntimeAssetPath(
	'sqlite-markdown-extension',
	'dist',
	'manifest.json'
);

function resolveMarkdownEditorRuntimePath(): string {
	const candidates = [
		path.resolve(
			EDIT_MARKDOWN_MODULE_DIR,
			'wp-markdown-editor',
			'markdown-editor'
		),
		path.resolve(EDIT_MARKDOWN_MODULE_DIR, 'edit-markdown'),
		path.resolve(
			EDIT_MARKDOWN_MODULE_DIR,
			'src',
			'edit-markdown',
			'wp-markdown-editor',
			'markdown-editor'
		),
	];
	return (
		candidates.find((candidate) => fs.existsSync(candidate)) ??
		candidates[0]
	);
}

function resolveMarkdownEditorRuntimeAssetPath(...segments: string[]): string {
	return path.resolve(MARKDOWN_EDITOR_RUNTIME_HOST_PATH, ...segments);
}

function ensureMarkdownEditorRuntime(): void {
	if (
		fs.existsSync(SQLITE_MARKDOWN_MANIFEST_PATH) &&
		fs.existsSync(MARKDOWN_EDITOR_MU_PLUGIN_PATH)
	) {
		return;
	}
	throw new Error(
		`edit-markdown: Markdown Editor runtime is missing at ${MARKDOWN_EDITOR_RUNTIME_HOST_PATH}. ` +
			'Run `npx nx run playground-cli:download-edit-markdown-runtime` from the repo root.'
	);
}

/**
 * Rewrite `wp-playground edit-markdown <dir>` into a `start` invocation
 * with the bits the markdown editor needs already wired up.
 *
 * Same shape as `expandStartCommandArgs` in run-cli.ts: take the parsed
 * args, change the command, populate the extra mounts / blueprint steps /
 * runtime flags the higher-level command needs, and return — the rest of
 * runCLI() then runs as if the user had invoked `start` themselves.
 *
 * What it sets:
 *   - login=true so the editor opens authenticated.
 *   - phpExtension=[sqlite-markdown manifest] so PHP registers the
 *     markdown_posts / markdown_postmeta virtual tables before WordPress
 *     opens its SQLite database connection.
 *   - mount of the host markdown directory at {@see MARKDOWN_ROOT_VFS_PATH}.
 *   - mount of the released Markdown Editor runtime as wp-content/mu-plugins.
 */
export function expandEditMarkdownCommandArgs(
	args: RunCLIArgs & { reset?: boolean }
): RunCLIArgs {
	const hostDir = (args as any).dir as string;
	if (!hostDir) {
		throw new Error('edit-markdown: missing required <dir> argument.');
	}
	const resolved = path.resolve(process.cwd(), hostDir);
	if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
		throw new Error(
			`edit-markdown: "${hostDir}" is not a readable directory.`
		);
	}

	if (
		args.php !== undefined &&
		args.php !== MARKDOWN_EDITOR_RELEASE_PHP_VERSION
	) {
		throw new Error(
			`edit-markdown currently requires PHP ${MARKDOWN_EDITOR_RELEASE_PHP_VERSION}. ` +
				'The wp-extensions Markdown Editor release only ships that sqlite_markdown build.'
		);
	}

	ensureMarkdownEditorRuntime();

	const mounts = [
		...(args.mount || []),
		{ hostPath: resolved, vfsPath: MARKDOWN_ROOT_VFS_PATH },
		{
			hostPath: MARKDOWN_EDITOR_RUNTIME_HOST_PATH,
			vfsPath: MARKDOWN_EDITOR_MU_PLUGINS_VFS_PATH,
		},
	];

	return {
		...args,
		login: true,
		php: args.php ?? MARKDOWN_EDITOR_RELEASE_PHP_VERSION,
		phpExtension: [
			...(((args as any).phpExtension as string[] | undefined) || []),
			SQLITE_MARKDOWN_MANIFEST_PATH,
		],
		mount: mounts,
	};
}

export {
	MARKDOWN_ROOT_VFS_PATH,
	MARKDOWN_EDITOR_MU_PLUGINS_VFS_PATH,
	MARKDOWN_EDITOR_RELEASE_PHP_VERSION,
	MARKDOWN_EDITOR_RUNTIME_HOST_PATH,
	SQLITE_MARKDOWN_MANIFEST_PATH,
};
