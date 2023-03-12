import {
	startPHP,
	PHPServer,
	PHPBrowser,
	exposeComlinkAPI,
	getPHPLoaderModule,
	EmscriptenDownloadMonitor
} from '@wordpress/php-wasm';
import {
	startupOptions,
	materializedProxy,
	setURLScope,
} from '@wordpress/php-wasm/worker-library';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './worker-utils';
import * as macros from './wp-macros';
import patchWordPress from './wp-patch';

const monitor = new EmscriptenDownloadMonitor();
const api = exposeComlinkAPI({
	onDownloadProgress: (cb) => monitor.addEventListener('progress', cb),
});

// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
// parameters names passed to the worker via a query string.
const wpVersion = (startupOptions.wpVersion || '6_1').replace('_', '.');
const phpVersion = (startupOptions.phpVersion || '8_0').replace('_', '.');
const [phpLoaderModule, wpLoaderModule] = await Promise.all([
	getPHPLoaderModule(phpVersion),
	getWordPressModule(wpVersion),
]);
monitor.setModules([phpLoaderModule, wpLoaderModule]);
const php = await startPHP(
	phpLoaderModule,
	monitor.getEmscriptenArgs(),
	[wpLoaderModule]
)

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const server = new PHPServer(php, {
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	isStaticFilePath: isUploadedFilePath,
});

const browser = new PHPBrowser(server);

const wp = {};
for (const macro in macros) {
	wp[macro] = (...args) => macros[macro](api.exposed, ...args);
}

api.extend({
	scope,
	getWordPressModuleDetails: () => ({
		staticAssetsDirectory: `wp-${wpVersion.replace('_', '.')}`,
		defaultTheme: wpLoaderModule?.defaultThemeName,
	}),
	wp,
	php: materializedProxy(php),
	server: materializedProxy(server),
	browser: materializedProxy(browser),
});

patchWordPress(php, scopedSiteUrl);
api.setReady();

function getWordPressModule(version) {
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
