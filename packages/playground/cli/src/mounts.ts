import { createNodeFsMountHandler } from '@php-wasm/node';
import type { PHP } from '@php-wasm/universal';
import fs, { existsSync } from 'fs';
import path, { basename, join } from 'path';
import type { RunCLIArgs } from './run-cli';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

/**
 * Parse an array of mount argument strings where the host path and VFS path
 * are separated by a colon.
 *
 * Example:
 *     parseMountWithDelimiterArguments( [ '/host/path:/vfs/path', '/host/path:/vfs/path' ] )
 *     // returns:
 *     [
 *         { hostPath: '/host/path', vfsPath: '/vfs/path' },
 *         { hostPath: '/host/path', vfsPath: '/vfs/path' }
 *     ]
 *
 * @param mounts - An array of mount argument strings separated by a colon.
 * @returns An array of Mount objects.
 */
export function parseMountWithDelimiterArguments(mounts: string[]): Mount[] {
	const parsedMounts = [];
	for (const mount of mounts) {
		const mountParts = mount.split(':');
		if (mountParts.length !== 2) {
			throw new Error(`Invalid mount format: ${mount}.
				Expected format: /host/path:/vfs/path.
				If your path contains a colon, e.g. C:\\myplugin, use the --mount-dir option instead.
				Example: --mount-dir C:\\my-plugin /wordpress/wp-content/plugins/my-plugin`);
		}
		const [hostPath, vfsPath] = mountParts;
		if (!existsSync(hostPath)) {
			throw new Error(`Host path does not exist: ${hostPath}`);
		}
		parsedMounts.push({ hostPath, vfsPath });
	}
	return parsedMounts;
}

/**
 * Parse an array of mount argument strings where each odd array element is a host path
 * and each even element is the VFS path.
 * e.g. [ '/host/path', '/vfs/path', '/host/path2', '/vfs/path2' ]
 *
 * The result will be an array of Mount objects for each host path the
 * following element is it's VFS path.
 * e.g. [
 *   { hostPath: '/host/path', vfsPath: '/vfs/path' },
 *   { hostPath: '/host/path2', vfsPath: '/vfs/path2' }
 * ]
 *
 * @param mounts - An array of paths
 * @returns An array of Mount objects.
 */
export function parseMountDirArguments(mounts: string[]): Mount[] {
	if (mounts.length % 2 !== 0) {
		throw new Error('Invalid mount format. Expected: /host/path /vfs/path');
	}

	const parsedMounts = [];
	for (let i = 0; i < mounts.length; i += 2) {
		const source = mounts[i];
		const vfsPath = mounts[i + 1];
		if (!existsSync(source)) {
			throw new Error(`Host path does not exist: ${source}`);
		}
		parsedMounts.push({
			hostPath: path.resolve(process.cwd(), source),
			vfsPath,
		});
	}
	return parsedMounts;
}

export async function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		php.mkdir(mount.vfsPath);
		await php.mount(
			mount.vfsPath,
			createNodeFsMountHandler(mount.hostPath)
		);
	}
}

const ACTIVATE_FIRST_THEME_STEP = {
	step: 'runPHP',
	code: {
		filename: 'activate-theme.php',
		content: `<?php
			require_once getenv('DOCROOT') . '/wp-load.php';
			$theme = wp_get_theme();
			if (!$theme->exists()) {
				$themes = wp_get_themes();
				if (count($themes) > 0) {
					$themeName = array_keys($themes)[0];
					switch_theme($themeName);
				}
			}
		`,
	},
};

/**
 * Auto-mounts resolution logic:
 */
export function expandAutoMounts(args: RunCLIArgs): RunCLIArgs {
	const path = process.cwd();

	const mount = [...(args.mount || [])];
	const mountBeforeInstall = [...(args['mount-before-install'] || [])];

	const newArgs = {
		...args,
		mount,
		'mount-before-install': mountBeforeInstall,
		'additional-blueprint-steps': [
			...((args as any)['additional-blueprint-steps'] || []),
		],
	};

	if (isPluginFilename(path)) {
		const pluginName = basename(path);
		mount.push({
			hostPath: path,
			vfsPath: `/wordpress/wp-content/plugins/${pluginName}`,
		});
		newArgs['additional-blueprint-steps'].push({
			step: 'activatePlugin',
			pluginPath: `/wordpress/wp-content/plugins/${basename(path)}`,
		});
	} else if (isThemeDirectory(path)) {
		const themeName = basename(path);
		mount.push({
			hostPath: path,
			vfsPath: `/wordpress/wp-content/themes/${themeName}`,
		});
		newArgs['additional-blueprint-steps'].push({
			step: 'activateTheme',
			themeDirectoryName: themeName,
		});
	} else if (containsWpContentDirectories(path)) {
		/**
		 * Mount each wp-content file and directory individually.
		 */
		const files = fs.readdirSync(path);
		for (const file of files) {
			/**
			 * WordPress already ships with the wp-content/index.php file
			 * and Playground does not support overriding existing VFS files
			 * with mounts.
			 */
			if (file === 'index.php') {
				continue;
			}
			mount.push({
				hostPath: `${path}/${file}`,
				vfsPath: `/wordpress/wp-content/${file}`,
			});
		}
		newArgs['additional-blueprint-steps'].push(ACTIVATE_FIRST_THEME_STEP);
	} else if (containsFullWordPressInstallation(path)) {
		mountBeforeInstall.push({ hostPath: path, vfsPath: '/wordpress' });
		// @TODO: Uncomment when merging Blueprints v2 support
		// newArgs.mode = 'apply-to-existing-site';
		newArgs['additional-blueprint-steps'].push(ACTIVATE_FIRST_THEME_STEP);
	} else {
		/**
		 * By default, mount the current working directory as the Playground root.
		 * This allows users to run and PHP or HTML files using the Playground CLI.
		 */
		mount.push({ hostPath: path, vfsPath: '/wordpress' });
		// @TODO: Uncomment when merging Blueprints v2 support
		// newArgs.mode = 'mount-only';
	}

	return newArgs as RunCLIArgs;
}

export function containsFullWordPressInstallation(path: string): boolean {
	const files = fs.readdirSync(path);
	return (
		files.includes('wp-admin') &&
		files.includes('wp-includes') &&
		files.includes('wp-content')
	);
}

export function containsWpContentDirectories(path: string): boolean {
	const files = fs.readdirSync(path);
	return (
		files.includes('themes') ||
		files.includes('plugins') ||
		files.includes('mu-plugins') ||
		files.includes('uploads')
	);
}

export function isThemeDirectory(path: string): boolean {
	const files = fs.readdirSync(path);
	if (!files.includes('style.css')) {
		return false;
	}
	const styleCssContent = fs.readFileSync(join(path, 'style.css'), 'utf8');
	const themeNameRegex = /^(?:[ \t]*<\?php)?[ \t/*#@]*Theme Name:(.*)$/im;
	return !!themeNameRegex.exec(styleCssContent);
}

export function isPluginFilename(path: string): boolean {
	const files = fs.readdirSync(path);
	const pluginNameRegex = /^(?:[ \t]*<\?php)?[ \t/*#@]*Plugin Name:(.*)$/im;
	const pluginNameMatch = files
		.filter((file) => file.endsWith('.php'))
		.find((file) => {
			const fileContent = fs.readFileSync(join(path, file), 'utf8');
			return !!pluginNameRegex.exec(fileContent);
		});
	return !!pluginNameMatch;
}
