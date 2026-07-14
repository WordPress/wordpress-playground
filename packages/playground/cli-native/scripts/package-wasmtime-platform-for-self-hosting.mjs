import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { basename, join, resolve, win32 as windowsPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { prepareWasmtimePlatformPackage } from './prepare-wasmtime-platform-package.mjs';

const execFileAsync = promisify(execFile);

/**
 * Stages a platform package, packs it with npm, and gives the archive the name
 * expected by the repository's self-hosted package resolver.
 */
export async function packageWasmtimePlatformForSelfHosting({
	label,
	sourceDirectory,
	destinationDirectory,
	archiveDirectory,
	version,
	npmInvocation = getNpmInvocation(),
}) {
	if (!archiveDirectory) {
		throw new Error(
			'packageWasmtimePlatformForSelfHosting requires archiveDirectory.'
		);
	}

	const destination = await prepareWasmtimePlatformPackage({
		label,
		sourceDirectory,
		destinationDirectory,
		version,
	});
	const archives = resolve(archiveDirectory);
	await mkdir(archives, { recursive: true });

	const { stdout } = await execFileAsync(
		npmInvocation.executable,
		[
			...npmInvocation.argumentPrefix,
			'pack',
			'--silent',
			'--pack-destination',
			archives,
			destination,
		],
		{ maxBuffer: 1024 * 1024 }
	);
	const npmArchiveName = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
	if (!npmArchiveName?.endsWith('.tgz')) {
		throw new Error(
			`npm pack did not report a .tgz archive: ${stdout.trim()}`
		);
	}

	const packageJson = JSON.parse(
		await readFile(join(destination, 'package.json'), 'utf8')
	);
	const selfHostedArchiveName = `${packageJson.name.replaceAll(
		'/',
		'-'
	)}-${version}.tar.gz`;
	const npmArchive = join(archives, basename(npmArchiveName));
	const selfHostedArchive = join(archives, selfHostedArchiveName);
	await access(npmArchive);
	await rm(selfHostedArchive, { force: true });
	await rename(npmArchive, selfHostedArchive);
	return selfHostedArchive;
}

export function getNpmInvocation({
	platform = process.platform,
	nodeExecutable = process.execPath,
} = {}) {
	if (platform === 'win32') {
		return {
			executable: nodeExecutable,
			argumentPrefix: [
				windowsPath.join(
					windowsPath.dirname(nodeExecutable),
					'node_modules',
					'npm',
					'bin',
					'npm-cli.js'
				),
			],
		};
	}

	return {
		executable: 'npm',
		argumentPrefix: [],
	};
}

async function main() {
	if (process.argv.slice(2).includes('--help')) {
		process.stdout.write(`${usage()}\n`);
		return;
	}
	const archive = await packageWasmtimePlatformForSelfHosting(
		parseArguments(process.argv.slice(2))
	);
	process.stdout.write(`${archive}\n`);
}

function parseArguments(args) {
	const options = {};
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index];
		const value = args[index + 1];
		if (
			!value ||
			![
				'--label',
				'--source',
				'--destination',
				'--archive-directory',
				'--version',
			].includes(name)
		) {
			throw new Error(usage());
		}
		switch (name) {
			case '--label':
				options.label = value;
				break;
			case '--source':
				options.sourceDirectory = value;
				break;
			case '--destination':
				options.destinationDirectory = value;
				break;
			case '--archive-directory':
				options.archiveDirectory = value;
				break;
			case '--version':
				options.version = value;
				break;
		}
	}
	return options;
}

function usage() {
	return 'Usage: package-wasmtime-platform-for-self-hosting.mjs --label <label> --source <wasmtime-package> --destination <npm-package> --archive-directory <directory> --version <version>';
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main().catch((error) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : error}\n`
		);
		process.exitCode = 1;
	});
}
