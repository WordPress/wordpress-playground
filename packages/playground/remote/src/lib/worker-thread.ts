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
	getOpfsDirectory,
	synchronizePHPWithOPFS,
} from './synchronize-php-with-opfs';
import { applyWordPressPatches } from '@wp-playground/blueprints';

const startupOptions = parseWorkerStartupOptions<{
	wpVersion?: string;
	phpVersion?: string;
	persistent?: string;
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

const useOpfs = startupOptions.persistent === 'true';
let opfs: FileSystem | undefined;
let wordPressAvailableInOPFS = false;
if (useOpfs) {
	opfs = await new Promise<FileSystem>((resolve, reject) =>
		// @ts-ignore
		webkitRequestFileSystem(
			// @ts-ignore
			PERSISTENT,
			150 * 1024 * 1024, // 150 MB
			resolve,
			reject
		)
	);
	wordPressAvailableInOPFS = await OpfsFileExists(
		opfs,
		`${DOCROOT}/wp-config.php`
	);
}

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const monitor = new EmscriptenDownloadMonitor();
const wordPressModule = getWordPressModule(wpVersion);
const { php, phpReady } = WebPHP.loadSync(phpVersion, {
	downloadMonitor: monitor,
	requestHandler: {
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		isStaticFilePath: isUploadedFilePath,
	},
	dataModules: wordPressAvailableInOPFS ? [] : [wordPressModule],
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
			defaultTheme: (await wordPressModule)?.defaultThemeName,
		};
	}

	async resetOpfs() {
		if (!opfs) {
			throw new Error('No OPFS available.');
		}
		const entry = await getOpfsDirectory(opfs, DOCROOT, {
			create: true,
		});
		await new Promise((resolve, reject) =>
			entry.removeRecursively(resolve, reject)
		);
	}
}

const [setApiReady] = exposeAPI(
	new PlaygroundWorkerEndpoint(php, monitor, scope, wpVersion, phpVersion)
);

await phpReady;

if (opfs) {
	await synchronizePHPWithOPFS(php, {
		opfs,
		hasFilesInOpfs: wordPressAvailableInOPFS,
		memfsPath: DOCROOT,
		opfsPath: DOCROOT,
	});
}

if (!wordPressAvailableInOPFS) {
	/**
	 * When WordPress is restored from OPFS, these patches are already applied.
	 * Thus, let's not apply them again.
	 */
	await wordPressModule;
	applyWebWordPressPatches(php);
	await applyWordPressPatches(php, {
		wordpressPath: DOCROOT,
		patchSecrets: true,
		disableWpNewBlogNotification: true,
		addPhpInfo: true,
		disableSiteHealth: true,
	});
}

// Always setup the current site URL.
await applyWordPressPatches(php, {
	wordpressPath: DOCROOT,
	siteUrl: scopedSiteUrl,
});

setApiReady();
