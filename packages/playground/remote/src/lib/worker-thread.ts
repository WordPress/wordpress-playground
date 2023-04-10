import {
	PHP,
	PHPClient,
	exposeAPI,
	PublicAPI,
	parseWorkerStartupOptions,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
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
		const version = await this.wordPressVersion;
		return {
			staticAssetsDirectory: `wp-${version.replace('_', '.')}`,
			defaultTheme: wpLoaderModule?.defaultThemeName,
		};
	}
}

/** @inheritDoc PlaygroundWorkerClientClass */
export interface PlaygroundWorkerClient
	extends PublicAPI<PlaygroundWorkerClientClass> {}

const [setApiReady]: [() => void, PlaygroundWorkerClient] = exposeAPI(
	new PlaygroundWorkerClientClass(php, monitor, scope, wpVersion, phpVersion)
);

await phpReady;
const wpLoaderModule = (await dataModules)[0] as any;
patchWordPress(php, scopedSiteUrl);
setApiReady();
