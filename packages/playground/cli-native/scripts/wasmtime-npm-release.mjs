import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { getNpmInvocation } from './package-wasmtime-platform-for-self-hosting.mjs';

const execFileAsync = promisify(execFile);
const MAXIMUM_NPM_PACKAGE_BYTES = 95 * 1024 * 1024;
const STABLE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const DIST_TAG_PATTERN = /^[a-z][a-z0-9._-]*$/i;
const SEMVER_RANGE_LIKE_DIST_TAG_PATTERN = /^(?:v\d|x(?:\.(?:x|\d+)){0,2}$)/i;

export const wasmtimeNpmPlatformLabels = [
	'linux-x64',
	'linux-arm64',
	'macos-x64',
	'macos-arm64',
	'windows-x64',
	'windows-arm64',
];

export function nextFixedVersion(currentVersion, versionBump) {
	const match = STABLE_SEMVER_PATTERN.exec(currentVersion);
	if (!match) {
		throw new Error(
			`The fixed Lerna version must be a stable semantic version, got ${JSON.stringify(
				currentVersion
			)}.`
		);
	}
	if (!['patch', 'minor', 'major'].includes(versionBump)) {
		throw new Error(
			`Version bump must be patch, minor, or major, got ${JSON.stringify(
				versionBump
			)}.`
		);
	}

	let major = Number(match[1]);
	let minor = Number(match[2]);
	let patch = Number(match[3]);
	if (versionBump === 'major') {
		major += 1;
		minor = 0;
		patch = 0;
	} else if (versionBump === 'minor') {
		minor += 1;
		patch = 0;
	} else {
		patch += 1;
	}
	return `${major}.${minor}.${patch}`;
}

export function validateDistTag(distTag) {
	if (
		!DIST_TAG_PATTERN.test(distTag) ||
		STABLE_SEMVER_PATTERN.test(distTag) ||
		SEMVER_RANGE_LIKE_DIST_TAG_PATTERN.test(distTag)
	) {
		throw new Error(`Invalid npm dist tag ${JSON.stringify(distTag)}.`);
	}
	return distTag;
}

export function wasmtimeNpmPackageSpec(label, version) {
	if (!wasmtimeNpmPlatformLabels.includes(label)) {
		throw new Error(`Unsupported Wasmtime npm platform label: ${label}`);
	}
	if (!STABLE_SEMVER_PATTERN.test(version)) {
		throw new Error(`Invalid Wasmtime npm package version: ${version}`);
	}

	const name = `@wp-playground/cli-wasmtime-${label}`;
	const binary = label.startsWith('windows-')
		? 'bin/wp-playground-native.exe'
		: 'bin/wp-playground-native';
	return {
		label,
		name,
		version,
		archiveName: `wp-playground-cli-wasmtime-${label}-${version}.tgz`,
		requiredFiles: [
			binary,
			'package.json',
			'package-manifest.json',
			'share/wp-playground-native/packages/playground/cli-native/assets/php-assets.json',
		],
	};
}

export function selfHostedWasmtimePackageUrl(hostingBaseUrl, label, version) {
	const spec = wasmtimeNpmPackageSpec(label, version);
	const url = new URL(hostingBaseUrl);
	url.pathname = posix.join(
		url.pathname,
		`v${version}`,
		`${spec.name.replaceAll('/', '-')}-${version}.tar.gz`
	);
	return url.href;
}

export function validateSelfHostedCliPackage(
	packageJson,
	{ hostingBaseUrl, version }
) {
	for (const label of wasmtimeNpmPlatformLabels) {
		const spec = wasmtimeNpmPackageSpec(label, version);
		const expected = selfHostedWasmtimePackageUrl(
			hostingBaseUrl,
			label,
			version
		);
		if (packageJson.optionalDependencies?.[spec.name] !== expected) {
			throw new Error(`${spec.name} does not resolve to ${expected}.`);
		}
	}
	return packageJson;
}

export async function verifyPublishedWasmtimeNpmPackages({
	version,
	npmInvocation = getNpmInvocation(),
	lookupVersion,
}) {
	const lookup =
		lookupVersion ??
		(async (spec) => {
			try {
				const { stdout } = await runNpm(
					[
						'view',
						`${spec.name}@${spec.version}`,
						'version',
						'--json',
					],
					npmInvocation
				);
				return JSON.parse(stdout);
			} catch (error) {
				throw new Error(
					`${spec.name}@${spec.version} is not available on npm; resume_current_version cannot publish a CLI that references missing native packages.`,
					{ cause: error }
				);
			}
		});

	for (const label of wasmtimeNpmPlatformLabels) {
		const spec = wasmtimeNpmPackageSpec(label, version);
		const publishedVersion = await lookup(spec);
		if (publishedVersion !== version) {
			throw new Error(
				`${spec.name}@${version} returned version ${JSON.stringify(
					publishedVersion
				)}; resume_current_version requires all six native packages.`
			);
		}
	}
	return version;
}

