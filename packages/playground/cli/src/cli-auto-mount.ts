import { basename, join } from 'path';
import type {
	BlueprintDeclaration,
	StepDefinition,
} from '@wp-playground/blueprints';
import fs from 'fs';
import type { RunCLIArgs } from './run-cli';

export function expandAutoMounts(args: RunCLIArgs): RunCLIArgs {
	const path = process.cwd();

	const mount = [...(args.mount || [])];
	const mountBeforeInstall = [...(args.mountBeforeInstall || [])];

	if (isPluginDirectory(path)) {
		const pluginName = basename(path);
		mount.push(`${path}:/wordpress/wp-content/plugins/${pluginName}`);
	} else if (isThemeDirectory(path)) {
		const themeName = basename(path);
		mount.push(`${path}:/wordpress/wp-content/themes/${themeName}`);
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
		const mounts: string[] = [];
		for (const file of files) {
			if (file.startsWith('wp-content')) {
				continue;
			}
			mounts.push(`${path}/${file}:/wordpress/${file}`);
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
		mount.push(`${path}:/wordpress`);
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
export function wpContentMounts(wpContentDir: string): string[] {
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
			.map(
				(file) =>
					`${wpContentDir}/${file}:/wordpress/wp-content/${file}`
			)
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
