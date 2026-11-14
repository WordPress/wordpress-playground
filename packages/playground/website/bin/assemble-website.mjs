/**
 * Assemble the website's upload from the package builds.
 *
 * The build:wasm-wordpress-net target and the WordPress-frame preview both use
 * this, so the preview's installer and browser checks cover exactly the pages
 * that production publishes. Top-level dotfiles of the remote, website, and
 * extras builds are not copied, as with the former `cp -r <build>/*` commands;
 * the remote and website Apache rules are concatenated instead.
 *
 * Usage: node assemble-website.mjs <dist-directory> <output-directory> <blueprint-schema>
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { joinPaths } from '../../../php-wasm/util/src/lib/paths.ts';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} dist Directory holding the client, remote, website, and website-extras builds.
 * @param {string} output Directory to replace with the assembled website.
 * @param {string} blueprintSchema Blueprint JSON schema to publish at the root.
 */
export async function assembleWebsite(dist, output, blueprintSchema) {
	await rm(output, { recursive: true, force: true });
	await mkdir(output, { recursive: true });
	await cp(blueprintSchema, joinPaths(output, 'blueprint-schema.json'));
	await cp(joinPaths(dist, 'client'), joinPaths(output, 'client'), {
		recursive: true,
	});
	for (const name of ['remote', 'website', 'website-extras']) {
		for (const entry of await readdir(joinPaths(dist, name))) {
			if (entry.startsWith('.')) continue;
			await cp(joinPaths(dist, name, entry), joinPaths(output, entry), {
				recursive: true,
			});
		}
	}
	await writeFile(
		joinPaths(output, '.htaccess'),
		Buffer.concat([
			await readFile(joinPaths(dist, 'remote', '.htaccess')),
			await readFile(joinPaths(dist, 'website', '.htaccess')),
		])
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [dist, output, blueprintSchema] = process.argv.slice(2);
	if (!dist || !output || !blueprintSchema) {
		throw new Error(
			'Usage: assemble-website.mjs <dist-directory> <output-directory> <blueprint-schema>'
		);
	}
	await assembleWebsite(dist, output, blueprintSchema);
}
