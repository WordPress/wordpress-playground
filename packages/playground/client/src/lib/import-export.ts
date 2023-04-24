import type { PHPResponse, PlaygroundClient } from '../';
import { phpVars } from '@php-wasm/util';

// @ts-ignore
import migrationsPHPCode from './migration.php?raw';

/**
 * Full site export support:
 */

/**
 * Export the current site as a zip file.
 *
 * @param playground Playground client.
 */
export async function zipEntireSite(playground: PlaygroundClient) {
	const wpVersion = await playground.wordPressVersion;
	const phpVersion = await playground.phpVersion;
	const zipName = `wordpress-playground--wp${wpVersion}--php${phpVersion}.zip`;
	const zipPath = `/${zipName}`;

	const js = phpVars({
		zipPath,
		documentRoot: await playground.documentRoot,
	});
	await phpMigration(
		playground,
		`zipDir(${js.documentRoot}, ${js.zipPath});`
	);

	const fileBuffer = await playground.readFileAsBuffer(zipPath);
	playground.unlink(zipPath);

	return new File([fileBuffer], zipName);
}

/**
 * Replace the current site with the contents of a full site zip file.
 *
 * @param playground Playground client.
 * @param fullSiteZip Zipped WordPress site.
 */
export async function replaceSite(
	playground: PlaygroundClient,
	fullSiteZip: File
) {
	const zipPath = '/import.zip';
	await playground.writeFile(
		zipPath,
		new Uint8Array(await fullSiteZip.arrayBuffer())
	);

	const absoluteUrl = await playground.absoluteUrl;
	const documentRoot = await playground.documentRoot;

	await playground.rmdir(documentRoot);
	await unzip(playground, zipPath, '/');

	const js = phpVars({ absoluteUrl });
	await patchFile(
		playground,
		`${documentRoot}/wp-config.php`,
		(contents) =>
			`<?php
			if(!defined('WP_HOME')) {
				define('WP_HOME', ${js.absoluteUrl});
				define('WP_SITEURL', ${js.absoluteUrl});
			}
			?>${contents}`
	);
}

/**
 * Unzip a zip file.
 *
 * @param playground Playground client.
 * @param zipPath The zip file to unzip.
 * @param extractTo The directory to extract the zip file to.
 */
export async function unzip(
	playground: PlaygroundClient,
	zipPath: string,
	extractTo: string
) {
	const js = phpVars({
		zipPath,
		extractTo,
	});
	await phpMigration(playground, `unzip(${js.zipPath}, ${js.extractTo});`);
}

/**
 * WXR and WXZ files support:
 */

/**
 * Exports the WordPress database as a WXR file using
 * the core WordPress export tool.
 *
 * @param playground Playground client
 * @returns WXR file
 */
export async function exportWXR(playground: PlaygroundClient) {
	const databaseExportResponse = await playground.request({
		url: '/wp-admin/export.php?download=true&content=all',
	});
	return new File([databaseExportResponse.bytes], 'export.xml');
}

/**
 * Exports the WordPress database as a WXZ file using
 * the export-wxz plugin from https://github.com/akirk/export-wxz.
 *
 * @param playground Playground client
 * @returns WXZ file
 */
export async function exportWXZ(playground: PlaygroundClient) {
	const databaseExportResponse = await playground.request({
		url: '/wp-admin/export.php?download=true&content=all&export_wxz=1',
	});
	return new File([databaseExportResponse.bytes], 'export.wxz');
}

/**
 * Uploads a file to the WordPress importer and returns the response.
 * Supports both WXR and WXZ files.
 *
 * @see https://github.com/WordPress/wordpress-importer/compare/master...akirk:wordpress-importer:import-wxz.patch
 * @param playground Playground client.
 * @param file The file to import.
 */
export async function submitImporterForm(
	playground: PlaygroundClient,
	file: File
) {
	const importerPageOneResponse = await playground.request({
		url: '/wp-admin/admin.php?import=wordpress',
	});

	const firstUrlAction = DOM(importerPageOneResponse)
		.getElementById('import-upload-form')
		?.getAttribute('action');

	const stepOneResponse = await playground.request({
		url: `/wp-admin/${firstUrlAction}`,
		method: 'POST',
		files: { import: file },
	});

	// Map authors of imported posts to existing users
	const importForm = DOM(stepOneResponse).querySelector(
		'#wpbody-content form'
	) as HTMLFormElement;

	if (!importForm) {
		console.log(stepOneResponse.text);
		throw new Error(
			'Could not find an importer form in response. See the response text above for details.'
		);
	}

	const data = getFormData(importForm);
	data['fetch_attachments'] = '1';
	for (const key in data) {
		if (key.startsWith('user_map[')) {
			const newKey = 'user_new[' + key.slice(9, -1) + ']';
			data[newKey] = '1'; // Hardcoded admin ID for now
		}
	}

	return await playground.request({
		url: importForm.action,
		method: 'POST',
		formData: data,
	});
}

function DOM(response: PHPResponse) {
	return new DOMParser().parseFromString(response.text, 'text/html');
}

function getFormData(form: HTMLFormElement): Record<string, unknown> {
	return Object.fromEntries((new FormData(form) as any).entries());
}

async function patchFile(
	playground: PlaygroundClient,
	path: string,
	callback: (contents: string) => string
) {
	await playground.writeFile(
		path,
		callback(await playground.readFileAsText(path))
	);
}

async function phpMigration(playground: PlaygroundClient, code: string) {
	const result = await playground.run({
		code: migrationsPHPCode + code,
	});
	if (result.exitCode !== 0) {
		console.log(migrationsPHPCode + code);
		console.log(code + '');
		console.log(result.errors);
		throw result.errors;
	}
	return result;
}
