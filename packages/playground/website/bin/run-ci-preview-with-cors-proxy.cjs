#!/usr/bin/env node

/**
 * Starts the PHP CORS proxy and the preview server for CI e2e runs.
 * Ensures the proxy binds to its port before starting the preview server
 * and exits immediately if either child process crashes.
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const workspaceRoot =
	process.env.NX_WORKSPACE_ROOT_PATH ??
	path.resolve(__dirname, '../../../..');
const corsProxyHost = process.env.CORS_PROXY_HOST ?? '127.0.0.1';
const corsProxyPort = Number(process.env.CORS_PROXY_PORT ?? '5263');
const waitTimeoutMs = Number(
	process.env.CORS_PROXY_READY_TIMEOUT_MS ?? '15000'
);
const waitIntervalMs = 250;

const nxBin = require.resolve('nx/bin/nx.js');
const nodeBinary = process.execPath;

/** @type {import('child_process').ChildProcess | null} */
let proxyProcess = null;
/** @type {import('child_process').ChildProcess | null} */
let previewProcess = null;
let shuttingDown = false;

function spawnNxTarget(target) {
	return spawn(nodeBinary, [nxBin, 'run', target], {
		cwd: workspaceRoot,
		stdio: 'inherit',
		env: process.env,
	});
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPort() {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({
			port: corsProxyPort,
			host: corsProxyHost,
		});
		socket.once('connect', () => {
			socket.end();
			resolve();
		});
		socket.once('error', (error) => {
			socket.destroy();
			reject(error);
		});
	});
}

async function waitForProxy() {
	const start = Date.now();
	for (;;) {
		try {
			await checkPort();
			return;
		} catch {
			if (Date.now() - start > waitTimeoutMs) {
				throw new Error(
					`Timed out waiting for playground-php-cors-proxy to bind on ${corsProxyHost}:${corsProxyPort}`
				);
			}
			await wait(waitIntervalMs);
		}
	}
}

function handleUnexpectedExit(name, code) {
	if (shuttingDown) {
		return;
	}
	console.error(
		`${name} exited unexpectedly with code ${code ?? 'null'}. Failing CI run.`
	);
	cleanupAndExit(code ?? 1);
}

function registerProcessHooks(child, name) {
	child.once('exit', (code) => handleUnexpectedExit(name, code));
	child.once('error', (error) => {
		console.error(`${name} failed to start:`, error);
		cleanupAndExit(1);
	});
}

function cleanupChild(child) {
	if (!child || child.killed) {
		return;
	}
	try {
		child.kill();
	} catch (error) {
		console.warn(
			`Failed to kill ${child.spawnargs?.join(' ') ?? 'child'}:`,
			error
		);
	}
}

function cleanupAndExit(code) {
	shuttingDown = true;
	cleanupChild(previewProcess);
	cleanupChild(proxyProcess);
	process.exit(code);
}

process.once('SIGINT', () => cleanupAndExit(130));
process.once('SIGTERM', () => cleanupAndExit(143));
process.once('exit', () => {
	cleanupChild(previewProcess);
	cleanupChild(proxyProcess);
});

async function main() {
	proxyProcess = spawnNxTarget('playground-php-cors-proxy:start');
	registerProcessHooks(proxyProcess, 'playground-php-cors-proxy');

	await waitForProxy().catch((error) => {
		console.error(error.message);
		cleanupAndExit(1);
	});

	previewProcess = spawnNxTarget('playground-website:preview:ci');
	previewProcess.once('error', (error) => {
		console.error(
			'playground-website preview server failed to start:',
			error
		);
		cleanupAndExit(1);
	});

	const exitCode = await new Promise((resolve) => {
		previewProcess.once('exit', (code) => resolve(code));
	});

	cleanupAndExit(exitCode ?? 0);
}

main().catch((error) => {
	const message = error && error.stack ? error.stack : String(error);
	console.error(message);
	cleanupAndExit(1);
});
