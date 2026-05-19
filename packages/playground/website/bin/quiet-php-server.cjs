#!/usr/bin/env node

/**
 * Wraps `php -S` and filters out the noisy startup/teardown chatter
 * the built-in server logs to stderr — one "Development Server
 * started" banner per worker (×20 with PHP_CLI_SERVER_WORKERS=20),
 * plus per-request "Accepted" / "Closing" lines and the spurious
 * "Failed to poll event" warning we get when PHP is built against
 * libevent and has nothing to do.
 *
 * Usage: node quiet-php-server.cjs <host:port> <script.php>
 *
 * The wrapper inherits the parent process's environment so the
 * relay's PHP_CLI_SERVER_WORKERS, PLAYGROUND_RELAY_PUBLIC_BASE_URL,
 * DB_*, etc. all get through unchanged.
 */

const { spawn } = require('child_process');

const address = process.argv[2];
const script = process.argv[3];

if (!address || !script) {
	console.error('usage: quiet-php-server.cjs <host:port> <script.php>');
	process.exit(2);
}

/**
 * Lines we never want to see in the dev terminal. Anything else —
 * real PHP errors, our own error_log() calls, unfamiliar warnings —
 * still gets forwarded to stderr so the developer sees it.
 */
const noisePatterns = [
	/PHP \d+\.\d+\.\d+ Development Server \(http:\/\/[^)]+\) started/,
	/\[[^\]]+\] [\d.]+:\d+ Accepted$/,
	/\[[^\]]+\] [\d.]+:\d+ Closing$/,
	/\[[^\]]+\] Failed to poll event$/,
];

function isNoise(line) {
	const trimmed = line.replace(/^\[\d+\] /, '');
	return noisePatterns.some((p) => p.test(trimmed));
}

const child = spawn('php', ['-S', address, script], {
	stdio: ['inherit', 'inherit', 'pipe'],
	env: process.env,
});

let buffer = '';
child.stderr.on('data', (chunk) => {
	buffer += chunk.toString();
	const lines = buffer.split('\n');
	buffer = lines.pop() ?? '';
	for (const line of lines) {
		if (!isNoise(line)) {
			process.stderr.write(line + '\n');
		}
	}
});
child.stderr.on('end', () => {
	if (buffer && !isNoise(buffer)) {
		process.stderr.write(buffer);
	}
});

child.on('error', (err) => {
	console.error('quiet-php-server: failed to spawn php:', err.message);
	process.exit(1);
});
child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
	} else {
		process.exit(code ?? 0);
	}
});

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, () => {
		if (!child.killed) {
			child.kill(sig);
		}
	});
}
