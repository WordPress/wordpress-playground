/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import { writeFileSync, existsSync } from 'fs';
import { rootCertificates } from 'tls';

import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';

import { NodePHP } from '@php-wasm/node';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

// Write the ca-bundle.crt file to disk so that PHP can find it.
const caBundlePath = new URL('ca-bundle.crt', (import.meta || {}).url).pathname;
if (!existsSync(caBundlePath)) {
	writeFileSync(caBundlePath, rootCertificates.join('\n'));
}
args.unshift('-d', `openssl.cafile=${caBundlePath}`);

// @ts-ignore
const defaultPhpIniPath = await import('./php.ini');
const phpVersion = (process.env['PHP'] ||
	LatestSupportedPHPVersion) as SupportedPHPVersion;
if (!SupportedPHPVersionsList.includes(phpVersion)) {
	throw new Error(`Unsupported PHP version ${phpVersion}`);
}

const php = await NodePHP.load(phpVersion, {
	emscriptenOptions: {
		ENV: {
			...process.env,
			TERM: 'xterm',
		},
	},
});
php.useHostFilesystem();

const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
if (!hasMinusCOption) {
	args.unshift('-c', defaultPhpIniPath);
}

php.cli(['php', ...args]).catch((result) => {
	if (result.name === 'ExitStatus') {
		process.exit(result.status === undefined ? 1 : result.status);
	}
	throw result;
});
