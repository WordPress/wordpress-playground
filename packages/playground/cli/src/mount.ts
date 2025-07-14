import { basename, join } from 'path';
import type {
	BlueprintDeclaration,
	StepDefinition,
} from '@wp-playground/blueprints';
import fs from 'fs';
import type { RunCLIArgs } from './run-cli';
import { existsSync } from 'fs';
import path from 'path';
import { createNodeFsMountHandler } from '@php-wasm/node';
import type { PHP } from '@php-wasm/universal';

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

export function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		php.mkdir(mount.vfsPath);
		php.mount(mount.vfsPath, createNodeFsMountHandler(mount.hostPath));
	}
}

export function expandAutoMounts(args: RunCLIArgs): RunCLIArgs {
	const path = process.cwd();

	const mount = [...(args.mount || [])];
	const mountBeforeInstall = [...(args.mountBeforeInstall || [])];

	if (isPluginDirectory(path)) {
		const pluginName = basename(path);
		mount.push({
			hostPath: path,
			vfsPath: `/wordpress/wp-content/plugins/${pluginName}`,
		});
	} else if (isThemeDirectory(path)) {
		const themeName = basename(path);
		mount.push({
			hostPath: path,
			vfsPath: `/wordpress/wp-content/themes/${themeName}`,
		});
	} else if (containsWpContentDirectories(path)) {
		mount.push(...wpContentMounts(path));
	} else if (containsFullWordPressInstallation(path)) {
		/**
		 * We don't want Playground and WordPress to modify the OS filesystem on their own
		 * by creating files like wp-config.php or wp-content/db.php.
		 * To ensure WordPress can write to the /wordpress/ and /wordpress/wp-content/ directories,
		 * we leave these directories as MEMFS nodes and mount individual files
		 * and directories into them instead of mounting the entire directory as a NODEFS node.
		 */
		const files = fs.readdirSync(path);
		const mounts: Mount[] = [];
		for (const file of files) {
			if (file.startsWith('wp-content')) {
				continue;
			}
			mounts.push({
				hostPath: `${path}/${file}`,
				vfsPath: `/wordpress/${file}`,
			});
		}
		mountBeforeInstall.push(
			...mounts,
			...wpContentMounts(join(path, 'wp-content'))
		);
	} else {
		/**
		 * By default, mount the current working directory as the Playground root.
		 * This allows users to run and PHP or HTML files using the Playground CLI.
		 */
		mount.push({ hostPath: path, vfsPath: '/wordpress' });
	}

	const blueprint = (args.blueprint as BlueprintDeclaration) || {};
	blueprint.steps = [...(blueprint.steps || []), ...getSteps(path)];

	/**
	 * If Playground is mounting a full WordPress directory,
	 * it doesn't need to setup WordPress.
	 */
	const skipWordPressSetup =
		args.skipWordPressSetup || containsFullWordPressInstallation(path);

	return {
		...args,
		blueprint,
		mount,
		mountBeforeInstall,
		skipWordPressSetup,
	} as RunCLIArgs;
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

export function isPluginDirectory(path: string): boolean {
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

/**
 * Returns a list of files and directories in the wp-content directory
 * to be mounted individually.
 *
 * This is needed because WordPress needs to be able to write to the
 * wp-content directory without Playground modifying the OS filesystem.
 *
 * See expandAutoMounts for more details.
 */
export function wpContentMounts(wpContentDir: string): Mount[] {
	const files = fs.readdirSync(wpContentDir);
	return (
		files
			/**
			 * index.php is added by WordPress automatically and
			 * can't be mounted from the current working directory
			 * because it already exists.
			 *
			 * Because index.php should be empty, it's safe to not include it.
			 */
			.filter((file) => !file.startsWith('index.php'))
			.map((file) => ({
				hostPath: `${wpContentDir}/${file}`,
				vfsPath: `/wordpress/wp-content/${file}`,
			}))
	);
}

export function getSteps(path: string): StepDefinition[] {
	if (isPluginDirectory(path)) {
		return [
			{
				step: 'activatePlugin',
				pluginPath: `/wordpress/wp-content/plugins/${basename(path)}`,
			},
		];
	} else if (isThemeDirectory(path)) {
		return [
			{
				step: 'activateTheme',
				themeFolderName: basename(path),
			},
		];
	} else if (
		containsWpContentDirectories(path) ||
		containsFullWordPressInstallation(path)
	) {
		/**
		 * Playground needs to ensure there is an active theme.
		 * Otherwise when WordPress loads it will show a white screen.
		 */
		return [
			{
				step: 'runPHP',
				code: `<?php
					require_once '/wordpress/wp-load.php';
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
		];
	}
	return [];
}
