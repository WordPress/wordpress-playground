/**
 * Utility for downloading plugin/theme files as a ZIP archive.
 *
 * Uses PHP's ZipArchive to create the ZIP file inside WordPress Playground,
 * then downloads it to the user's machine.
 */

import type { PlaygroundClient } from '@wp-playground/client';

export default async function downloadZippedPackage(
	client: PlaygroundClient,
	codeEditorMode: string
) {
	const docroot = await client.documentRoot;
	const isTheme = codeEditorMode === 'theme';
	const path = isTheme
		? `${docroot}/wp-content/themes/demo-theme`
		: `${docroot}/wp-content/plugins/demo-plugin`;
	const filename = isTheme ? 'demo-theme.zip' : 'demo-plugin.zip';

	const zipBuffer = await zipPlaygroundFiles(client, path);
	const blob = new Blob([zipBuffer], { type: 'application/zip' });
	downloadFile(blob, filename);
}

async function zipPlaygroundFiles(
	client: PlaygroundClient,
	path: string
): Promise<Uint8Array> {
	const zipPath = '/tmp/package.zip';

	// Remove existing zip file if present
	try {
		await client.unlink(zipPath);
	} catch {
		// File doesn't exist, that's fine
	}

	// Create ZIP using PHP's ZipArchive
	await client.run({
		code: `<?php
			$zip = new ZipArchive();
			$zip->open('${zipPath}', ZipArchive::CREATE | ZipArchive::OVERWRITE);

			$path = '${path}';
			$iterator = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS),
				RecursiveIteratorIterator::SELF_FIRST
			);

			foreach ($iterator as $file) {
				$filePath = $file->getRealPath();
				$relativePath = substr($filePath, strlen($path) + 1);

				if ($file->isDir()) {
					$zip->addEmptyDir($relativePath);
				} else {
					$zip->addFile($filePath, $relativePath);
				}
			}

			$zip->close();
		`,
	});

	return await client.readFileAsBuffer(zipPath);
}

function downloadFile(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
