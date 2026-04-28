import {
	type EmscriptenOptions,
	type PHPRuntime,
	type SupportedPHPVersion,
	installPHPExtensionFilesSync,
	PHP_EXTENSIONS_DIR,
} from '@php-wasm/universal';
import fs from 'fs';

export interface WpMysqlParserOptions {
	/**
	 * Absolute path on the host filesystem to a `wp_mysql_parser.so` side
	 * module compiled for the target PHP version and async mode.
	 *
	 * The extension itself lives at
	 * https://github.com/WordPress/sqlite-database-integration/pull/381
	 * and is not yet packaged with Playground; users build it themselves
	 * (or fetch it from a release artifact) and pass the path via
	 * `--wp-mysql-parser-so=<path>` on the CLI.
	 */
	soPath: string;
}

/*
 * The PR #381 build hasn't been validated against earlier PHP versions
 * yet, so this run only wires it up for PHP 8.4. Widening to other
 * versions is a one-line change once we have artifacts to test against.
 */
const SUPPORTED_VERSIONS: ReadonlyArray<SupportedPHPVersion> = ['8.4'];

export async function withWpMysqlParser(
	version: SupportedPHPVersion,
	options: EmscriptenOptions,
	wpMysqlParserOptions: WpMysqlParserOptions
): Promise<EmscriptenOptions> {
	if (!SUPPORTED_VERSIONS.includes(version)) {
		throw new Error(
			`withWpMysqlParser: only PHP ${SUPPORTED_VERSIONS.join(
				', '
			)} are supported in this build; got ${version}.`
		);
	}

	const soBytes = new Uint8Array(
		fs.readFileSync(wpMysqlParserOptions.soPath)
	);

	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: PHP_EXTENSIONS_DIR,
		},
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			if (options.onRuntimeInitialized) {
				options.onRuntimeInitialized(phpRuntime);
			}

			installPHPExtensionFilesSync(phpRuntime.FS, {
				name: 'wp_mysql_parser',
				soBytes,
			});
		},
	};
}