export function validateNpmPublishInspection(inspection, spec) {
	if (!inspection || typeof inspection !== 'object') {
		throw new Error(`npm did not inspect ${spec.archiveName}.`);
	}
	if (
		inspection.name !== spec.name ||
		inspection.version !== spec.version ||
		inspection.id !== `${spec.name}@${spec.version}` ||
		inspection.filename !== spec.archiveName
	) {
		throw new Error(
			`${spec.archiveName} identifies itself as ${JSON.stringify({
				id: inspection.id,
				name: inspection.name,
				version: inspection.version,
				filename: inspection.filename,
			})}.`
		);
	}
	if (
		!Number.isSafeInteger(inspection.size) ||
		inspection.size <= 0 ||
		inspection.size > MAXIMUM_NPM_PACKAGE_BYTES
	) {
		throw new Error(
			`${spec.archiveName} has invalid packed size ${inspection.size}; npm packages must remain below ${MAXIMUM_NPM_PACKAGE_BYTES} bytes.`
		);
	}

	const files = new Set(
		Array.isArray(inspection.files)
			? inspection.files.map((file) => file?.path).filter(Boolean)
			: []
	);
	for (const requiredFile of spec.requiredFiles) {
		if (!files.has(requiredFile)) {
			throw new Error(
				`${spec.archiveName} is missing required file ${requiredFile}.`
			);
		}
	}
	return inspection;
}

export async function publishWasmtimeNpmPackages({
	archiveDirectory,
	version,
	distTag,
	validateOnly = false,
	npmInvocation = getNpmInvocation(),
	npmClient,
	reporter = (message) => process.stdout.write(`${message}\n`),
}) {
	const directory = resolve(archiveDirectory);
	validateDistTag(distTag);
	const client =
		npmClient ?? createNpmReleaseClient({ distTag, npmInvocation });
	const specs = wasmtimeNpmPlatformLabels.map((label) =>
		wasmtimeNpmPackageSpec(label, version)
	);
	const entries = await readdir(directory);
	const archives = entries.filter((entry) => entry.endsWith('.tgz')).sort();
	const expectedArchives = specs.map(({ archiveName }) => archiveName).sort();
	if (JSON.stringify(archives) !== JSON.stringify(expectedArchives)) {
		throw new Error(
			`Expected exactly these Wasmtime npm archives:\n${expectedArchives.join(
				'\n'
			)}\nFound:\n${archives.join('\n') || '(none)'}`
		);
	}

	for (const spec of specs) {
		const archivePath = join(directory, spec.archiveName);
		const inspection = await client.inspect(archivePath, spec);
		validateNpmPublishInspection(inspection, spec);
	}

	if (validateOnly) {
		reporter(
			`Validated ${specs.length} Wasmtime npm packages at ${version}.`
		);
		return;
	}

	for (const spec of specs) {
		const archivePath = join(directory, spec.archiveName);
		if (await client.versionExists(spec, archivePath)) {
			reporter(`${spec.name}@${spec.version} already exists; skipping.`);
			continue;
		}

		await client.publish(archivePath, spec);
		reporter(`${spec.name}@${spec.version} published with tag ${distTag}.`);
	}
}

function createNpmReleaseClient({ distTag, npmInvocation }) {
	return {
		inspect(archivePath) {
			return inspectNpmArchive({
				archivePath,
				distTag,
				npmInvocation,
			});
		},
		versionExists(spec, archivePath) {
			return npmPackageVersionExists({
				name: spec.name,
				version: spec.version,
				archivePath,
				npmInvocation,
			});
		},
		publish(archivePath) {
			return runNpm(
				['publish', archivePath, '--access=public', `--tag=${distTag}`],
				npmInvocation
			);
		},
	};
}

async function inspectNpmArchive({ archivePath, distTag, npmInvocation }) {
	const { stdout } = await runNpm(
		[
			'publish',
			'--dry-run',
			'--json',
			'--access=public',
			`--tag=${distTag}`,
			archivePath,
		],
		npmInvocation
	);
	try {
		return JSON.parse(stdout);
	} catch {
		throw new Error(
			`npm returned invalid inspection JSON for ${basename(
				archivePath
			)}: ${stdout.slice(0, 500)}`
		);
	}
}

