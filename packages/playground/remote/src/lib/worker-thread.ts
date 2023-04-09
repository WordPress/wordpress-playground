import {
	loadPHPRuntime,
	PHP,
	PHPBrowser,
	PHPClient,
	exposeAPI,
	PublicAPI,
	getPHPLoaderModule,
	parseWorkerStartupOptions,
} from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './is-uploaded-file-path';
import patchWordPress from './wordpress-patch';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const php = new PHP(undefined, {
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	isStaticFilePath: isUploadedFilePath,
});

const monitor = new EmscriptenDownloadMonitor();

/** @inheritDoc PHPClient */
export class PlaygroundWorkerClientClass extends PHPClient {
	scope: Promise<string>;
	wordPressVersion: Promise<string>;
	phpVersion: Promise<string>;

	constructor(
		php: PHP,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string,
		phpVersion: string
	) {
		super(php, monitor);
		this.scope = Promise.resolve(scope);
		this.wordPressVersion = Promise.resolve(wordPressVersion);
		this.phpVersion = Promise.resolve(phpVersion);
	}

	async getWordPressModuleDetails() {
		return {
			staticAssetsDirectory: `wp-${wpVersion.replace('_', '.')}`,
			defaultTheme: wpLoaderModule?.defaultThemeName,
		};
	}
}

type PlaygroundStartupOptions = {
	wpVersion?: string;
	phpVersion?: string;
};
const startupOptions = parseWorkerStartupOptions<PlaygroundStartupOptions>();
// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
// parameters names passed to the worker via a query string.
const wpVersion = (startupOptions.wpVersion || '6_2').replace('_', '.');
const phpVersion = (startupOptions.phpVersion || '8_0').replace('_', '.');

/** @inheritDoc PlaygroundWorkerClientClass */
export interface PlaygroundWorkerClient
	extends PublicAPI<PlaygroundWorkerClientClass> {}

const [setApiReady]: [() => void, PlaygroundWorkerClient] = exposeAPI(
	new PlaygroundWorkerClientClass(php, monitor, scope, wpVersion, phpVersion)
);

// Load PHP and WordPress modules:
const [phpLoaderModule, wpLoaderModule] = await Promise.all([
	getPHPLoaderModule(phpVersion),
	getWordPressModule(wpVersion),
]);
monitor.setModules([phpLoaderModule, wpLoaderModule]);
php.initializeRuntime(
	await loadPHPRuntime(phpLoaderModule, monitor.getEmscriptenArgs(), [
		wpLoaderModule,
	])
);
patchWordPress(php, scopedSiteUrl);

setApiReady();

export function getWordPressModule(version: string) {
	switch (version) {
		case '5.9':
			/** @ts-ignore */
			return import('../wordpress/wp-5.9.js');
		case '6.0':
			/** @ts-ignore */
			return import('../wordpress/wp-6.0.js');
		case '6.1':
			/** @ts-ignore */
			return import('../wordpress/wp-6.1.js');
		case '6.2':
			/** @ts-ignore */
			return import('../wordpress/wp-6.2.js');
		case 'nightly':
			/** @ts-ignore */
			return import('../wordpress/wp-nightly.js');
	}
	throw new Error(`Unsupported WordPress module: ${version}`);
}
