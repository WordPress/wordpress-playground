export * from '@wp-playground/blueprints';

export type {
	HTTPMethod,
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
export {
	setPhpIniEntries,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';
export { phpVar, phpVars } from '@php-wasm/util';
export type { PlaygroundClient, MountDescriptor };

import type {
	BlueprintV1,
	BlueprintV1Declaration,
	OnStepCompleted,
} from '@wp-playground/blueprints';
import { ProgressTracker } from '@php-wasm/progress';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import { additionalRemoteOrigins } from './additional-remote-origins';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../../build-config';
import { BlueprintsV1Handler } from './blueprints-v1-handler';
import { BlueprintsV2Handler } from './blueprints-v2-handler';

export interface StartPlaygroundOptions {
	iframe: HTMLIFrameElement;
	remoteUrl: string;
	progressTracker?: ProgressTracker;
	disableProgressBar?: boolean;
	blueprint?: BlueprintV1;
	/**
	 * Prefer experimental Blueprints v2 PHP runner instead of TypeScript steps
	 */
	experimentalBlueprintsV2Runner?: boolean;
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
	 * The version of the SQLite driver to use.
	 * Defaults to the latest development version.
	 */
	sqliteDriverVersion?: string;
}

/**
 * Loads playground in iframe and returns a PlaygroundClient instance.
 *
 * @param iframe Any iframe with Playground's remote.html loaded.
 * @param options Options for loading the playground.
 * @returns A PlaygroundClient instance.
 */
export async function startPlaygroundWeb(
	options: StartPlaygroundOptions
): Promise<PlaygroundClient> {
	const {
		iframe,
		progressTracker = new ProgressTracker(),
		disableProgressBar,
	} = options;
	let { remoteUrl } = options;
	assertLikelyCompatibleRemoteOrigin(remoteUrl);
	allowStorageAccessByUserActivation(iframe);

	remoteUrl = setQueryParams(remoteUrl, {
		progressbar: !disableProgressBar,
		'blueprints-runner': options.experimentalBlueprintsV2Runner
			? 'v2'
			: 'v1',
	});
	progressTracker.setCaption('Preparing WordPress');

	await new Promise((resolve) => {
		iframe.src = remoteUrl;
		iframe.addEventListener('load', resolve, false);
	});

	const handler = options.experimentalBlueprintsV2Runner
		? new BlueprintsV2Handler(options)
		: new BlueprintsV1Handler(options);
	const playground = await handler.bootPlayground(iframe, progressTracker);

	progressTracker.finish();

	return playground;
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
