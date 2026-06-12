const { PHP } = require('@php-wasm/universal');
const { loadNodeRuntime } = require('@php-wasm/node');

const phpVersion = process.argv[2];
if (!phpVersion) {
	throw new Error('PHP version argument is required');
}

(async () => {
	const php = new PHP(
		await loadNodeRuntime(phpVersion, {
			emscriptenOptions: { processId: 1 },
			extensions: ['intl', 'xdebug'],
		})
	);
	try {
		const response = await php.runStream({
			code: `<?php
				echo extension_loaded('intl') ? "intl=yes\n" : "intl=no\n";
				echo extension_loaded('xdebug') ? "xdebug=yes\n" : "xdebug=no\n";
			`,
		});
		const output = await response.stdoutText;
		if (output !== 'intl=yes\nxdebug=yes\n') {
			throw new Error(
				`Unexpected extension output: ${JSON.stringify(output)}`
			);
		}

		const intlIni = php.readFileAsText(
			'/internal/shared/extensions/intl.ini'
		);
		if (intlIni !== 'extension=/internal/shared/extensions/intl.so') {
			throw new Error(`Unexpected intl.ini: ${JSON.stringify(intlIni)}`);
		}

		const xdebugIni = php.readFileAsText(
			'/internal/shared/extensions/xdebug.ini'
		);
		if (
			!xdebugIni.startsWith(
				'zend_extension=/internal/shared/extensions/xdebug.so'
			)
		) {
			throw new Error(
				`Unexpected xdebug.ini: ${JSON.stringify(xdebugIni)}`
			);
		}
	} finally {
		php.exit();
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
