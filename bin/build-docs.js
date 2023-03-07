const path = require('path');
const glob = require('glob');
const fs = require('fs');
const { spawnSync } = require('child_process');

function buildDocs(cb) {
	const dtsPath = (suffix) => path.join(__dirname, 'build-types', suffix);
	spawnSync(
		'node',
		[
			'build-scripts/tsdoc-to-api-markdown.js',
			'-e',
			dtsPath('php-wasm/index.d.ts'),
			dtsPath('php-wasm-browser/index.d.ts'),
			dtsPath('php-wasm-browser/service-worker/worker-library.d.ts'),
			dtsPath('php-wasm-browser/worker-thread/worker-library.d.ts'),
			dtsPath('wordpress-playground/index.d.ts'),
			dtsPath('wordpress-playground/service-worker.d.ts'),
			dtsPath('wordpress-playground/worker-thread.d.ts'),
			dtsPath('wordpress-plugin-ide/index.d.ts'),
			'-o',
			path.join(__dirname, 'docs', 'api'),
		],
		{
			cwd: __dirname,
			stdio: 'inherit',
		}
	);
	cb();
}
