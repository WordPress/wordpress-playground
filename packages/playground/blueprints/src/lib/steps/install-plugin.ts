import type { StepHandler } from '.';
import type { InstallAssetOptions } from './install-asset';
import {
	assertSafePathSegment,
	assertSafeRelativeFileTree,
	handleIfAlreadyInstalled,
	installAsset,
} from './install-asset';
import { activatePlugin } from './activate-plugin';
import { writeFile } from './write-file';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import type { Directory } from '../v1/resources';
import { joinPaths } from '@php-wasm/util';
import { writeFiles, type UniversalPHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';

const ACTIVATION_OPTIONS_PAYLOAD_PREFIX = 'PLAYGROUND_ACTIVATION_OPTIONS:';

/**
 * @inheritDoc installPlugin
 * @hasRunnableExample
 * @needsLogin
 * @landingPage /wp-admin/plugins.php
 * @example
 *
 * <code>
 * {
 * 		"step": "installPlugin",
 * 		"pluginData": {
 * 			"resource": "wordpress.org/plugins",
 * 			"slug": "gutenberg"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 *
 * @example
 *
 * <code>
 * {
 * 		"step": "installPlugin",
 * 		"pluginData": {
 * 			"resource": "git:directory",
 * 			"url": "https://github.com/wordpress/wordpress-playground.git",
 * 				"ref": "HEAD",
 * 				"path": "wp-content/plugins/hello-dolly"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallPluginStep<
	FileResource,
	DirectoryResource,
> extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
	/**
	 * The step identifier.
	 */
	step: 'installPlugin';
	/**
	 * The plugin files to install. It can be a plugin zip file, a single PHP
	 * file, or a directory containing all the plugin files at its root.
	 */
	pluginData: FileResource | DirectoryResource;

	/**
	 * @deprecated. Use 'pluginData' instead.
	 */
	pluginZipFile?: FileResource;

	/**
	 * Optional installation options.
	 */
	options?: InstallPluginOptions;
}

export interface InstallPluginOptions {
	/**
	 * Whether to activate the plugin after installing it.
	 */
	activate?: boolean;
	/**
	 * Parameters to expose to the plugin during its activation hook.
	 */
	activationOptions?: Record<string, unknown>;
	/**
	 * Whether installation/activation failures should abort the Blueprint.
	 */
	onError?: 'skip-plugin' | 'throw';
	/**
	 * The name of the folder to install the plugin to. Defaults to guessing from pluginData
	 */
	targetFolderName?: string;
	/**
	 * Human-readable plugin name for the progress caption.
	 */
	humanReadableName?: string;
}

/**
 * Installs a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param pluginData The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export const installPlugin: StepHandler<
	InstallPluginStep<File, Directory>
> = async (
	playground,
	{ pluginData, pluginZipFile, ifAlreadyInstalled, options = {} },
	progress?
) => {
	if (pluginZipFile) {
		pluginData = pluginZipFile;
		logger.warn(
			'The "pluginZipFile" option is deprecated. Use "pluginData" instead.'
		);
	}

	const onError = options.onError ?? 'throw';
	let assetNiceName = '';
	const progressName = () => options.humanReadableName || assetNiceName;
	try {
		const pluginsDirectoryPath = joinPaths(
			await playground.documentRoot,
			'wp-content',
			'plugins'
		);
		const targetFolderName =
			'targetFolderName' in options ? options.targetFolderName : '';
		let assetFolderPath = '';

		const looksLikeZipFile = async (file: File): Promise<boolean> => {
			if (file.name.toLowerCase().endsWith('.zip')) {
				return true;
			}

			const filePrefix = new Uint8Array(
				await file.slice(0, 4).arrayBuffer()
			);
			// Check against the signature for non-empty, non-spanned zip files.
			const matchesZipSignature =
				filePrefix[0] === 0x50 &&
				filePrefix[1] === 0x4b &&
				filePrefix[2] === 0x03 &&
				filePrefix[3] === 0x04;
			return matchesZipSignature;
		};

		if (pluginData instanceof File) {
			if (await looksLikeZipFile(pluginData)) {
				const zipFileName =
					pluginData.name.split('/').pop() || 'plugin.zip';
				assetNiceName = zipNameToHumanName(zipFileName);

				progress?.tracker.setCaption(
					`Installing the ${progressName()} plugin`
				);
				const assetResult = await installAsset(playground, {
					ifAlreadyInstalled,
					zipFile: pluginData,
					targetPath: `${await playground.documentRoot}/wp-content/plugins`,
					targetFolderName: targetFolderName,
				});
				assetFolderPath = assetResult.assetFolderPath;
				assetNiceName = assetResult.assetFolderName;
			} else if (pluginData.name.endsWith('.php')) {
				assertSafePathSegment(pluginData.name, 'Plugin filename');
				const destinationFilePath = joinPaths(
					pluginsDirectoryPath,
					pluginData.name
				);
				const skipped = await handleIfAlreadyInstalled(playground, {
					assetName: pluginData.name,
					assetPath: destinationFilePath,
					targetPath: pluginsDirectoryPath,
					ifAlreadyInstalled,
					expectedType: 'file',
				});
				if (!skipped) {
					await writeFile(playground, {
						path: destinationFilePath,
						data: pluginData,
					});
				}
				assetFolderPath = pluginsDirectoryPath;
				assetNiceName = pluginData.name;
			} else {
				throw new Error(
					'pluginData looks like a file ' +
						'but does not look like a .zip or .php file.'
				);
			}
		} else if (pluginData) {
			assetNiceName = pluginData.name;
			progress?.tracker.setCaption(
				`Installing the ${progressName()} plugin`
			);
			assertSafePathSegment(
				targetFolderName || pluginData.name,
				'Plugin directory name'
			);
			assertSafeRelativeFileTree(pluginData.files, 'Plugin file paths');

			const pluginDirectoryPath = joinPaths(
				pluginsDirectoryPath,
				targetFolderName || pluginData.name
			);
			const skipped = await handleIfAlreadyInstalled(playground, {
				assetName: targetFolderName || pluginData.name,
				assetPath: pluginDirectoryPath,
				targetPath: pluginsDirectoryPath,
				ifAlreadyInstalled,
				expectedType: 'directory',
			});
			if (!skipped) {
				await writeFiles(
					playground,
					pluginDirectoryPath,
					pluginData.files,
					{
						rmRoot: true,
					}
				);
			}
			assetFolderPath = pluginDirectoryPath;
		}

		// Activate
		const activate = 'activate' in options ? options.activate : true;

		if (activate) {
			let activationOptionName: string | undefined;
			if (options.activationOptions !== undefined) {
				activationOptionName = await setPluginActivationOptions(
					playground,
					assetFolderPath,
					options.activationOptions
				);
			}
			try {
				await activatePlugin(
					playground,
					{
						pluginPath: assetFolderPath,
						pluginName: assetNiceName,
					},
					progress
				);
			} finally {
				if (activationOptionName) {
					await deletePluginActivationOptions(
						playground,
						activationOptionName
					);
				}
			}
		}
	} catch (error) {
		if (onError === 'skip-plugin') {
			const skippedPluginName = progressName() || 'unknown plugin';
			logger.warn(
				`Skipping plugin installation for ${skippedPluginName} after failure: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return;
		}
		throw error;
	}
};

/**
 * Stages activation options for a plugin before its activation hook runs.
 *
 * Activation happens in a separate PHP request, so options are written to a
 * temporary WordPress option keyed by the plugin file. The PHP helper prints a
 * sentinel-prefixed JSON payload because plugin bootstrap code may also write
 * to stdout; callers must delete the option in a `finally` block after
 * activation.
 */
