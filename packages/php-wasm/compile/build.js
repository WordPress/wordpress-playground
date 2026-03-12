import path from 'path';
import util from 'util';
import fs from 'fs';
const rmAsync = util.promisify(fs.rm);
import { spawn } from 'child_process';
import { phpVersions, lastRefreshed } from '../supported-php-versions.mjs';

// Refresh PHP versions if they need updating (if last refreshed more than 24 hours ago)
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const lastRefreshedDate = new Date(lastRefreshed);

if (lastRefreshedDate < twentyFourHoursAgo) {
	console.log(
		'📅 PHP versions data is older than 24 hours, checking for updates...'
	);
	try {
		const { updatePHPVersions } = await import('./update-php-versions.mjs');
		await updatePHPVersions();

		// Reload the supported-php-versions.mjs module to get the updated versions
		const { phpVersions: updatedPhpVersions } = await import(
			'../supported-php-versions.mjs?' + Date.now()
		);
		// Replace the original phpVersions with the updated ones
		phpVersions.length = 0;
		phpVersions.push(...updatedPhpVersions);
	} catch (error) {
		console.warn('⚠️  Failed to update PHP versions:', error.message);
		process.exit(1);
	}
}

// yargs parse
import yargs from 'yargs';
const argParser = yargs(process.argv.slice(2))
	.usage('Usage: $0 [options]')
	.options({
		PLATFORM: {
			type: 'string',
			choices: ['web', 'node'],
			default: 'web',
			description: 'The platform to build for',
		},
		JSPI: {
			type: 'boolean',
			default: false,
			description: 'Build with JSPI support',
		},
		DEBUG: {
			type: 'boolean',
			default: false,
			description: 'Build with debug symbols',
		},
		WITH_FILEINFO: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with fileinfo support',
		},
		WITH_LIBXML: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with libxml support',
		},
		WITH_SOAP: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with SOAP support',
		},
		WITH_LIBZIP: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with libzip support',
		},
		WITH_EXIF: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with exif support',
		},
		WITH_GD: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with libpng support',
		},
		WITH_ICONV: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with iconv support',
		},
		WITH_MBSTRING: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with mbstring support',
		},
		WITH_MBREGEX: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with mbregex support',
		},
		WITH_CLI_SAPI: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with CLI SAPI',
		},
		WITH_OPENSSL: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with OpenSSL support',
		},
		WITH_NODEFS: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with Node.js FS support',
		},
		WITH_CURL: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with cURL support',
		},
		WITH_SQLITE: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with SQLite support',
		},
		WITH_SOURCEMAPS: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with source maps',
		},
		WITH_DEBUG: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with DWARF debug information.',
		},
		WITH_ICONV: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with source maps',
		},
		WITH_MYSQL: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with MySQL support',
		},
		WITH_WS_NETWORKING_PROXY: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with WebSocket networking proxy support',
		},
		WITH_IMAGICK: {
			type: 'string',
			choices: ['yes', 'no'],
			description: 'Build with imagick support',
		},
		PHP_VERSION: {
			type: 'string',
			description: 'The PHP version to build',
			required: true,
		},
		['output-dir']: {
			type: 'string',
			description:
				'The output directory. If not provided, it will be computed from the PHP version and platform.',
		},
		WITH_OPENSSL_VERSION: {
			type: 'string',
			choices: ['1.1.0h', '1.1.1'],
			description: 'OpenSSL version to use',
			default: '1.1.0h',
		},
		WITH_OPCACHE: {
			type: 'string',
			description: 'Build with OPCache support',
		},
		STACK_SIZE: {
			type: 'string',
			description: 'The emscripten stack size to use for the build',
			default: '1MB',
		},
	});

const args = argParser.argv;

const platformDefaults = {
	all: {
		PHP_VERSION: '8.0.24',
		WITH_CLI_SAPI: 'yes',
		WITH_LIBZIP: 'yes',
		WITH_SQLITE: 'yes',
		WITH_JSPI: 'no',
		WITH_CURL: 'yes',
		WITH_FILEINFO: 'yes',
		WITH_ICONV: 'yes',
		WITH_LIBXML: 'yes',
		WITH_SOAP: 'yes',
		WITH_EXIF: 'yes',
		WITH_GD: 'yes',
		WITH_MBSTRING: 'yes',
		WITH_MBREGEX: 'yes',
		WITH_OPENSSL: 'yes',
		WITH_WS_NETWORKING_PROXY: 'yes',
		WITH_OPCACHE: 'yes',
		WITH_IMAGICK: 'no',
		STACK_SIZE: '1MB',
	},
	web: {},
	node: {
		WITH_NODEFS: 'yes',
		WITH_MYSQL: 'yes',
		WITH_IMAGICK: 'yes',
	},
};
const platform = args.PLATFORM;

