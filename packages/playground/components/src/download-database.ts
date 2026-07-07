import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';

const DATABASE_DOWNLOAD_FILENAME = 'database.sqlite';
// The download request goes through the Playground service worker/PHP queue.
// Keep the script around longer than the PHP request timeout so cleanup cannot
// delete it before a queued download starts.
const TEMPORARY_DOWNLOAD_SCRIPT_TTL = 60_000;
// Keep the iframe around longer than the temporary PHP script. Removing the
// frame can cancel a slow browser download even after the PHP script started.
const DOWNLOAD_FRAME_TTL = 10 * TEMPORARY_DOWNLOAD_SCRIPT_TTL;

export type DatabaseDownloadPlayground = {
	absoluteUrl: Promise<string>;
	documentRoot: Promise<string>;
	fileExists(path: string): Promise<boolean>;
	writeFile(path: string, contents: string): Promise<void>;
	unlink(path: string): Promise<void>;
};

export async function downloadDatabase(
	playground: DatabaseDownloadPlayground,
	databasePath: string
): Promise<void> {
	const fileExists = await playground.fileExists(databasePath);
	if (!fileExists) {
		throw new Error('Database file does not exist');
	}

	const token = createDownloadToken();
	const scriptFileName = `.playground-database-download-${token}.php`;
	const documentRoot = await playground.documentRoot;
	const scriptPath = joinPaths(documentRoot, scriptFileName);
	let downloadStarted = false;

	try {
		await playground.writeFile(
			scriptPath,
			createDatabaseDownloadScript(databasePath, token)
		);
		const playgroundUrl = await playground.absoluteUrl;
		startDownloadInHiddenFrame(
			createDatabaseDownloadUrl(playgroundUrl, scriptFileName, token)
		);
		downloadStarted = true;
	} finally {
		if (downloadStarted) {
			scheduleDownloadScriptCleanup(playground, scriptPath);
		} else {
			await removeDownloadScript(playground, scriptPath);
		}
	}
}

export function createDatabaseDownloadScript(
	databasePath: string,
	token: string
): string {
	assertValidDownloadToken(token);
	const cleanupFunction = `playground_database_download_cleanup_${token}`;
	const statusFunction = `playground_database_download_status_${token}`;
	return `<?php
$databasePath = ${phpSingleQuotedString(databasePath)};
$expectedToken = ${phpSingleQuotedString(token)};

function ${cleanupFunction}() {
	@unlink(__FILE__);
}

function ${statusFunction}($code, $text) {
	header('HTTP/1.1 ' . $code . ' ' . $text, true, $code);
}

$providedToken = isset($_GET['token']) && is_string($_GET['token'])
	? $_GET['token']
	: '';
if ($providedToken !== $expectedToken) {
	${statusFunction}(403, 'Forbidden');
	exit;
}

register_shutdown_function('${cleanupFunction}');

if (!is_file($databasePath)) {
	${statusFunction}(404, 'Not Found');
	exit;
}

$databaseSize = filesize($databasePath);
if ($databaseSize === false) {
	${statusFunction}(500, 'Internal Server Error');
	exit;
}

$handle = fopen($databasePath, 'rb');
if ($handle === false) {
	${statusFunction}(500, 'Internal Server Error');
	exit;
}

header('Content-Type: application/x-sqlite3');
header('Content-Disposition: attachment; filename="${DATABASE_DOWNLOAD_FILENAME}"');
header('Content-Length: ' . $databaseSize);

while (!feof($handle)) {
	$chunk = fread($handle, 1048576);
	if ($chunk === false) {
		fclose($handle);
		exit;
	}
	if ($chunk === '') {
		break;
	}
	echo $chunk;
	flush();
}

fclose($handle);
`;
}

function assertValidDownloadToken(token: string): void {
	if (!/^[a-f0-9]{32}$/.test(token)) {
		throw new Error('Invalid database download token.');
	}
}

function createDownloadToken(): string {
	const bytes = new Uint8Array(16);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
		''
	);
}

function createDatabaseDownloadUrl(
	playgroundUrl: string,
	scriptFileName: string,
	token: string
): string {
	const baseUrl = playgroundUrl.endsWith('/')
		? playgroundUrl
		: `${playgroundUrl}/`;
	const url = new URL(scriptFileName, baseUrl);
	url.searchParams.set('token', token);
	return url.toString();
}

function startDownloadInHiddenFrame(downloadUrl: string): void {
	const frame = document.createElement('iframe');
	frame.hidden = true;
	frame.src = downloadUrl;
	frame.title = '';
	frame.setAttribute('aria-hidden', 'true');
	document.body.appendChild(frame);
	window.setTimeout(() => {
		frame.remove();
	}, DOWNLOAD_FRAME_TTL);
}

function scheduleDownloadScriptCleanup(
	playground: DatabaseDownloadPlayground,
	scriptPath: string
): void {
	window.setTimeout(() => {
		void removeDownloadScript(playground, scriptPath).catch((error) => {
			logger.error(
				'Failed to remove temporary database download script',
				error
			);
		});
	}, TEMPORARY_DOWNLOAD_SCRIPT_TTL);
}

async function removeDownloadScript(
	playground: DatabaseDownloadPlayground,
	scriptPath: string
): Promise<void> {
	try {
		await playground.unlink(scriptPath);
	} catch (error) {
		if (await playground.fileExists(scriptPath).catch(() => false)) {
			throw error;
		}
	}
}

function phpSingleQuotedString(value: string): string {
	return `'${value.replace(/['\\]/g, '\\$&')}'`;
}
