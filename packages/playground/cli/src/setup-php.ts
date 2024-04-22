import fs from 'fs';
import { NodePHP } from '@php-wasm/node';
import {
	BasePHP,
	PHPRequestHandler,
	SupportedPHPVersion,
	__private__dont__use,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import { rootCertificates } from 'tls';
import {
	defineSiteUrl,
	runWpInstallationWizard,
	unzip,
	zipWpContent,
} from '@wp-playground/blueprints';
import {
	CACHE_FOLDER,
	cachedDownload,
	getWordPressVersionUrlAndName,
	readAsFile,
} from './download';
import { dirname } from '@php-wasm/util';
import path from 'path';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';

export async function setupWordPress(
	php: NodePHP,
	wpVersion = 'latest',
	monitor: EmscriptenDownloadMonitor
) {
	const wpDetails = await getWordPressVersionUrlAndName(wpVersion);
	const [wpZip, sqliteZip] = await Promise.all([
		cachedDownload(wpDetails.url, `${wpDetails.version}.zip`, monitor),
		cachedDownload(
			'https://github.com/WordPress/sqlite-database-integration/archive/refs/heads/main.zip',
			'sqlite.zip',
			monitor
		),
	]);
	await prepareWordPress(php, wpZip, sqliteZip);

	const prebuiltWpContentPath = path.join(
		CACHE_FOLDER,
		`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
	);
	if (fs.existsSync(prebuiltWpContentPath)) {
		await unzip(php, {
			zipFile: readAsFile(prebuiltWpContentPath),
			extractToPath: '/wordpress',
		});
		return;
	}

	await installWordPress(php);
	const wpContent = await zipWpContent(php);
	fs.writeFileSync(prebuiltWpContentPath, wpContent);
}

async function prepareWordPress(php: NodePHP, wpZip: File, sqliteZip: File) {
	await unzip(php, {
		zipFile: wpZip,
		extractToPath: '/tmp',
	});
	php.mv('/tmp/wordpress', '/wordpress');

	php.mkdir('/tmp/sqlite-database-integration');
	await unzip(php, {
		zipFile: sqliteZip,
		extractToPath: '/tmp/sqlite-database-integration',
	});

	php.mv(
		'/tmp/sqlite-database-integration/sqlite-database-integration-main',
		'/wordpress/sqlite-database-integration'
	);

	const db = php.readFileAsText(
		'/wordpress/sqlite-database-integration/db.copy'
	);
	const updatedDb = db
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			"__DIR__.'/../sqlite-database-integration/'"
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			"__DIR__.'/../sqlite-database-integration/load.php'"
		);
	php.writeFile('/wordpress/wp-content/db.php', updatedDb);

	// This should be a mu-plugin, but since the user may have
	// provided custom mounts, we avoid writing to the mu-plugins
	// directory.
	php.writeFile(
		'/wordpress/wp-includes/default-filters.php',
		php.readFileAsText('/wordpress/wp-includes/default-filters.php') +
			`
		// Needed because gethostbyname( 'wordpress.org' ) returns
		// a private network IP address for some reason.
		add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
			return array(
				'wordpress.org',
				'api.wordpress.org',
				'downloads.wordpress.org',
			);
		} );

		// Support permalinks without "index.php"
		add_filter( 'got_url_rewrite', '__return_true' );
		`
	);
	php.writeFile(
		'/wordpress/wp-config.php',
		php.readFileAsText('/wordpress/wp-config-sample.php')
	);
}

async function installWordPress(php: NodePHP) {
	// Define a fake URL for the installation wizard.
	await defineSiteUrl(php, {
		siteUrl: 'http://playground.internal',
	});

	// Disable network functions for the installation wizard
	const phpIniPath = (
		await php.run({
			code: '<?php echo php_ini_loaded_file();',
		})
	).text;
	const phpIniDir = dirname(phpIniPath);
	if (!php.fileExists(phpIniDir)) {
		php.mkdir(phpIniDir);
	}
	if (!php.fileExists(phpIniPath)) {
		php.writeFile(phpIniPath, '');
	}
	const originalPhpIni = php.readFileAsText(phpIniPath);
	php.writeFile(
		phpIniPath,
		[
			originalPhpIni,
			'disable_functions = fsockopen\n',
			'allow_url_fopen = 0\n',
		].join('\n')
	);
	await runWpInstallationWizard(php, {
		options: {},
	});

	// Restore the network functions
	php.writeFile(
		phpIniPath,
		[
			originalPhpIni,
			'disable_functions = \n',
			'allow_url_fopen = 1\n',
		].join('\n')
	);
}

export async function createPhp(
	requestHandler: PHPRequestHandler<NodePHP>,
	phpVersion: SupportedPHPVersion,
	isPrimary: boolean
) {
	const createPhpRuntime = async () => await NodePHP.loadRuntime(phpVersion);
	const php = new NodePHP();
	php.requestHandler = requestHandler;
	php.initializeRuntime(await createPhpRuntime());
	php.setPhpIniPath('/tmp/php.ini');
	php.writeFile('/tmp/php.ini', '');
	php.setPhpIniEntry('memory_limit', '256M');

	// Write the ca-bundle.crt file to disk so that PHP can find it.
	php.setPhpIniEntry('openssl.cafile', '/tmp/ca-bundle.crt');
	php.writeFile('/tmp/ca-bundle.crt', rootCertificates.join('\n'));

	if (!isPrimary) {
		proxyFileSystem(
			await requestHandler.getPrimaryPhp(),
			php,
			'/wordpress'
		);
	}

	// php.setSpawnHandler(spawnHandlerFactory(processManager));
	// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
	// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
	rotatePHPRuntime({
		php,
		cwd: '/wordpress',
		recreateRuntime: createPhpRuntime,
		maxRequests: 400,
	});
	return php;
}

/**
 * Share the parent's MEMFS instance with the child process.
 * Only mount the document root and the /tmp directory,
 * the rest of the filesystem (like the devices) should be
 * private to each PHP instance.
 */
export function proxyFileSystem(
	sourceOfTruth: BasePHP,
	replica: BasePHP,
	documentRoot: string
) {
	for (const path of [documentRoot, '/tmp']) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		replica[__private__dont__use].FS.mount(
			replica[__private__dont__use].PROXYFS,
			{
				root: path,
				fs: sourceOfTruth[__private__dont__use].FS,
			},
			path
		);
	}
}
