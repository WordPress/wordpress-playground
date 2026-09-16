import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { decodeZip } from '@php-wasm/stream-compression';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, joinPaths } from '@php-wasm/util';
import {
	cachedDownload,
	fetchSqliteIntegration,
} from '../blueprints-v1/download';
import type { PHPRequest, PHPResponse } from '@php-wasm/universal';
import type { KernelLimitedPHPApi } from './php-api';

import DISABLE_WP_MAIL_MU_PLUGIN_PHP from './wp-templates/disable-wp-mail.php?raw';
import AUTO_LOGIN_MU_PLUGIN_PHP from './wp-templates/auto-login.php?raw';
import WP_CONFIG_PHP from './wp-templates/wp-config.php?raw';

export interface PrepareWordPressOptions {
	wordPressRoot: string;
	wpVersionQuery?: string;
	onStatus?: (message: string) => void;
}

export interface PrepareWordPressResult {
	wordPressRoot: string;
	wpVersion: string;
	skipped: boolean;
}

export async function prepareWordPressForPosixKernel(
	options: PrepareWordPressOptions
): Promise<PrepareWordPressResult> {
	const { wordPressRoot, wpVersionQuery = 'latest', onStatus } = options;

	mkdirSync(wordPressRoot, { recursive: true });

	let skipped = false;
	let wpVersion: string;

	if (existsSync(joinPaths(wordPressRoot, 'wp-settings.php'))) {
		wpVersion = 'cached';
		skipped = true;
	} else {
		const release = await resolveWordPressRelease(wpVersionQuery);
		wpVersion = release.version;

		onStatus?.(`Downloading WordPress ${release.version}`);
		const monitor = new EmscriptenDownloadMonitor();
		const wpZip = await cachedDownload(
			release.releaseUrl,
			`${release.version}.zip`,
			monitor
		);
		const wpZipBytes = new Uint8Array(await wpZip.arrayBuffer());

		onStatus?.('Extracting WordPress');
		await extractZipToDir(wpZipBytes, wordPressRoot, {
			stripRootDir: true,
		});
	}

	await ensureSqliteIntegrationPlugin(wordPressRoot, onStatus);
	ensureDbDropIn(wordPressRoot);
	ensureWpConfig(wordPressRoot);
	ensureDatabaseDir(wordPressRoot);
	ensureAutoLoginMuPlugin(wordPressRoot);
	ensureDisableWpMailMuPlugin(wordPressRoot);

	return { wordPressRoot, wpVersion, skipped };
}

export async function ensureWordPressInstalled(
	api: KernelLimitedPHPApi
): Promise<void> {
	const probe = await requestAwaitingReadiness(api, {
		method: 'GET',
		url: '/',
	});
	assertNonErrorResponse(probe, 'readiness probe');
	const probeLocation = probe.headers['location']?.[0] ?? '';
	const installRequired =
		probe.httpStatusCode === 302 && probeLocation.includes('install.php');
	if (!installRequired) {
		return;
	}

	const formBody = new URLSearchParams({
		weblog_title: 'My WordPress Website',
		user_name: 'admin',
		admin_password: 'password',
		admin_password2: 'password',
		pw_weak: '1',
		admin_email: 'admin@example.com',
		blog_public: '1',
		Submit: 'Install WordPress',
	}).toString();

	const attempts = 3;
	let lastHtml = '';
	for (let attempt = 1; attempt <= attempts; attempt++) {
		const installResponse = await requestAwaitingReadiness(api, {
			method: 'POST',
			url: '/wp-admin/install.php?step=2',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formBody,
		});
		if (installResponse.httpStatusCode !== 200) {
			throw new Error(
				`WordPress install request failed: HTTP ` +
					`${installResponse.httpStatusCode}`
			);
		}
		lastHtml = new TextDecoder().decode(installResponse.bytes);
		if (
			lastHtml.includes('Success') ||
			lastHtml.includes('WordPress has been installed')
		) {
			return;
		}

		const recheck = await requestAwaitingReadiness(api, {
			method: 'GET',
			url: '/',
		});
		assertNonErrorResponse(recheck, 'post-install recheck');
		const recheckLocation = recheck.headers['location']?.[0] ?? '';
		const stillRequired =
			recheck.httpStatusCode === 302 &&
			recheckLocation.includes('install.php');
		if (!stillRequired) {
			return;
		}
	}
	throw new Error(
		`WordPress installer did not report success: ` +
			`${lastHtml.slice(0, 1000)}`
	);
}

function assertNonErrorResponse(response: PHPResponse, context: string): void {
	if (response.httpStatusCode < 400) {
		return;
	}
	const body = new TextDecoder().decode(response.bytes);
	throw new Error(
		`WordPress ${context} failed: HTTP ${response.httpStatusCode}: ` +
			`${body.slice(0, 1000)}`
	);
}

