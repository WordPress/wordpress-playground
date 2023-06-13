import {
	WebPHP,
	WebPHPEndpoint,
	exposeAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './is-uploaded-file-path';
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
import { applyWebWordPressPatches } from './web-wordpress-patches';
import {
	OpfsFileExists,
	synchronizePHPWithOPFS,
} from './synchronize-php-with-opfs';

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

const opfs = await new Promise<FileSystem>((resolve, reject) =>
	// @ts-ignore
	webkitRequestFileSystem(
		// @TODO: Maybe do Window.PERSISTENT?
		// @ts-ignore
		TEMPORARY,
		50 * 1024 * 1024, // 50 MB
		resolve,
		reject
	)
);
const loadWordPressFromOPFS = await OpfsFileExists(
	opfs,
	'/wordpress/wp-config.php'
);

// @TODO: figure out how to use scopes when the filesystem is reusable.
//        a SharedWorker could be a good candidate for this.
const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const monitor = new EmscriptenDownloadMonitor();
const { php, phpReady, dataModules } = WebPHP.loadSync(phpVersion, {
	downloadMonitor: monitor,
	requestHandler: {
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		isStaticFilePath: isUploadedFilePath,
	},
	dataModules: loadWordPressFromOPFS ? [] : [getWordPressModule(wpVersion)],
});

/** @inheritDoc PHPClient */
export class PlaygroundWorkerEndpoint extends WebPHPEndpoint {
	/**
	 * A string representing the scope of the Playground instance.
	 */
	scope: string;

	/**
	 * A string representing the version of WordPress being used.
	 */
	wordPressVersion: string;

	/**
	 * A string representing the version of PHP being used.
	 */
	phpVersion: string;

	constructor(
		php: WebPHP,
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

	/**
	 * @returns WordPress module details, including the static assets directory and default theme.
	 */
	async getWordPressModuleDetails() {
		const version = await this.wordPressVersion;
		return {
			staticAssetsDirectory: `wp-${version.replace('_', '.')}`,
			defaultTheme: wpLoaderModule?.defaultThemeName,
		};
	}
}

const [setApiReady] = exposeAPI(
	new PlaygroundWorkerEndpoint(php, monitor, scope, wpVersion, phpVersion)
);

await phpReady;

await synchronizePHPWithOPFS(php, {
	opfs,
	hasFilesInOpfs: loadWordPressFromOPFS,
	memfsPath: '/wordpress',
	opfsPath: '/wordpress',
});

const wpLoaderModule = (await dataModules)[0] as any;
applyWebWordPressPatches(php, scopedSiteUrl);

setApiReady();