/* eslint-disable prettier/prettier */
const getArg = (name) => {
	let value =
		name in args
			? args[name]
			: name in platformDefaults[platform]
				? platformDefaults[platform][name]
				: name in platformDefaults.all
					? platformDefaults.all[name]
					: 'no';
	if (name === 'PHP_VERSION') {
		value = fullyQualifiedPHPVersion(value);
	}
	return `${name}=${value}`;
};

const requestedVersion = getArg('PHP_VERSION');
if (!requestedVersion || requestedVersion === 'undefined') {
	process.stdout.write(`PHP version ${requestedVersion} is not supported\n`);
	process.stdout.write(await argParser.getHelp());
	process.exit(1);
}

const sourceDir = path.dirname(new URL(import.meta.url).pathname);

// Extract major.minor from the PHP version (e.g., "8.4.16" -> "8-4")
const phpVersion = args.PHP_VERSION || '8.3';
const [phpMajor, phpMinor] = phpVersion.split('.');
// Check both --JSPI (boolean) and --WITH_JSPI=yes (string from legacy format)
const isJspi = args.JSPI || args.WITH_JSPI === 'yes';
const jspiOrAsyncify = isJspi ? 'jspi' : 'asyncify';

// Compute output directory if not provided
function computeOutputDir() {
	if (args.outputDir) {
		return path.resolve(process.cwd(), args.outputDir);
	}
	const versionDir = `${phpMajor}-${phpMinor}`;
	const platformDir = platform === 'node' ? 'node-builds' : 'web-builds';
	return path.resolve(
		process.cwd(),
		`packages/php-wasm/${platformDir}/${versionDir}/${jspiOrAsyncify}`
	);
}

const outputDir = computeOutputDir();

// Unique Docker image tag per build to allow parallel builds
const dockerTag = `php-wasm-${phpMajor}-${phpMinor}-${platform}-${jspiOrAsyncify}`;

// Clean up outdated minor versions in the output directory to avoid shipping
// multiple binaries for the same major.minor PHP version.
async function cleanupOldMinorVersions() {
	if (!fs.existsSync(outputDir)) {
		return;
	}
	const versionPrefix = `${phpMajor}_${phpMinor}`;

	const entries = fs.readdirSync(outputDir);
	for (const entry of entries) {
		// Match files and directories like "8_4_15", "php_8_4.js", etc.
		// that belong to the same major.minor version
		if (
			entry.startsWith(versionPrefix) ||
			entry.startsWith(`php_${phpMajor}_${phpMinor}`)
		) {
			const fullPath = path.join(outputDir, entry);
			console.log(`Removing outdated: ${fullPath}`);
			await rmAsync(fullPath, { recursive: true, force: true });
		}
	}
}

await cleanupOldMinorVersions();

// Build the base image only if it doesn't already exist, to avoid
// conflicts when multiple builds run in parallel.
const baseImageExists = await asyncSpawn(
	'docker',
	['image', 'inspect', 'playground-php-wasm:base'],
	{ cwd: sourceDir, stdio: 'ignore' }
).then(
	() => true,
	() => false
);

if (!baseImageExists) {
	await asyncSpawn('make', ['base-image'], {
		cwd: sourceDir,
		stdio: 'inherit',
	});
}

const phpVersionForDockerfile = getArg('PHP_VERSION').replace('PHP_VERSION=', '');
const dockerfile = phpVersionForDockerfile.startsWith('5.2')
	? 'php/Dockerfile-5-2'
	: 'php/Dockerfile';

