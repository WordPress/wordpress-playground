import type { StepHandler } from '.';
import type { InstallAssetOptions } from './install-asset';
import { installAsset } from './install-asset';
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
	 * The name of the folder to install the plugin to. Defaults to guessing from pluginData
	 */
	targetFolderName?: string;
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

	const pluginsDirectoryPath = joinPaths(
		await playground.documentRoot,
		'wp-content',
		'plugins'
	);
	const targetFolderName =
		'targetFolderName' in options ? options.targetFolderName : '';
	let assetFolderPath = '';
	let assetNiceName = '';

	const looksLikeZipFile = async (file: File): Promise<boolean> => {
		if (file.name.toLowerCase().endsWith('.zip')) {
			return true;
		}

		const filePrefix = new Uint8Array(await file.arrayBuffer(), 0, 4);
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
			// Assume any other file is a zip file
			// @TODO: Consider validating whether this is a zip file?
			const zipFileName =
				pluginData.name.split('/').pop() || 'plugin.zip';
			assetNiceName = zipNameToHumanName(zipFileName);

			progress?.tracker.setCaption(
				`Installing the ${assetNiceName} plugin`
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
			const destinationFilePath = joinPaths(
				pluginsDirectoryPath,
				pluginData.name
			);
			await writeFile(playground, {
				path: destinationFilePath,
				data: pluginData,
			});
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
		progress?.tracker.setCaption(`Installing the ${assetNiceName} plugin`);

		const pluginDirectoryPath = joinPaths(
			pluginsDirectoryPath,
			targetFolderName || pluginData.name
		);
		await writeFiles(playground, pluginDirectoryPath, pluginData.files, {
			rmRoot: true,
		});
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
};

/**
 * Stages activation options for a plugin before its activation hook runs.
 *
 * Blueprint v2 defines these as values exposed through the
 * `blueprint_activation_` + `plugin_basename(__FILE__)` option during
 * activation. A runtime-only global/env value would be cleaner, but activation
 * currently happens behind `activatePlugin()`, across a separate PHP request
 * boundary from this staging call. The temporary option survives that boundary
 * and is deleted in `finally` after activation.
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

$payload_prefix = getenv('ACTIVATION_OPTIONS_PAYLOAD_PREFIX');
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
	$plugin_dir = rtrim(WP_PLUGIN_DIR, '/');
	$plugin_file = $plugin_path;
	if (strpos($plugin_file, $plugin_dir . '/') !== 0 && file_exists($plugin_dir . '/' . $plugin_file)) {
		$plugin_file = $plugin_dir . '/' . $plugin_file;
	}
}

if (!$plugin_file || !file_exists($plugin_file)) {
	ob_end_clean();
	// Prefix the JSON payload so JS can find it even if plugin bootstrap
	// code prints notices or other output during this request.
	echo $payload_prefix . json_encode(array('error' => 'Could not find plugin file for activation options.'));
	exit;
}

$options_json = getenv('ACTIVATION_OPTIONS_JSON');
$options = json_decode($options_json ?: '', true);
if (!is_array($options)) {
	ob_end_clean();
	// Prefix the JSON payload so JS can find it even if plugin bootstrap
	// code prints notices or other output during this request.
	echo $payload_prefix . json_encode(array('error' => 'Could not decode plugin activation options.'));
	exit;
}
$option_name = 'blueprint_activation_' . plugin_basename($plugin_file);
update_option($option_name, $options);
ob_end_clean();
// Prefix the JSON payload so JS can find it even if plugin bootstrap
// code prints notices or other output during this request.
echo $payload_prefix . json_encode(array('optionName' => $option_name));
`,
		env: {
			DOCROOT: docroot,
			PLUGIN_PATH: pluginPath,
			ACTIVATION_OPTIONS_JSON: JSON.stringify(activationOptions),
			ACTIVATION_OPTIONS_PAYLOAD_PREFIX:
				ACTIVATION_OPTIONS_PAYLOAD_PREFIX,
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

/**
 * Extracts the staging helper's JSON payload from noisy PHP output.
 *
 * `playground.run()` returns everything printed during the request. A plugin
 * file loaded by WordPress may echo warnings, notices, or regular output while
 * the helper is locating the plugin file. The helper therefore prefixes its
 * machine-readable JSON with `ACTIVATION_OPTIONS_PAYLOAD_PREFIX`, and this
 * parser reads only the first line after the last prefix occurrence.
 */
function parseActivationOptionsPayload(text: string | undefined) {
	const output = text || '';

	// Plugin bootstrap code may write arbitrary output before or after our
	// helper runs, so read the last sentinel occurrence instead of assuming
	// the response body is only JSON.
	const payloadIndex = output.lastIndexOf(ACTIVATION_OPTIONS_PAYLOAD_PREFIX);
	if (payloadIndex === -1) {
		return undefined;
	}

	// The helper emits exactly one JSON object after the sentinel. Keep only
	// the first line so later plugin output cannot become part of the JSON
	// parse.
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