async function npmPackageVersionExists({
	name,
	version,
	archivePath,
	npmInvocation,
}) {
	try {
		const { stdout } = await runNpm(
			['view', `${name}@${version}`, 'dist.integrity', '--json'],
			npmInvocation
		);
		const publishedIntegrity = JSON.parse(stdout);
		const localIntegrity = await sha512Integrity(archivePath);
		if (publishedIntegrity !== localIntegrity) {
			throw new Error(
				`${name}@${version} already exists with integrity ${JSON.stringify(
					publishedIntegrity
				)}, but the release archive has integrity ${localIntegrity}. Refusing to skip a different package.`
			);
		}
		return true;
	} catch (error) {
		const output = `${error?.stdout ?? ''}\n${error?.stderr ?? ''}`;
		if (/\bE404\b/.test(output)) {
			return false;
		}
		throw error;
	}
}

export async function sha512Integrity(path) {
	const hash = createHash('sha512');
	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}
	return `sha512-${hash.digest('base64')}`;
}

function runNpm(args, npmInvocation) {
	return execFileAsync(
		npmInvocation.executable,
		[...npmInvocation.argumentPrefix, ...args],
		{ maxBuffer: 32 * 1024 * 1024 }
	);
}

async function main(args) {
	const command = args.shift();
	if (command === 'next-version') {
		const options = parseOptions(args, ['--current', '--bump']);
		process.stdout.write(
			`${nextFixedVersion(options.current, options.bump)}\n`
		);
		return;
	}
	if (command === 'validate-dist-tag') {
		const options = parseOptions(args, ['--dist-tag']);
		process.stdout.write(`${validateDistTag(options.distTag)}\n`);
		return;
	}
	if (command === 'publish') {
		const validateOnlyIndex = args.indexOf('--validate-only');
		const validateOnly = validateOnlyIndex !== -1;
		if (validateOnly) {
			args.splice(validateOnlyIndex, 1);
		}
		const options = parseOptions(args, [
			'--directory',
			'--version',
			'--dist-tag',
		]);
		await publishWasmtimeNpmPackages({
			archiveDirectory: options.directory,
			version: options.version,
			distTag: options.distTag,
			validateOnly,
		});
		return;
	}
	if (command === 'verify-self-hosted-cli') {
		const options = parseOptions(args, ['--hosting-base-url', '--version']);
		const packageJson = JSON.parse(await readStandardInput());
		validateSelfHostedCliPackage(packageJson, {
			hostingBaseUrl: options.hostingBaseUrl,
			version: options.version,
		});
		process.stdout.write(
			`Validated ${wasmtimeNpmPlatformLabels.length} self-hosted Wasmtime package URLs.\n`
		);
		return;
	}
	if (command === 'verify-published') {
		const options = parseOptions(args, ['--version']);
		await verifyPublishedWasmtimeNpmPackages({
			version: options.version,
		});
		process.stdout.write(
			`Verified ${wasmtimeNpmPlatformLabels.length} Wasmtime npm packages at ${options.version}.\n`
		);
		return;
	}
	throw new Error(usage());
}

async function readStandardInput() {
	let input = '';
	process.stdin.setEncoding('utf8');
	for await (const chunk of process.stdin) {
		input += chunk;
	}
	return input;
}

function parseOptions(args, allowedOptions) {
	const options = {};
	for (let index = 0; index < args.length; index += 2) {
		const option = args[index];
		const value = args[index + 1];
		if (!allowedOptions.includes(option) || !value) {
			throw new Error(usage());
		}
		options[optionName(option)] = value;
	}
	if (Object.keys(options).length !== allowedOptions.length) {
		throw new Error(usage());
	}
	return options;
}

function optionName(option) {
	return option
		.slice(2)
		.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function usage() {
	return [
		'Usage:',
		'  wasmtime-npm-release.mjs next-version --current <version> --bump <patch|minor|major>',
		'  wasmtime-npm-release.mjs validate-dist-tag --dist-tag <tag>',
		'  wasmtime-npm-release.mjs publish --directory <archives> --version <version> --dist-tag <tag> [--validate-only]',
		'  wasmtime-npm-release.mjs verify-published --version <version>',
		'  wasmtime-npm-release.mjs verify-self-hosted-cli --hosting-base-url <url> --version <version>',
	].join('\n');
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main(process.argv.slice(2)).catch((error) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : error}\n`
		);
		process.exitCode = 1;
	});
}
