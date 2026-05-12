import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { RunCLIArgs } from '../run-cli';
/* eslint-disable @typescript-eslint/no-unused-vars */
// Vite / esbuild `?raw` suffix inlines the file's contents as a string.
// @ts-expect-error `?raw` import is handled by the bundler.
import muPluginSource from './edit-markdown-mu-plugin.php?raw';

const MU_PLUGIN_VFS_PATH = '/wordpress/wp-content/mu-plugins/edit-markdown.php';
const MARKDOWN_ROOT_VFS_PATH = '/markdown-root';
const PHP_TOOLKIT_VFS_PATH = '/internal/shared/php-toolkit';
const PHP_TOOLKIT_HOST_PATH = resolveEditMarkdownAssetPath(
	'vendor',
	'php-toolkit'
);
const SQLITE_MARKDOWN_MANIFEST_PATH = resolveEditMarkdownAssetPath(
	'sqlite-markdown-extension',
	'manifest.json'
);

function resolveEditMarkdownAssetPath(...segments: string[]): string {
	const candidates = [
		path.resolve(__dirname, ...segments),
		path.resolve(__dirname, 'edit-markdown', ...segments),
		path.resolve(__dirname, 'src', 'edit-markdown', ...segments),
	];
	return (
		candidates.find((candidate) => fs.existsSync(candidate)) ??
		candidates[0]
	);
}

/**
 * The php-toolkit submodule needs its composer dependencies installed the
 * first time this command runs. The classmap is fully local (vendor-patched/
 * directories are checked in), so `composer install --no-dev` is offline and
 * fast. We only do this if `vendor/autoload.php` is missing.
 */
function ensurePhpToolkitAutoload(): void {
	const autoload = path.join(PHP_TOOLKIT_HOST_PATH, 'vendor', 'autoload.php');
	if (fs.existsSync(autoload)) {
		return;
	}
	if (!fs.existsSync(path.join(PHP_TOOLKIT_HOST_PATH, 'composer.json'))) {
		throw new Error(
			`edit-markdown: php-toolkit submodule is missing at ${PHP_TOOLKIT_HOST_PATH}. ` +
				`Run \`git submodule update --init --recursive\` from the repo root.`
		);
	}
	try {
		execSync('composer install --no-dev --prefer-dist --no-interaction', {
			cwd: PHP_TOOLKIT_HOST_PATH,
			stdio: 'inherit',
		});
	} catch (e) {
		throw new Error(
			`edit-markdown: failed to bootstrap php-toolkit via composer. ` +
				`Install composer (https://getcomposer.org) or run it manually in ` +
				`${PHP_TOOLKIT_HOST_PATH}.`
		);
	}
}

function ensureSqliteMarkdownExtensionManifest(): void {
	if (fs.existsSync(SQLITE_MARKDOWN_MANIFEST_PATH)) {
		return;
	}
	throw new Error(
		`edit-markdown: sqlite-markdown extension manifest is missing at ${SQLITE_MARKDOWN_MANIFEST_PATH}. ` +
			'Run `npx nx run php-wasm-compile-sqlite-markdown-extension:build` from the repo root.'
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
 *   - mount of the bundled wp-php-toolkit/markdown vendor tree.
 *   - writeFile step that drops the mu-plugin into wp-content/mu-plugins,
 *     so plugins_loaded can swap wp_posts / wp_postmeta to virtual tables.
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

	ensurePhpToolkitAutoload();
	ensureSqliteMarkdownExtensionManifest();

	const mounts = [
		...(args.mount || []),
		{ hostPath: resolved, vfsPath: MARKDOWN_ROOT_VFS_PATH },
		{ hostPath: PHP_TOOLKIT_HOST_PATH, vfsPath: PHP_TOOLKIT_VFS_PATH },
	];

	const extraSteps = [
		...((args as any)['additional-blueprint-steps'] || []),
		{
			step: 'writeFile',
			path: MU_PLUGIN_VFS_PATH,
			data: muPluginSource,
		},
	];

	return {
		...args,
		login: true,
		phpExtension: [
			...(((args as any).phpExtension as string[] | undefined) || []),
			SQLITE_MARKDOWN_MANIFEST_PATH,
		],
		mount: mounts,
		'additional-blueprint-steps': extraSteps,
	};
}

export {
	MARKDOWN_ROOT_VFS_PATH,
	MU_PLUGIN_VFS_PATH,
	SQLITE_MARKDOWN_MANIFEST_PATH,
};
