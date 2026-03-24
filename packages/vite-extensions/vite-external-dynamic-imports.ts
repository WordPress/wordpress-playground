import type { Plugin } from 'vite';

export interface ExternalDynamicImportRule {
	regex: RegExp;
	transform: (specifier: string) => string;
}

/**
 * Rewrites dynamic import paths so they resolve correctly from the dist output.
 *
 * Vite can't extract static assets in library mode (https://github.com/vitejs/vite/issues/3295).
 * Without this plugin, dynamic imports like `import('../../public/php/jspi/php_8_4.js')`
 * would either be bundled (inlining 5MB+ of WASM as base64) or break entirely.
 *
 * This plugin works together with rollup's `external` option:
 * 1. This plugin rewrites the import paths to be relative to the dist output location
 * 2. The `external` option marks these imports as external so they're preserved as
 *    literal `import()` statements in the bundle
 *
 * The result is that the final bundle contains imports like `import('./php/jspi/php_8_4.js')`
 * which allows consumers to provide their own loaders for these files.
 */
export function viteExternalDynamicImports(
	rules: ExternalDynamicImportRule[]
): Plugin {
	let command: 'build' | 'serve';

	const matchedRules = new Set<ExternalDynamicImportRule>();

	return {
		name: 'vite-external-dynamic-imports',

		configResolved(config) {
			command = config.command;
		},

		resolveDynamicImport(specifier) {
			if (command !== 'build' || typeof specifier !== 'string') return;

			for (const rule of rules) {
				if (new RegExp(rule.regex).test(specifier)) {
					matchedRules.add(rule);
					return rule.transform(specifier);
				}
			}

			return null;
		},

		buildEnd() {
			if (command !== 'build') return;

			const unusedRules = rules.filter((rule) => !matchedRules.has(rule));

			if (unusedRules.length > 0) {
				const details = unusedRules
					.map((rule) => `- ${rule.regex}`)
					.join('\n');

				this.error(
					`vite-external-dynamic-imports: The following rules did not match any dynamic imports:\n${details}\n\n` +
						`This is likely a misconfiguration or a stale regex.`
				);
			}
		},
	};
}

// Backwards compatibility alias
export const vitePreserveLoadersImports = viteExternalDynamicImports;
export type PreserveLoadersRule = ExternalDynamicImportRule;
