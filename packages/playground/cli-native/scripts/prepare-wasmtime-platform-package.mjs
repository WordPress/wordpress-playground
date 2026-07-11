import {
	access,
	cp,
	mkdir,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliHostDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const npmPackageTemplatesDirectory = join(
	cliHostDirectory,
	'wasmtime-npm-packages'
);

/**
 * Converts the directory emitted by `package-native-cli` into an npm package.
 *
 * Rust owns the binary and its asset layout. This helper only moves that
 * verified layout into the npm staging directory and writes the target-specific
 * package metadata.
 */
export async function prepareWasmtimePlatformPackage({
	label,
	sourceDirectory,
	destinationDirectory,
	version,
}) {
	if (!label || !sourceDirectory || !destinationDirectory || !version) {
		throw new Error(
			'prepareWasmtimePlatformPackage requires label, sourceDirectory, destinationDirectory, and version.'
		);
	}

	const source = resolve(sourceDirectory);
	const destination = resolve(destinationDirectory);
	if (source === destination) {
		throw new Error(
			'The Wasmtime package source and destination must differ.'
		);
	}
	const templatePath = join(
		npmPackageTemplatesDirectory,
		label,
		'package.json'
	);
	const template = JSON.parse(await readFile(templatePath, 'utf8'));
	const binaryName = label.startsWith('windows-')
		? 'wp-playground-native.exe'
		: 'wp-playground-native';

	await Promise.all([
		access(join(source, 'package-manifest.json')),
		access(join(source, 'bin', binaryName)),
		access(
			join(
				source,
				'share',
				'wp-playground-native',
				'packages',
				'playground',
				'cli-native',
				'assets',
				'php-assets.json'
			)
		),
	]);

	await rm(destination, { recursive: true, force: true });
	await mkdir(dirname(destination), { recursive: true });
	try {
		await rename(source, destination);
	} catch (error) {
		if (!isCrossDeviceRename(error)) {
			throw error;
		}
		await cp(source, destination, { recursive: true });
		await rm(source, { recursive: true, force: true });
	}

	await writeFile(
		join(destination, 'package.json'),
		`${JSON.stringify({ ...template, version }, null, 2)}\n`
	);
	return destination;
}

async function main() {
	if (process.argv.slice(2).includes('--help')) {
		process.stdout.write(`${usage()}\n`);
		return;
	}
	const options = parseArguments(process.argv.slice(2));
	const destination = await prepareWasmtimePlatformPackage(options);
	process.stdout.write(`${destination}\n`);
}

function parseArguments(args) {
	const options = {};
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index];
		const value = args[index + 1];
		if (
			!value ||
			!['--label', '--source', '--destination', '--version'].includes(
				name
			)
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
			case '--version':
				options.version = value;
				break;
		}
	}
	return options;
}

function usage() {
	return 'Usage: prepare-wasmtime-platform-package.mjs --label <label> --source <wasmtime-package> --destination <npm-package> --version <version>';
}

function isCrossDeviceRename(error) {
	return error instanceof Error && 'code' in error && error.code === 'EXDEV';
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
