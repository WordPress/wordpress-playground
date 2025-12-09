import type { Plugin } from 'vite';

export interface PreserveLoadersRule {
	regex: RegExp;
	transform: (specifier: string) => string;
}

export function vitePreserveLoadersImports(
	rules: PreserveLoadersRule[]
): Plugin {
	let command: 'build' | 'serve';

	const matchedRules = new Set<PreserveLoadersRule>();

	return {
		/**
		 * Vite can't extract static asset in the library mode:
		 * https://github.com/vitejs/vite/issues/3295
		 *
		 * This workaround replaces the actual php.js modules paths used
		 * in the dev mode with their filenames. Then, the filenames are marked
		 * as external further down in this config. As a result, the final
		 * bundle contains literal `import('php.js')` and
		 * `import('php.wasm')` statements which allows the consumers to use
		 * their own loaders.
		 *
		 * This keeps the dev mode working AND avoids inlining 5mb of
		 * wasm via base64 in the final bundle.
		 */
		name: 'vite-preserve-loaders-imports',

		configResolved(config) {
			command = config.command;
		},

		resolveDynamicImport(specifier) {
			if (command !== 'build' || typeof specifier !== 'string') return;

			for (const rule of rules) {
				if (new RegExp(rule.regex).test(specifier)) {
					matchedRules.add(rule);
					/**
					 *
					 * Example : transform: specifier => `../${specifier.split('/').slice(-3).join('/')}`
					 *
					 * The '../' is weird but necessary to make the final build say
					 * import("./php/jspi/php.js")
					 * and not
					 * import("php/jspi/php.js")
					 *
					 * The -3 will ensure the 'php/jspi/'
					 * portion of the path is preserved.
					 */
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
					`vite-preserve-loaders-imports: The following rules did not match any dynamic imports:\n${details}\n\n` +
						`This is likely a misconfiguration or a stale regex.`
				);
			}
		},
	};
}
