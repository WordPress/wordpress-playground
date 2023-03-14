/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: Window | WorkerGlobalScope;
declare const window: Window | undefined;

import {
	loadPHPRuntime,
	PHP,
	PHPServer,
	PHPBrowser,
	PHPPublicAPI,
	setURLScope,
	exposeAPI,
	getPHPLoaderModule,
	parseWorkerStartupOptions,
	EmscriptenDownloadMonitor,
} from '@wordpress/php-wasm';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './is-uploaded-file-path';
import patchWordPress from './wp-patch';

const php = new PHP();

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const server = new PHPServer(php, {
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	isStaticFilePath: isUploadedFilePath,
});

const browser = new PHPBrowser(server);
const monitor = new EmscriptenDownloadMonitor();

class InternalWorkerAPIClass extends PHPPublicAPI {
	scope: string;
	wordPressVersion: string;
	phpVersion: string;

	constructor(
		browser: PHPBrowser,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string,
		phpVersion: string
	) {
		super(browser, monitor);
		this.scope = scope;
		this.wordPressVersion = wordPressVersion;
		this.phpVersion = phpVersion;
	}

	async getWordPressModuleDetails() {
		return {
			staticAssetsDirectory: `wp-${wpVersion.replace('_', '.')}`,
			defaultTheme: wpLoaderModule?.defaultThemeName,
		};
	}
}

const startupOptions = parseWorkerStartupOptions();
// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
// parameters names passed to the worker via a query string.
const wpVersion = (startupOptions.wpVersion || '6_1').replace('_', '.');
const phpVersion = (startupOptions.phpVersion || '8_0').replace('_', '.');

const [setApiReady, publicApi] = exposeAPI(
	new InternalWorkerAPIClass(browser, monitor, scope, wpVersion, phpVersion)
);

export type InternalWorkerAPI = typeof publicApi;

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

export function getWordPressModule(version) {
	switch (version) {
		case '5.9':
			return import('./wordpress/wp-5.9.js');
		case '6.0':
			return import('./wordpress/wp-6.0.js');
		case '6.1':
			return import('./wordpress/wp-6.1.js');
		case 'nightly':
			return import('./wordpress/wp-nightly.js');
	}
	throw new Error(`Unsupported WordPress module: ${version}`);
}
