import type { V2StepHandler } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { registerV2StepHandler } from './index';

/**
 * Executes a PHP script provided as a data reference.
 *
 * The `code` argument is resolved through the data reference
 * resolver to obtain the PHP source. The source is written to a
 * temporary file on the VFS and then executed via
 * `context.php.run()`. Optional environment variables can be
 * passed and are set via `putenv()` before the script runs.
 */
export const runPHPHandler: V2StepHandler = async (args, context) => {
	const { code, env } = args as {
		code: DataSources.DataReference;
		env?: Record<string, string>;
	};

	const resolved = await context.dataReferenceResolver.resolveFile(code);
	const phpCode = new TextDecoder().decode(resolved.contents);

	// Build a wrapper that sets environment variables before
	// executing the user-provided PHP code.
	let wrapper = '<?php\n';
	if (env) {
		for (const [key, value] of Object.entries(env)) {
			const escapedKey = key.replace(/'/g, "\\'");
			const escapedValue = value.replace(/'/g, "\\'");
			wrapper += `putenv('${escapedKey}=${escapedValue}');\n`;
		}
	}

	// If the source already starts with a PHP opening tag,
	// strip it so we do not nest opening tags.
	const trimmedCode = phpCode.trimStart();
	if (trimmedCode.startsWith('<?php')) {
		wrapper += trimmedCode.slice(5);
	} else if (trimmedCode.startsWith('<?')) {
		wrapper += trimmedCode.slice(2);
	} else {
		wrapper += trimmedCode;
	}

	const tempPath = '/tmp/blueprint-run-php.php';
	await context.php.writeFile(tempPath, wrapper);
	const result = await context.php.run({ scriptPath: tempPath });
	if (result.errors) {
		throw new Error(result.errors);
	}
};

registerV2StepHandler('runPHP', runPHPHandler);
