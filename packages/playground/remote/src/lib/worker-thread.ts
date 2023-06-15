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
	opfsFileExists,
	copyMemfsToOpfs,
	copyOpfsToMemfs,
} from './opfs/opfs-memfs';
import { applyWordPressPatches } from '@wp-playground/blueprints';
import { journalMemfsToOpfs } from './opfs/journal-memfs-to-opfs';

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

const useOpfs =
	startupOptions.persistent === 'true' &&
	// @ts-ignore
	typeof navigator?.storage?.getDirectory !== 'undefined';
let opfsRoot: FileSystemDirectoryHandle | undefined;
let opfsDir: FileSystemDirectoryHandle | undefined;
let wordPressAvailableInOPFS = false;
if (useOpfs) {
	opfsRoot = await navigator.storage.getDirectory();
	opfsDir = await opfsRoot.getDirectoryHandle('wordpress', { create: true });
	wordPressAvailableInOPFS = await opfsFileExists(opfsDir!, `wp-config.php`);
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
		if (!opfsRoot) {
			throw new Error('No OPFS available.');
		}
		await opfsRoot.removeEntry(opfsDir!.name, { recursive: true });
	}
}

const [setApiReady] = exposeAPI(
	new PlaygroundWorkerEndpoint(php, monitor, scope, wpVersion, phpVersion)
);

await phpReady;

if (!useOpfs || !wordPressAvailableInOPFS) {
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

if (useOpfs) {
	if (wordPressAvailableInOPFS) {
		await copyOpfsToMemfs(php, opfsDir!, DOCROOT);
	} else {
		await copyMemfsToOpfs(php, opfsDir!, DOCROOT);
	}

	journalMemfsToOpfs(php, opfsDir!, DOCROOT);
}

// Always setup the current site URL.
await applyWordPressPatches(php, {
	wordpressPath: DOCROOT,
	siteUrl: scopedSiteUrl,
});

setApiReady();
