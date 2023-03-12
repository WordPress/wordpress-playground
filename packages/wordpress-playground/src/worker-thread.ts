
import * as Comlink from 'comlink';
import {
	PHPServer,
	PHPBrowser,
	getPHPLoaderModule,
} from '@wordpress/php-wasm';
import {
	loadPHP,
	startupOptions,
	addProgressListener,
	materializedProxy,
	setURLScope,
} from '@wordpress/php-wasm/web/worker-thread';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './worker-utils';
import { getWordPressModule } from './wp-modules-urls';
import * as macros from './wp-macros';
import patchWordPress from './wp-patch';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();

// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
// parameters names passed to the worker via a query string.
const wpVersion = (startupOptions.dataModule || '6_1').replace('_', '.');
const phpVersion = (startupOptions.phpVersion || '8_0').replace('_', '.');

let readyResolve;
const ready = new Promise((resolve) => {
	readyResolve = resolve;
});

const playground: any = {
	addProgressListener,
	onReady: () => ready,
};

Comlink.expose(playground);

const [phpLoaderModule, wpLoaderModule] = await Promise.all([
	getPHPLoaderModule(phpVersion),
	getWordPressModule(wpVersion),
]);

const php = await loadPHP(phpLoaderModule, [wpLoaderModule]);
const server = new PHPServer(php, {
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	isStaticFilePath: isUploadedFilePath,
});
const browser = new PHPBrowser(server);

Object.assign(playground, {
	scope,
	addProgressListener,
	getWordPressModuleDetails: () => ({
		staticAssetsDirectory: `wp-${wpVersion.replace('_', '.')}`,
		defaultTheme: wpLoaderModule?.defaultThemeName,
	}),
	onReady: () => ready,
	php: materializedProxy(php),
	server: materializedProxy(server),
	browser: materializedProxy(browser),
	wp: {}
});
for (const macro in macros) {
	playground.wp[macro] = (...args) => macros[macro](playground, ...args);
}

patchWordPress(php, scopedSiteUrl);
readyResolve();
