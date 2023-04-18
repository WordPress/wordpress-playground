import { saveAs } from 'file-saver';
import type { PlaygroundClient } from '../';

// @ts-ignore
import migrationsPHPCode from './migration.php?raw';

export async function exportFullSiteZip(playground: PlaygroundClient) {
	saveAs(await zipFullSite(playground));
}

async function zipFullSite(playground: PlaygroundClient) {
	const wpVersion = await playground.wordPressVersion;
	const phpVersion = await playground.phpVersion;
	const zipName = `wordpress-playground--wp${wpVersion}--php${phpVersion}.zip`;
	const zipPath = `/${zipName}`;

	const documentRoot = await playground.documentRoot;
	await phpMigration(playground, `
	zipDir('${documentRoot}', '${zipPath}' );
	`);

	const fileBuffer = await playground.readFileAsBuffer(zipPath);
	playground.unlink(zipPath);
	return new File([fileBuffer], zipName);
}

export async function importFullSiteZip(playground: PlaygroundClient, fullSiteZip: File) {
	const zipPath = '/import.zip';
	await playground.writeFile(
		zipPath,
		new Uint8Array(await fullSiteZip.arrayBuffer())
	);

	const absoluteUrl = await playground.absoluteUrl;
	const documentRoot = await playground.documentRoot;

	await phpMigration(playground, `
	delTree('${documentRoot}');
	unzip('${zipPath}', '/' );
	`);

	await patchFile(
		playground,
		`${documentRoot}/wp-config.php`,
		(contents) =>
			`<?php
			if(!defined('WP_HOME')) {
				define('WP_HOME', "${absoluteUrl}");
				define('WP_SITEURL', "${absoluteUrl}");
			}
			?>${contents}`
	);

	return true;
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
		console.log(result.errors);
		throw result.errors;
	}
	return result;
}
