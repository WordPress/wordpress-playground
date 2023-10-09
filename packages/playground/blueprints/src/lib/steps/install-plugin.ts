import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';
import { zipNameToHumanName } from './common';
import { installAsset } from './install-asset';
import { activatePlugin } from './activate-plugin';

/**
 * @inheritDoc installPlugin
 * @hasRunnableExample
 * @needsLogin
 * @landingPage /wp-admin/plugins.php
 * @example
 *
 * <code>
 * {
 * 	    "step": "installPlugin",
 * 		"pluginZipFile": {
 * 			"resource": "wordpress.org/plugins",
 * 			"slug": "gutenberg"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallPluginStep<ResourceType> {
	/**
	 * The step identifier.
	 */
	step: 'installPlugin';
	/**
	 * The plugin zip file to install.
	 */
	pluginZipFile: ResourceType;
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
}

/**
 * Installs a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param pluginZipFile The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export const installPlugin: StepHandler<InstallPluginStep<File>> = async (
	playground,
	{ pluginZipFile, options = {} },
	progress?
) => {
	const zipFileName = pluginZipFile.name.split('/').pop() || 'plugin.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);

	progress?.tracker.setCaption(`Installing the ${zipNiceName} plugin`);
	try {
		const { assetFolderPath } = await installAsset(playground, {
			zipFile: pluginZipFile,
			targetPath: `${await playground.documentRoot}/wp-content/plugins`,
		});

		// Activate

		const activate = 'activate' in options ? options.activate : true;

		if (activate) {
			await activatePlugin(
				playground,
				{
					pluginPath: assetFolderPath,
					pluginName: zipNiceName,
				},
				progress
			);
		}

		await applyGutenbergPatchOnce(playground);
	} catch (error) {
		console.error(
			`Proceeding without the ${zipNiceName} plugin. Could not install it in wp-admin. ` +
				`The original error was: ${error}`
		);
		console.error(error);
	}
};

async function applyGutenbergPatchOnce(playground: UniversalPHP) {
	/**
	 * Ensures the block editor iframe is controlled by the playground
	 * service worker. Tl;dr it must use a HTTP URL as its src, not a
	 * data URL, blob URL, or a srcDoc like it does by default.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/pull/668
	 *
	 * The code below repeated in the WordPress bundler in
	 * compile-wordpress/build-assets/controlled-iframe.js.
	 */

	if (
		(await playground.isDir('/wordpress/wp-content/plugins/gutenberg')) &&
		!(await playground.fileExists('/wordpress/.gutenberg-patched'))
	) {
		const controlledIframe = `
/**
 * A synchronous function to read a blob URL as text.
 * 
 * @param {string} url 
 * @returns {string}
 */
const __playground_readBlobAsText = function (url) {
	try {
	  let xhr = new XMLHttpRequest();
	  xhr.open('GET', url, false);
	  xhr.overrideMimeType('text/plain;charset=utf-8');
	  xhr.send();
	  return xhr.responseText;
	} catch(e) {
	  return '';
	} finally {
	  URL.revokeObjectURL(url);
	}
}

window.__playground_ControlledIframe = window.wp.element.forwardRef(function (props, ref) {
    const source = window.wp.element.useMemo(function () {
        if (props.srcDoc) {
            // WordPress <= 6.2 uses a srcDoc that only contains a doctype.
            return '/wp-includes/empty.html';
        } else if (props.src && props.src.startsWith('blob:')) {
            // WordPress 6.3 uses a blob URL with doctype and a list of static assets.
            // Let's pass the document content to empty.html and render it there.
            return '/wp-includes/empty.html#' + encodeURIComponent(__playground_readBlobAsText(props.src));
        } else {
            // WordPress >= 6.4 uses a plain HTTPS URL that needs no correction.
            return props.src;
        }
    }, [props.src]);
	return (
		window.wp.element.createElement('iframe', {
			...props,
			ref: ref,
            src: source,
            // Make sure there's no srcDoc, as it would interfere with the src.
            srcDoc: undefined
		})
	)
});`;

		await playground.writeFile('/wordpress/.gutenberg-patched', '1');
		await updateFile(
			playground,
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.js`,
			(contents) =>
				controlledIframe +
				contents.replace(
					/\(\s*"iframe",/g,
					'(window.__playground_ControlledIframe,'
				)
		);
		await updateFile(
			playground,
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.min.js`,
			(contents) =>
				controlledIframe +
				contents.replace(
					/\(\s*"iframe",/g,
					'(window.__playground_ControlledIframe,'
				)
		);
	}
}

async function updateFile(
	playground: UniversalPHP,
	path: string,
	callback: (contents: string) => string
) {
	return await playground.writeFile(
		path,
		callback(await playground.readFileAsText(path))
	);
}