const TRANSIENT_GATEWAY_STATUSES = new Set([502, 503, 504]);

async function requestAwaitingReadiness(
	api: KernelLimitedPHPApi,
	request: PHPRequest,
	attempts = 8,
	backoffMs = 250
): Promise<PHPResponse> {
	let response = await api.request(request);
	for (
		let attempt = 1;
		attempt < attempts &&
		TRANSIENT_GATEWAY_STATUSES.has(response.httpStatusCode);
		attempt++
	) {
		await delay(backoffMs);
		response = await api.request(request);
	}
	return response;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureAutoLoginMuPlugin(wordPressRoot: string): void {
	const path = joinPaths(
		wordPressRoot,
		'wp-content/mu-plugins/1-playground-auto-login.php'
	);
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		return;
	}
	writeFileSync(path, AUTO_LOGIN_MU_PLUGIN_PHP);
}

function ensureDisableWpMailMuPlugin(wordPressRoot: string): void {
	const path = joinPaths(
		wordPressRoot,
		'wp-content/mu-plugins/0-disable-wp-mail.php'
	);
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		return;
	}
	writeFileSync(path, DISABLE_WP_MAIL_MU_PLUGIN_PHP);
}

export async function ensureSqliteIntegrationPlugin(
	wordPressRoot: string,
	onStatus?: (message: string) => void
): Promise<void> {
	const sqlitePluginDir = joinPaths(
		wordPressRoot,
		'wp-content/plugins/sqlite-database-integration'
	);
	if (existsSync(joinPaths(sqlitePluginDir, 'load.php'))) {
		return;
	}
	onStatus?.('Installing SQLite Database Integration');
	mkdirSync(sqlitePluginDir, { recursive: true });
	const sqliteZip = await fetchSqliteIntegration('trunk');
	const sqliteZipBytes = new Uint8Array(await sqliteZip.arrayBuffer());
	await extractZipToDir(sqliteZipBytes, sqlitePluginDir, {
		stripRootDir: true,
	});
	if (!existsSync(joinPaths(sqlitePluginDir, 'load.php'))) {
		throw new Error(
			`SQLite integration archive did not contain load.php ` +
				`under its root directory`
		);
	}
}

export function ensureDbDropIn(wordPressRoot: string): void {
	const wpContent = joinPaths(wordPressRoot, 'wp-content');
	const dbDropIn = joinPaths(wpContent, 'db.php');
	if (existsSync(dbDropIn)) {
		return;
	}
	const source = joinPaths(
		wpContent,
		'plugins/sqlite-database-integration/db.copy'
	);
	if (!existsSync(source)) {
		throw new Error(`SQLite integration db.copy not found at ${source}`);
	}
	copyFileSync(source, dbDropIn);
}

function ensureWpConfig(wordPressRoot: string): void {
	const wpConfigPath = joinPaths(wordPressRoot, 'wp-config.php');
	if (existsSync(wpConfigPath)) {
		return;
	}
	writeFileSync(wpConfigPath, WP_CONFIG_PHP);
}

function ensureDatabaseDir(wordPressRoot: string): void {
	const databaseDir = joinPaths(wordPressRoot, 'wp-content/database');
	mkdirSync(databaseDir, { recursive: true });
}

interface ExtractZipOptions {
	stripRootDir?: boolean;
}

async function extractZipToDir(
	zipBytes: Uint8Array,
	destDir: string,
	options: ExtractZipOptions = {}
): Promise<void> {
	const stream = new ReadableStream({
		type: 'bytes',
		start(controller) {
			controller.enqueue(new Uint8Array(zipBytes));
			controller.close();
		},
	} as UnderlyingByteSource) as ReadableStream<Uint8Array>;

	const reader = decodeZip(stream).getReader();

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}
		let pathStr = value.name;
		if (options.stripRootDir) {
			const stripped = stripRootDir(pathStr);
			if (stripped === null) {
				continue;
			}
			pathStr = stripped;
		}
		if (pathStr === '' || pathStr === '/') {
			continue;
		}
		const targetPath = joinPaths(destDir, pathStr);
		if (value.type === 'directory') {
			mkdirSync(targetPath, { recursive: true });
			continue;
		}
		mkdirSync(dirname(targetPath), { recursive: true });
		const bytes = new Uint8Array(await value.arrayBuffer());
		writeFileSync(targetPath, bytes);
	}
}

export function stripRootDir(path: string): string | null {
	const slash = path.indexOf('/');
	if (slash === -1) {
		return null;
	}
	return path.slice(slash + 1);
}
