import { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';
import { StepHandler } from '.';

// @ts-ignore
import migrationsPHPCode from './migration';

/**
 * Full site export support:
 */

/**
 * Export the current site as a zip file.
 *
 * @param playground Playground client.
 */
export async function zipEntireSite(playground: UniversalPHP) {
	const zipName = 'wordpress-playground.zip';
	const zipPath = `/tmp/${zipName}`;

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
 * @inheritDoc replaceSite
 * @example
 *
 * <code>
 * {
 * 		"step": "replaceSite",
 * 		"fullSiteZip": "https://mysite.com/import.zip"
 * }
 * </code>
 */
export interface ReplaceSiteStep<ResourceType> {
	step: 'replaceSite';
	/** The zip file containing the new WordPress site */
	fullSiteZip: ResourceType;
}

/**
 * Replace the current site with a site from the provided zip file.
 * Remember to install the SQLite integration plugin in the zipped site:
 * https://wordpress.org/plugins/sqlite-database-integration.
 *
 * @param playground Playground client.
 * @param fullSiteZip Zipped WordPress site.
 */
export const replaceSite: StepHandler<ReplaceSiteStep<File>> = async (
	playground,
	{ fullSiteZip }
) => {
	const zipPath = '/import.zip';
	await playground.writeFile(
		zipPath,
		new Uint8Array(await fullSiteZip.arrayBuffer())
	);

	const absoluteUrl = await playground.absoluteUrl;
	const documentRoot = await playground.documentRoot;

	await playground.rmdir(documentRoot);
	await unzip(playground, { zipPath, extractToPath: '/' });

	const js = phpVars({ absoluteUrl });
	await updateFile(
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
};

/**
 * @inheritDoc unzip
 * @example
 *
 * <code>
 * {
 * 		"step": "unzip",
 * 		"zipPath": "/wordpress/data.zip",
 * 		"extractToPath": "/wordpress"
 * }
 * </code>
 */
export interface UnzipStep {
	step: 'unzip';
	/** The zip file to extract */
	zipPath: string;
	/** The path to extract the zip file to */
	extractToPath: string;
}

/**
 * Unzip a zip file.
 *
 * @param playground Playground client.
 * @param zipPath The zip file to unzip.
 * @param extractTo The directory to extract the zip file to.
 */
export const unzip: StepHandler<UnzipStep> = async (
	playground,
	{ zipPath, extractToPath }
) => {
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await phpMigration(
		playground,
		`unzip(${js.zipPath}, ${js.extractToPath});`
	);
};

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
export async function exportWXR(playground: UniversalPHP) {
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
export async function exportWXZ(playground: UniversalPHP) {
	const databaseExportResponse = await playground.request({
		url: '/wp-admin/export.php?download=true&content=all&export_wxz=1',
	});
	return new File([databaseExportResponse.bytes], 'export.wxz');
}

/**
 * @inheritDoc importFile
 * @example
 *
 * <code>
 * {
 * 		"step": "importFile",
 * 		"file": "https://mysite.com/import.WXR"
 * }
 * </code>
 */
export interface ImportFileStep<ResourceType> {
	step: 'importFile';
	/** The file to import */
	file: ResourceType;
}

/**
 * Uploads a file to the WordPress importer and returns the response.
 * Supports both WXR and WXZ files.
 *
 * @see https://github.com/WordPress/wordpress-importer/compare/master...akirk:wordpress-importer:import-wxz.patch
 * @param playground Playground client.
 * @param file The file to import.
 */
export const importFile: StepHandler<ImportFileStep<File>> = async (
	playground,
	{ file }
) => {
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

	await playground.request({
		url: importForm.action,
		method: 'POST',
		formData: data,
	});
};

function DOM(response: PHPResponse) {
	return new DOMParser().parseFromString(response.text, 'text/html');
}

function getFormData(form: HTMLFormElement): Record<string, unknown> {
	return Object.fromEntries((new FormData(form) as any).entries());
}

async function updateFile(
	playground: UniversalPHP,
	path: string,
	callback: (contents: string) => string
) {
	await playground.writeFile(
		path,
		callback(await playground.readFileAsText(path))
	);
}

async function phpMigration(playground: UniversalPHP, code: string) {
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
