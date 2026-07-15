export * from '@wp-playground/blueprints';

export type {
	HTTPMethod,
	PathAlias,
	PHPRunOptions,
	PHPRequest,
	PHPResponse,
	UniversalPHP,
	PHPOutput,
	PHPResponseData,
	ErrnoError,
	PHPRequestHandler,
	PHPRequestHandlerConfiguration,
	PHPRequestHeaders,
	SupportedPHPVersion,
	RmDirOptions,
	RuntimeType,
} from '@php-wasm/universal';
export type { WordPressInstallMode } from '@wp-playground/wordpress';
export {
	setPhpIniEntries,
	PHPNextVersion,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';
export { phpVar, phpVars } from '@php-wasm/util';
export type { PlaygroundClient, MountDescriptor };

import {
	BlueprintReflection,
	isBlueprintBundle,
	type Blueprint,
	type BlueprintDeclaration,
} from '@wp-playground/blueprints';
import type {
	BlueprintV1,
	BlueprintV1Declaration,
	OnStepCompleted,
} from '@wp-playground/blueprints';
import type { WordPressInstallMode } from '@wp-playground/wordpress';
import { ProgressTracker } from '@php-wasm/progress';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import type { PathAlias } from '@php-wasm/universal';
import type { PHPWebExtension } from '@php-wasm/web';
import { additionalRemoteOrigins } from './additional-remote-origins';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../../build-config';
import { BlueprintsV1Handler } from './blueprints-v1-handler';
import { BlueprintsV2Handler } from './blueprints-v2-handler';

const WITH_ADMIN_TRANSITIONS_PARAM = 'with-admin-transitions';

export interface StartPlaygroundOptions {
	iframe: HTMLIFrameElement;
	remoteUrl: string;
	progressTracker?: ProgressTracker;
	disableProgressBar?: boolean;
	/**
	 * A stable label for the loading progress bar, typically the name of the
	 * Playground being started. It stays visible while boot captions change.
	 */
	siteName?: string;
	blueprint?: BlueprintV1;
	/**
	 * PHP extensions to install before the runtime starts.
	 */
	extensions?: PHPWebExtension[];
	onBlueprintStepCompleted?: OnStepCompleted;
	onBlueprintValidated?: (blueprint: BlueprintV1Declaration) => void;
	/**
	 * Called when the playground client is connected, but before the blueprint
	 * steps are run.
	 *
	 * @param playground
	 * @returns
	 */
	onClientConnected?: (playground: PlaygroundClient) => void;
	/**
	 * The SAPI name PHP will use.
	 * @internal
	 * @private
	 */
	sapiName?: string;
	mounts?: Array<MountDescriptor>;
	/**
	 * @deprecated Use `wordpressInstallMode` instead.
	 *
	 * Whether to download/install WordPress files. Set this to `false` when
	 * WordPress files are already available, for example from `mounts` or a
	 * saved site.
	 */
	shouldInstallWordPress?: boolean;
	/**
	 * The string prefix used in the site URL served by the currently
	 * running remote.html. E.g. for a prefix like `/scope:playground/`,
	 * the scope would be `playground`. See the `@php-wasm/scopes` package
	 * for more details.
	 */
	scope?: string;
	/**
	 * Proxy URL to use for cross-origin requests.
	 *
	 * For example, if corsProxy is set to "https://cors.wordpress.net/proxy.php",
	 * then the CORS requests to https://github.com/WordPress/wordpress-playground.git would actually
	 * be made to https://cors.wordpress.net/proxy.php?https://github.com/WordPress/wordpress-playground.git.
	 *
	 * The Blueprints library will arbitrarily choose which requests to proxy. If you need
	 * to proxy every single request, do not use this option. Instead, you should preprocess
	 * your Blueprint to replace all cross-origin URLs with the proxy URL.
	 */
	corsProxy?: string;
	/**
	 * Additional headers to pass to git operations.
	 * A function that returns headers based on the URL being accessed.
	 */
	gitAdditionalHeadersCallback?: (url: string) => Record<string, string>;
	/**
	 * The version of the SQLite driver to use.
	 * Defaults to the latest development version.
	 */
	sqliteDriverVersion?: string;
	/**
	 * How to handle WordPress installation.
	 * Defaults to `download-and-install`.
	 */
	wordpressInstallMode?: WordPressInstallMode;
	/**
	 * Path aliases that map URL prefixes to filesystem paths outside
	 * the document root. Similar to Nginx's `alias` directive.
	 *
	 * @example
	 * ```ts
	 * pathAliases: [
	 *   { urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' }
	 * ]
	 * ```
	 */
	pathAliases?: PathAlias[];
}

export interface StartPlaygroundWebOptions extends Omit<
	StartPlaygroundOptions,
	'blueprint' | 'onBlueprintValidated'
> {
	blueprint?: Blueprint;
	onBlueprintValidated?: (blueprint: BlueprintDeclaration) => void;
}

/**
 * Loads playground in iframe and returns a PlaygroundClient instance.
 *
 * @param iframe Any iframe with Playground's remote.html loaded.
 * @param options Options for loading the playground.
 * @returns A PlaygroundClient instance.
 */
export async function startPlaygroundWeb(
	options: StartPlaygroundWebOptions
): Promise<PlaygroundClient> {
	const {
		iframe,
		progressTracker = new ProgressTracker(),
		disableProgressBar,
	} = options;
	let { remoteUrl } = options;
	assertLikelyCompatibleRemoteOrigin(remoteUrl);
	allowStorageAccessByUserActivation(iframe);
	const useBlueprintV2Handler = await shouldUseBlueprintV2Handler(
		options.blueprint
	);

	const remoteUrlWithoutLegacyRunner = new URL(remoteUrl, remoteOrigin);
	remoteUrlWithoutLegacyRunner.searchParams.delete('blueprints-runner');
	remoteUrl = setQueryParams(remoteUrlWithoutLegacyRunner.toString(), {
		progressbar: !disableProgressBar,
		progressbarTitle: options.siteName || undefined,
		[WITH_ADMIN_TRANSITIONS_PARAM]: new URL(
			globalThis.location.href
		).searchParams.has(WITH_ADMIN_TRANSITIONS_PARAM)
			? '1'
			: undefined,
	});
	progressTracker.setCaption('Preparing WordPress');

	await new Promise((resolve) => {
		iframe.src = remoteUrl;
		iframe.addEventListener('load', resolve, false);
	});

	const handler = useBlueprintV2Handler
		? new BlueprintsV2Handler(options)
		: new BlueprintsV1Handler(options as StartPlaygroundOptions);
	const playground = await handler.bootPlayground(iframe, progressTracker);

	progressTracker.finish();

	return playground;
}

async function shouldUseBlueprintV2Handler(
	blueprint: StartPlaygroundWebOptions['blueprint']
) {
	if (!blueprint) {
		return false;
	}
	if (!isBlueprintBundle(blueprint)) {
		return 'version' in blueprint && blueprint.version === 2;
	}
	const reflection = await BlueprintReflection.create(blueprint);
	return reflection.getVersion() === 2;
}

/**
 * Chrome does not allow Service Workers to be registered from cross-origin
 * iframes when third-party cookies are disabled unless
 * `requestStorageAccess()` is called and the user grants storage access.
 *
 * However, sandboxed <iframe>s cannot be granted storage access by default for
 * security reasons. Therefore, we need to add the
 * `allow-storage-access-by-user-activation` flag to the iframe's sandbox
 * attribute if it is not already present.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API
 */
function allowStorageAccessByUserActivation(iframe: HTMLIFrameElement) {
	if (
		iframe.sandbox?.length &&
		!iframe.sandbox?.contains('allow-storage-access-by-user-activation')
	) {
		iframe.sandbox.add('allow-storage-access-by-user-activation');
	}
}

const officialRemoteOrigin = 'https://playground.wordpress.net';
const devRemoteOrigin = `http://${remoteDevServerHost}:${remoteDevServerPort}`;
const validRemoteOrigins = [
	officialRemoteOrigin,
	devRemoteOrigin,
	// An older origin that's still used by some plugins.
	'https://wasm.wordpress.net',
	// Allow hosting remote from same origin
	location.origin,
	// Allow hosting remote from the same origin as the client library.
	new URL(import.meta.url).origin,
	'http://localhost',
	'http://localhost:5400',
	'https://localhost',
	'http://127.0.0.1',
	'http://127.0.0.1:5400',
	'https://127.0.0.1',
	...additionalRemoteOrigins,
];
const remoteOrigin =
	import.meta.env.MODE == 'development'
		? devRemoteOrigin
		: officialRemoteOrigin;
/**
 * Assert that the remote origin is likely compatible with this client library.
 *
 * Prior to this assertion, there were cases where folks used the client library
 * from playground.wordpress.net with other origins and eventually ran into
 * compatibility issues when the two sides went out of sync. This way,
 * we discourage that practice which is likely to lead to breakage for the
 * embedding app.
 *
 * @param remoteHtmlUrl The URL for remote.html
 */
function assertLikelyCompatibleRemoteOrigin(remoteHtmlUrl: string) {
	const url = new URL(remoteHtmlUrl, remoteOrigin);

	const validRemote =
		validRemoteOrigins.includes(url.origin) &&
		url.pathname === '/remote.html';

	if (!validRemote) {
		throw new Error(
			`Invalid remote URL: ${url}. ` +
				'Expected remote URL to have a path of "/remote.html" based ' +
				`on one of the following origins:\n ${validRemoteOrigins.join(
					'\n'
				)}`
		);
	}
}

function setQueryParams(url: string, params: Record<string, unknown>) {
	const urlObject = new URL(url, remoteOrigin);
	const qs = new URLSearchParams(urlObject.search);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== false) {
			if (Array.isArray(value)) {
				for (const item of value) {
					qs.append(key, item.toString());
				}
			} else {
				qs.set(key, value.toString());
			}
		}
	}
	urlObject.search = qs.toString();
	return urlObject.toString();
}
