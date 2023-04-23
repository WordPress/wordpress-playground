import {
	PHP,
	WebPHP,
	exposeAPI,
	PublicAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './is-uploaded-file-path';
import patchWordPress from './wordpress-patch';
import {
	getWordPressModule,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersion,
	SupportedWordPressVersionsList,
} from './get-wordpress-module';
import {
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';

const startupOptions = parseWorkerStartupOptions<{
	wpVersion?: string;
	phpVersion?: string;
}>();

// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
// parameters names passed to the worker via a query string.
const requestedWPVersion = (startupOptions.wpVersion || '').replace('_', '.');
const wpVersion: SupportedWordPressVersion =
	SupportedWordPressVersionsList.includes(requestedWPVersion)
		? (requestedWPVersion as SupportedWordPressVersion)
		: LatestSupportedWordPressVersion;

const requestedPhpVersion = (startupOptions.phpVersion || '').replace('_', '.');
const phpVersion: SupportedPHPVersion = SupportedPHPVersionsList.includes(
	requestedPhpVersion
)
	? (requestedPhpVersion as SupportedPHPVersion)
	: '8.0';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const monitor = new EmscriptenDownloadMonitor();
const { php, phpReady, dataModules } = PHP.loadSync(phpVersion, {
	downloadMonitor: monitor,
	requestHandler: {
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		isStaticFilePath: isUploadedFilePath,
	},
	dataModules: [getWordPressModule(wpVersion)],
});

/** @inheritDoc PHPClient */
export class WebWorkerPHP extends WebPHP {
	scope: string;
	wordPressVersion: string;
	phpVersion: string;

	constructor(
		php: PHP,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string,
		phpVersion: string
	) {
		super(php, monitor);
		this.scope = scope;
		this.wordPressVersion = wordPressVersion;
		this.phpVersion = phpVersion;
	}

	async getWordPressModuleDetails() {
		const version = await this.wordPressVersion;
		return {
			staticAssetsDirectory: `wp-${version.replace('_', '.')}`,
			defaultTheme: wpLoaderModule?.defaultThemeName,
		};
	}
}

const [setApiReady] = exposeAPI(
	new WebWorkerPHP(php, monitor, scope, wpVersion, phpVersion)
);

await phpReady;
const wpLoaderModule = (await dataModules)[0] as any;
patchWordPress(php, scopedSiteUrl);
setApiReady();