await asyncSpawn(
	'docker',
	[
		'build',
		'-f',
		dockerfile,
		'..',
		`--tag=${dockerTag}`,
		'--progress=plain',
		'--build-arg',
		getArg('PHP_VERSION'),
		'--build-arg',
		`OPENSSL_VERSION=${args.WITH_OPENSSL_VERSION || '1.1.0h'}`,
		'--build-arg',
		getArg('WITH_FILEINFO'),
		'--build-arg',
		getArg('WITH_LIBXML'),
		'--build-arg',
		getArg('WITH_SOAP'),
		'--build-arg',
		getArg('WITH_LIBZIP'),
		'--build-arg',
		getArg('WITH_EXIF'),
		'--build-arg',
		getArg('WITH_GD'),
		'--build-arg',
		getArg('WITH_MBSTRING'),
		'--build-arg',
		getArg('WITH_MBREGEX'),
		'--build-arg',
		getArg('WITH_CLI_SAPI'),
		'--build-arg',
		getArg('WITH_OPENSSL'),
		'--build-arg',
		getArg('WITH_NODEFS'),
		'--build-arg',
		getArg('WITH_CURL'),
		'--build-arg',
		getArg('WITH_SQLITE'),
		'--build-arg',
		getArg('WITH_SOURCEMAPS'),
		'--build-arg',
		// Relay output directory so we can create source maps and DWARF debug
		// info containing correct paths.
		`OUTPUT_DIR_ON_HOST=${outputDir}`,
		'--build-arg',
		getArg('WITH_DEBUG'),
		// This directory path allows us to set what the DWARF file references
		// are relative to so step debugging source files works correctly.
		'--build-arg',
		`DEBUG_DWARF_COMPILATION_DIR=${path.resolve(
			import.meta.dirname,
			'..'
		)}`,
		'--build-arg',
		getArg('WITH_ICONV'),
		'--build-arg',
		getArg('WITH_MYSQL'),
		'--build-arg',
		getArg('WITH_WS_NETWORKING_PROXY'),
		'--build-arg',
		getArg('WITH_IMAGICK'),
		'--build-arg',
		`EMSCRIPTEN_ENVIRONMENT=${platform === 'node' ? 'node' : 'web'}`,
		'--build-arg',
		getArg('WITH_JSPI'),
		'--build-arg',
		getArg('WITH_OPCACHE'),
		'--build-arg',
		getArg('STACK_SIZE'),
		'--build-arg',
		`PHP_VERSION_DIR=${phpMajor}-${phpMinor}`,
		'--build-arg',
		`ASYNCIFY_OR_JSPI_DIR=${jspiOrAsyncify}`,
	],
	{ cwd: sourceDir, stdio: 'inherit' }
);
/* eslint-enable prettier/prettier */

// Extract the PHP WASM module
await asyncSpawn(
	'docker',
	[
		'run',
		'--name',
		`${dockerTag}-tmp`,
		'--rm',
		'-v',
		`${outputDir}:/output`,
		dockerTag,
		// Use sh -c because wildcards are a shell feature and
		// they don't work without running cp through shell.
		'sh',
		'-c',
		`cp -rf /root/output/* /output && mkdir -p /output/terminfo/x ${
			getArg('WITH_CLI_SAPI') === 'yes'
				? '&& cp /root/lib/share/terminfo/x/xterm /output/terminfo/x'
				: ''
		}`,
	],
	{ cwd: sourceDir, stdio: 'inherit' }
);

// Write .recompile-request.json so CI knows what to compile
const repoRoot = path.resolve(sourceDir, '../../..');
const triggerFilePath = path.join(
	repoRoot,
	'packages/php-wasm/.recompile-request.json'
);
const lockFilePath = triggerFilePath + '.lock';
const phpVersionShort = `${phpMajor}.${phpMinor}`;

// Acquire an exclusive lock by atomically creating a lock file.
// Retries every 100ms for up to 30 seconds.
async function acquireLock() {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		try {
			fs.writeFileSync(lockFilePath, String(process.pid), { flag: 'wx' });
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw new Error('Timed out waiting for lock on .recompile-request.json');
}

function releaseLock() {
	try {
		fs.unlinkSync(lockFilePath);
	} catch {
		// Ignore — lock file may already be gone
	}
}

await acquireLock();
try {
	let triggerData = { compilations: [] };

	if (fs.existsSync(triggerFilePath)) {
		try {
			triggerData = JSON.parse(fs.readFileSync(triggerFilePath, 'utf8'));
		} catch {
			// Ignore parse errors — start fresh
		}
	}

	// requestedAt is stored per-entry so each compilation has its own timestamp.
	// This allows download-wasm.mjs to compute a deterministic npm version for
	// each package independently, even when multiple recompiles accumulate.
	const now = new Date().toISOString();
	const existingIndex = triggerData.compilations.findIndex(
		(c) => c.platform === platform && c.phpVersion === phpVersionShort
	);

	if (existingIndex === -1) {
		triggerData.compilations.push({
			platform,
			phpVersion: phpVersionShort,
			requestedAt: now,
		});
	} else {
		triggerData.compilations[existingIndex].requestedAt = now;
	}

	// Remove legacy top-level requestedAt if present.
	delete triggerData.requestedAt;
	fs.writeFileSync(
		triggerFilePath,
		JSON.stringify(triggerData, null, '\t') + '\n'
	);
	console.log(
		`Updated packages/php-wasm/.recompile-request.json for ${platform} PHP ${phpVersionShort}`
	);
} finally {
	releaseLock();
}

function asyncSpawn(...args) {
	console.log('Running', args[0], args[1].join(' '), '...');

	return new Promise((resolve, reject) => {
		const child = spawn(...args);

		child.on('close', (code) => {
			if (code === 0) resolve(code);
			else reject(new Error(`Process exited with code ${code}`));
		});
	});
}

function fullyQualifiedPHPVersion(requestedVersion) {
	for (const { version, lastRelease } of phpVersions) {
		if (requestedVersion === version) {
			return lastRelease;
		}
	}

	return requestedVersion;
}
