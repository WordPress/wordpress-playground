import fs from 'fs';
import https from 'https';
import path from 'path';
import { spawn } from 'child_process';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const phpRef = process.env.PHP_MASTER_REF || 'master';
const outputDir = path.resolve(
	projectRoot,
	process.env.PHP_MASTER_OUTPUT_DIR ||
		'packages/playground/website/public/php-master'
);
const phpVersion =
	process.env.PHP_MASTER_VERSION || (await fetchPHPVersion(phpRef));
const modes = (process.env.PHP_MASTER_MODES || 'jspi,asyncify')
	.split(',')
	.map((mode) => mode.trim())
	.filter(Boolean);
const append = process.env.PHP_MASTER_APPEND === 'yes';
const [major, minor] = phpVersion.split('.');
const loaderFilename = `php_${major}_${minor}.js`;

if (!major || !minor) {
	throw new Error(
		`Could not derive a major.minor PHP version from ${phpVersion}`
	);
}

console.log(`Building PHP master ${phpVersion} from php-src ref ${phpRef}`);
console.log(`Writing assets to ${outputDir}`);

if (!append) {
	fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

for (const mode of modes) {
	if (mode === 'jspi') {
		await buildMode('jspi', ['--WITH_JSPI=yes']);
	} else if (mode === 'asyncify') {
		await buildMode('asyncify', []);
	} else {
		throw new Error(`Unsupported PHP master build mode: ${mode}`);
	}
}

for (const mode of modes) {
	patchBrowserLoader(path.join(outputDir, mode, loaderFilename));
}

writeMasterIndex();
writeManifest();
writeReadme();

async function buildMode(mode, modeArgs) {
	await asyncSpawn(
		process.execPath,
		[
			'packages/php-wasm/compile/build.js',
			'--PLATFORM=web',
			`--PHP_VERSION=${phpVersion}`,
			`--PHP_REF=${phpRef}`,
			`--output-dir=${path.join(outputDir, mode)}`,
			...modeArgs,
		],
		{ cwd: projectRoot, stdio: 'inherit' }
	);
}

function patchBrowserLoader(loaderPath) {
	const contents = fs.readFileSync(loaderPath, 'utf8');
	const patched = contents.replace(
		/^import dependencyFilename from ['"](.+)['"];\s*/m,
		(_, wasmPath) =>
			`const dependencyFilename = new URL('${wasmPath}', import.meta.url).href;\n`
	);
	if (patched === contents) {
		throw new Error(`Could not patch WASM import in ${loaderPath}`);
	}
	fs.writeFileSync(loaderPath, patched);
}

function writeMasterIndex() {
	fs.writeFileSync(
		path.join(outputDir, 'index.js'),
		`export const phpMasterVersion = ${JSON.stringify(phpVersion)};\n` +
			`export const phpMasterRef = ${JSON.stringify(phpRef)};\n` +
			`const availableModes = ${JSON.stringify(modes)};\n` +
			`function selectMode(asyncMode) {\n` +
			`\treturn availableModes.includes(asyncMode) ? asyncMode : availableModes[0];\n` +
			`}\n` +
			`export async function getPHPLoaderModule(asyncMode = 'asyncify') {\n` +
			`\tconst mode = selectMode(asyncMode);\n` +
			`\treturn mode === 'jspi'\n` +
			`\t\t? await import('./jspi/${loaderFilename}')\n` +
			`\t\t: await import('./asyncify/${loaderFilename}');\n` +
			`}\n` +
			`export async function getIntlExtensionPath(asyncMode = 'asyncify') {\n` +
			`\tconst mode = selectMode(asyncMode);\n` +
			`\treturn new URL(\n` +
			`\t\t\`./\${mode}/extensions/intl/intl.so\`,\n` +
			`\t\timport.meta.url\n` +
			`\t).href;\n` +
			`}\n`
	);
}

function writeManifest() {
	fs.writeFileSync(
		path.join(outputDir, 'manifest.json'),
		JSON.stringify(
			{
				phpVersion,
				phpRef,
				builtAt: new Date().toISOString(),
				modes,
				loaderFilename,
			},
			null,
			2
		) + '\n'
	);
}

function writeReadme() {
	fs.writeFileSync(
		path.join(outputDir, 'README.md'),
		`# PHP master WebAssembly builds\n\n` +
			`Generated from php-src ref \`${phpRef}\` at PHP version ` +
			`\`${phpVersion}\` for modes: ${modes.join(', ')}.\n\n` +
			`These artifacts are published from the ` +
			`\`refresh-php-master.yml\` workflow and consumed by ` +
			`playground.wordpress.net.\n`
	);
}

async function fetchPHPVersion(ref) {
	const header = await fetchText(
		`https://raw.githubusercontent.com/php/php-src/${ref}/main/php_version.h`
	);
	const values = Object.fromEntries(
		Array.from(
			header.matchAll(/^#define\s+(PHP_[A-Z_]+)\s+(.+)$/gm),
			([, name, value]) => [name, value.trim().replace(/^"|"$/g, '')]
		)
	);
	return (
		[
			values.PHP_MAJOR_VERSION,
			values.PHP_MINOR_VERSION,
			values.PHP_RELEASE_VERSION,
		].join('.') + (values.PHP_EXTRA_VERSION || '')
	);
}

function fetchText(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				if (response.statusCode !== 200) {
					reject(
						new Error(
							`Failed to fetch ${url}: ${response.statusCode}`
						)
					);
					response.resume();
					return;
				}
				let body = '';
				response.setEncoding('utf8');
				response.on('data', (chunk) => (body += chunk));
				response.on('end', () => resolve(body));
			})
			.on('error', reject);
	});
}

function asyncSpawn(command, args, options) {
	console.log('Running', command, args.join(' '), '...');
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, options);
		child.on('close', (code) => {
			if (code === 0) {
				resolve(code);
			} else {
				reject(new Error(`Process exited with code ${code}`));
			}
		});
	});
}
