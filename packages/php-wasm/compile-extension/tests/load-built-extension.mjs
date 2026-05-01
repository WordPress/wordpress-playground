import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';

const [manifestPath, phpVersion, code, expectedOutput] = process.argv.slice(2);

if (!manifestPath || !phpVersion || !code) {
	throw new Error(
		'Usage: load-built-extension.mjs <manifest> <php-version> <php-code> <expected-output>'
	);
}

const php = new PHP(
	await loadNodeRuntime(phpVersion, {
		emscriptenOptions: { processId: 1 },
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: manifestPath,
				},
			},
		],
	})
);
try {
	const result = await php.run({ code });
	if (result.errors) {
		throw new Error(result.errors);
	}
	if (result.text !== expectedOutput) {
		throw new Error(
			`Expected ${JSON.stringify(expectedOutput)}, got ${JSON.stringify(
				result.text
			)}`
		);
	}
} finally {
	php.exit();
}
