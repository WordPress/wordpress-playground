import path from 'path';
import { spawn } from 'child_process';
import yargs from 'yargs';
import { promises as fs } from 'fs';

const parser = yargs(process.argv.slice(2))
	.usage('Usage: $0 [options]')
	.options({
		wpVersion: {
			type: 'string',
			description:
				'The WordPress version to download. Can be a major version like 6.4 or "beta" or "nightly".',
			required: true,
		},
		['output-js']: {
			type: 'string',
			description: 'wp.js and wp.data output directory',
			required: true,
		},
		['output-assets']: {
			type: 'string',
			description: 'WordPress static files output directory',
			required: true,
		},
	});

const args = parser.argv;

const releasesPageResponse = await fetch(
	'https://wordpress.org/download/releases/'
);
const releasesPage = await releasesPageResponse.text();

const versionInfo = {};
if (args.wpVersion === 'nightly') {
	versionInfo.url =
		'https://wordpress.org/nightly-builds/wordpress-latest.zip';
	versionInfo.version = 'nightly';
	versionInfo.majorVersion = 'nightly';
	versionInfo.slug = 'nightly';
} else if (args.wpVersion === 'beta') {
	const matches = releasesPage.match(
		/https:\/\/wordpress\.org\/wordpress-(\d\.\d-(?:RC|beta|alpha)\d)\.zip/
	);
	if (!matches) {
		throw new Error('Could not find a beta version');
	}
	versionInfo.url = matches[0];
	versionInfo.version = matches[1];
	versionInfo.majorVersion = matches[1].substring(0, 3);
	versionInfo.slug = 'beta';
} else if (args.wpVersion.startsWith('latest')) {
	const latestBranches = releasesPage
		.match(/(\d\.\d) Branch/g)
		.slice(0, 4)
		.map((branch) => branch.replace(' Branch', ''));
	const wpBranch = {
		latest: latestBranches[0],
		'latest-minus-1': latestBranches[1],
		'latest-minus-2': latestBranches[2],
		'latest-minus-3': latestBranches[3],
	}[args.wpVersion];

	const matches = releasesPage.match(
		new RegExp(`https://wordpress.org/wordpress-(${wpBranch}\\.\\d)\\.zip`)
	);
	if (!matches) {
		throw new Error('Could not find version ' + wpBranch);
	}
	versionInfo.url = matches[0];
	versionInfo.version = matches[1];
	versionInfo.majorVersion = matches[1].substring(0, 3);
	versionInfo.slug = versionInfo.majorVersion;
} else if (args.wpVersion.match(/\d\.\d/)) {
	const matches = releasesPage.match(
		new RegExp(
			`https://wordpress.org/wordpress-(${args.wpVersion}(?:\\.\\d)?)\\.zip`
		)
	);
	if (!matches) {
		throw new Error('Could not find version ' + args.wpVersion);
	}
	versionInfo.url = matches[0];
	versionInfo.version = matches[1];
	versionInfo.majorVersion = args.wpVersion;
	versionInfo.slug = versionInfo.majorVersion;
} else {
	process.stdout.write(`WP version ${parser.wpVersion} is not supported\n`);
	process.stdout.write(await parser.getHelp());
	process.exit(1);
}

const sourceDir = path.dirname(new URL(import.meta.url).pathname);
const outputAssetsDir = path.resolve(process.cwd(), args.outputAssets);
const outputJsDir = path.resolve(process.cwd(), args.outputJs);

// Build WordPress
await asyncSpawn(
	'docker',
	[
		'build',
		'.',
		'--tag=wordpress-playground',
		'--build-arg',
		`WP_ZIP_URL=${versionInfo.url}`,
		'--build-arg',
		`OUT_FILENAME=wp-${versionInfo.slug}`,
	],
	{ cwd: sourceDir, stdio: 'inherit' }
);

// Extract the WordPress static root with wp-includes/ etc
await asyncSpawn(
	'docker',
	[
		'run',
		'--name',
		'wordpress-playground-tmp',
		'--rm',
		'-v',
		`${outputAssetsDir}:/output`,
		'wordpress-playground',
		// Use sh -c because wildcards are a shell feature and
		// they don't work without running cp through shell.
		'sh',
		'-c',
		`cp -r /root/output/wp-${versionInfo.slug} /output/`,
	],
	{ cwd: sourceDir, stdio: 'inherit' }
);

// Extract wp.js and wp.data
await asyncSpawn(
	'docker',
	[
		'run',
		'--name',
		'wordpress-playground-tmp',
		'--rm',
		'-v',
		`${outputJsDir}:/output`,
		'wordpress-playground',
		// Use sh -c because wildcards are a shell feature and
		// they don't work without running cp through shell.
		'sh',
		'-c',
		`cp -r /root/output/*.js /root/output/*.data /output/`,
	],
	{ cwd: sourceDir, stdio: 'inherit' }
);

// Update the WordPress versions JSON
const versionsPath = `${outputJsDir}/wp-versions.json`;
let versions = {};
try {
	const data = await fs.readFile(versionsPath, 'utf8');
	versions = JSON.parse(data);
} catch (e) {
	// If the existing JSON file doesn't exist or cannot be read,
	// just ignore that and create a new one.
}

// Set WordPress version
versions[versionInfo.slug] = versionInfo.version;

// Sort version keys, which are strings, in an ascending order
versions = Object.keys(versions)
	.sort()
	.reverse()
	.reduce((acc, key) => {
		acc[key] = versions[key];
		return acc;
	}, {});

// Write the updated JSON back to the file
await fs.writeFile(versionsPath, JSON.stringify(versions, null, 2));

const latestStableVersion = Object.keys(versions).filter((v) => v.match(/^\d/))[0];

// Refresh get-wordpress-module.ts
const getWordPressModulePath = `${outputJsDir}/get-wordpress-module.ts`;
const getWordPressModuleContent = `
/**
 * This file was auto generated by packages/playground/wordpress/build/build.js
 * DO NOT CHANGE MANUALLY!
 * This file must statically exists in the project because of the way
 * vite resolves imports.
 */
export function getWordPressModule(wpVersion: string = ${JSON.stringify(latestStableVersion)}) {
	switch (wpVersion) {
		${Object.keys(versions)
			.map(
				(version) => `
		case '${version}':
			/** @ts-ignore */
			return import('./wp-${version}.js');`
			)
			.join('')}

	}
	throw new Error('Unsupported WordPress module: ' + wpVersion);
}
`;
await fs.writeFile(getWordPressModulePath, getWordPressModuleContent);

function asyncSpawn(...args) {
	return new Promise((resolve, reject) => {
		const child = spawn(...args);

		child.on('close', (code) => {
			if (code === 0) resolve(code);
			else reject(new Error(`Process exited with code ${code}`));
		});
	});
}