async function setPluginActivationOptions(
	playground: UniversalPHP,
	pluginPath: string,
	activationOptions: Record<string, unknown>
) {
	const docroot = await playground.documentRoot;
	const result = await playground.run({
		code: `<?php
ob_start();
define('WP_ADMIN', true);
require_once getenv('DOCROOT') . "/wp-load.php";
require_once getenv('DOCROOT') . "/wp-admin/includes/plugin.php";

$plugin_path = getenv('PLUGIN_PATH');
$plugin_file = '';
if (is_dir($plugin_path)) {
	foreach ((glob(rtrim($plugin_path, '/') . '/*.php') ?: array()) as $file) {
		$info = get_plugin_data($file, false, false);
		if (!empty($info['Name'])) {
			$plugin_file = $file;
			break;
		}
	}
} else {
	$plugin_file = $plugin_path;
	if (strpos($plugin_file, WP_PLUGIN_DIR) !== 0 && file_exists(WP_PLUGIN_DIR . '/' . $plugin_file)) {
		$plugin_file = WP_PLUGIN_DIR . '/' . $plugin_file;
	}
}

if (!$plugin_file || !file_exists($plugin_file)) {
	ob_end_clean();
	echo '${ACTIVATION_OPTIONS_PAYLOAD_PREFIX}' . json_encode(array('error' => 'Could not find plugin file for activation options.'));
	exit;
}

$options = json_decode(getenv('ACTIVATION_OPTIONS'), true);
if (!is_array($options)) {
	$options = array();
}
	$option_name = 'blueprint_activation_' . plugin_basename($plugin_file);
	update_option($option_name, $options);
	ob_end_clean();
	echo '${ACTIVATION_OPTIONS_PAYLOAD_PREFIX}' . json_encode(array('optionName' => $option_name));
	`,
		env: {
			DOCROOT: docroot,
			PLUGIN_PATH: pluginPath,
			ACTIVATION_OPTIONS: JSON.stringify(activationOptions),
		},
	});
	const payload = parseActivationOptionsPayload(result.text);
	if (payload?.['error']) {
		throw new Error(String(payload['error']));
	}
	if (!payload?.['optionName'] || typeof payload['optionName'] !== 'string') {
		throw new Error('Could not determine plugin activation options name.');
	}
	return payload['optionName'];
}

async function deletePluginActivationOptions(
	playground: UniversalPHP,
	optionName: string
) {
	await playground.run({
		code: `<?php
require_once getenv('DOCROOT') . "/wp-load.php";
delete_option(getenv('OPTION_NAME'));
`,
		env: {
			DOCROOT: await playground.documentRoot,
			OPTION_NAME: optionName,
		},
	});
}

function parseActivationOptionsPayload(text: string | undefined) {
	const output = text || '';
	const payloadIndex = output.lastIndexOf(ACTIVATION_OPTIONS_PAYLOAD_PREFIX);
	if (payloadIndex === -1) {
		return undefined;
	}
	const payload = output
		.slice(payloadIndex + ACTIVATION_OPTIONS_PAYLOAD_PREFIX.length)
		.trimStart()
		.split(/\r?\n/, 1)[0]
		.trim();
	if (!payload) {
		return undefined;
	}
	try {
		return JSON.parse(payload) as Record<string, unknown>;
	} catch {
		throw new Error('Could not parse plugin activation options payload.');
	}
}
