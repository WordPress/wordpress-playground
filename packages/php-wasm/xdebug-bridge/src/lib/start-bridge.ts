import { logger } from '@php-wasm/logger';
import type { PHP } from '@php-wasm/universal';
import { readdirSync, readFileSync, lstatSync } from 'fs';
import path from 'path';
import { CDPServer } from './cdp-server';
import { DbgpSession } from './dbgp-session';
import { XdebugCDPBridge } from './xdebug-cdp-bridge';

export type StartBridgeConfig = {
	cdpPort?: number;
	cdpHost?: string;
	dbgpPort?: number;
	phpRoot?: string;
	phpInstance?: PHP;
	getPHPFile?: (path: string) => string | Promise<string>;
	breakOnFirstLine?: boolean;
};

export async function startBridge(config: StartBridgeConfig) {
	const cdpPort = config.cdpPort ?? 9229;
	const dbgpPort = config.dbgpPort ?? 9003;
	const cdpHost = config.cdpHost ?? 'localhost';
	const phpRoot = config.phpRoot ?? process.cwd();
	const breakOnFirstLine = config.breakOnFirstLine ?? false;

	logger.log('Starting XDebug Bridge...');

	// Entry point to start the service
	const cdpServer = new CDPServer(cdpPort);

	logger.log('Connect Chrome DevTools to CDP at:');
	logger.log(
		`devtools://devtools/bundled/inspector.html?ws=${cdpHost}:${cdpPort}\n`
	);

	await new Promise((resolve) => cdpServer.on('clientConnected', resolve));
	await new Promise((resolve) => setTimeout(resolve, 2000));

	logger.log('Chrome connected! Initializing Xdebug receiver...');

	const dbgpSession = new DbgpSession(dbgpPort);

	logger.log(`XDebug receiver running on port ${dbgpPort}`);
	logger.log('Running a PHP script with Xdebug enabled...');

	// Recursively get a list of .php files in phpRoot
	function getPhpFiles(dir: string): string[] {
		const results: string[] = [];
		const list = readdirSync(dir);
		for (const file of list) {
			const filePath = path.join(dir, file);
			// lstat avoids crashes when encountering symlinks
			const stat = lstatSync(filePath);
			if (stat && stat.isDirectory()) {
				results.push(...getPhpFiles(filePath));
			} else if (file.endsWith('.php')) {
				results.push(filePath);
			}
		}
		return results;
	}

	const getPHPFile = config.phpInstance
		? (path: string) => config.phpInstance!.readFileAsText(path)
		: config.getPHPFile
		? config.getPHPFile
		: (path: string) => readFileSync(path, 'utf-8');

	const phpFiles = getPhpFiles(phpRoot);
	return new XdebugCDPBridge(dbgpSession, cdpServer, {
		knownScriptUrls: phpFiles,
		phpRoot,
		getPHPFile,
		breakOnFirstLine,
	});
}
