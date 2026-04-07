#!/usr/bin/env node

/**
 * Starts the PHP CORS proxy, the PHP relay server, and the preview
 * server for CI e2e runs. Ensures the proxy and relay both bind to
 * their ports before starting the preview server, and exits
 * immediately if any child process crashes.
 *
 * The relay is needed for the share Playground tests in
 * sharing.spec.ts: the static preview build can serve relay.php as
 * a file but can't execute it, so we run a real `php -S` next to
 * the cors-proxy and let the vite preview proxy /relay/* into it.
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const workspaceRoot =
	process.env.NX_WORKSPACE_ROOT_PATH ??
	path.resolve(__dirname, '../../../..');
const corsProxyHost = process.env.CORS_PROXY_HOST ?? '127.0.0.1';
const corsProxyPort = Number(process.env.CORS_PROXY_PORT ?? '5263');
const relayHost = process.env.RELAY_HOST ?? '127.0.0.1';
const relayPort = Number(process.env.RELAY_PORT ?? '5264');
const waitTimeoutMs = Number(
	process.env.CORS_PROXY_READY_TIMEOUT_MS ?? '15000'
);
const waitIntervalMs = 250;

const nxBin = require.resolve('nx/bin/nx.js');
const nodeBinary = process.execPath;

/** @type {import('child_process').ChildProcess | null} */
let proxyProcess = null;
/** @type {import('child_process').ChildProcess | null} */
let relayProcess = null;
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

function checkPort(host, port) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ port, host });
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

async function waitForPort(name, host, port) {
	const start = Date.now();
	for (;;) {
		try {
			await checkPort(host, port);
			return;
		} catch {
			if (Date.now() - start > waitTimeoutMs) {
				throw new Error(
					`Timed out waiting for ${name} to bind on ${host}:${port}`
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
	cleanupChild(relayProcess);
	cleanupChild(proxyProcess);
	process.exit(code);
}

process.once('SIGINT', () => cleanupAndExit(130));
process.once('SIGTERM', () => cleanupAndExit(143));
process.once('exit', () => {
	cleanupChild(previewProcess);
	cleanupChild(relayProcess);
	cleanupChild(proxyProcess);
});

async function main() {
	proxyProcess = spawnNxTarget('playground-php-cors-proxy:start');
	registerProcessHooks(proxyProcess, 'playground-php-cors-proxy');

	relayProcess = spawnNxTarget('playground-website:preview:relay-php');
	registerProcessHooks(relayProcess, 'playground-website:preview:relay-php');

	await Promise.all([
		waitForPort('playground-php-cors-proxy', corsProxyHost, corsProxyPort),
		waitForPort('playground-website:preview:relay-php', relayHost, relayPort),
	]).catch((error) => {
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
