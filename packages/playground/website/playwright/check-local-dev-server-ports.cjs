const net = require('node:net');

// The website dev target launches and proxies this fixed-port stack. Check every
// service up front so a partial stack cannot mix code from different worktrees.
const ports = [
	['playground-website', 5400],
	['playground-remote', 4400],
	['playground-php-cors-proxy', 5263],
	['playground-website-extras', 6400],
];

async function main() {
	// This escape hatch is for developers who intentionally manage the complete
	// server stack themselves and accept responsibility for its provenance.
	if (process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1') {
		return;
	}

	const unavailable = [];
	for (const [name, port] of ports) {
		if (!(await canListen(port))) {
			unavailable.push(`${name} on 127.0.0.1:${port}`);
		}
	}

	if (unavailable.length === 0) {
		return;
	}

	console.error(
		`Local Playwright needs to start a clean dev-server stack, but these ` +
			`ports are already in use:\n\n` +
			unavailable.map((entry) => `  - ${entry}`).join('\n') +
			`\n\nStop the existing process, or start the full dev server stack ` +
			`yourself and set PLAYWRIGHT_REUSE_EXISTING_SERVER=1.`
	);
	process.exit(1);
}

function canListen(port) {
	// Attempting the same bind that the dev server needs catches non-HTTP and
	// half-started processes that an HTTP health probe could overlook.
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', (error) => {
			if (error.code === 'EADDRINUSE') {
				resolve(false);
				return;
			}
			reject(error);
		});
		server.listen(port, '127.0.0.1', () => {
			server.close(() => resolve(true));
		});
	});
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
