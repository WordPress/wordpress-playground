import { createFilter, dataToEsm } from './rollup-plugin-utils';
import type { Plugin } from '@rollup/browser';

type JsonPluginOptions = {
	include?: RegExp | RegExp[] | string | string[];
	exclude?: RegExp | RegExp[] | string | string[];
	indent?: string;
	preferConst?: boolean;
	compact?: boolean;
	namedExports?: boolean;
};
export default function json(options: JsonPluginOptions = {}): Plugin {
	options.include = options.include || /\.json$/;
	const filter = createFilter(options.include, options.exclude);
	const indent = 'indent' in options ? options.indent : '\t';

	return {
		name: 'json',

		// eslint-disable-next-line no-shadow
		transform(code, id) {
			if (id.slice(-5) !== '.json' || !filter(id)) {
				return null;
			}
			try {
				const parsed = JSON.parse(code);
				return {
					code: dataToEsm(parsed, {
						preferConst: options.preferConst,
						compact: options.compact,
						namedExports: options.namedExports,
						indent,
					}),
					map: { mappings: '' },
				};
			} catch (err) {
				if (err instanceof Error) {
					const message = 'Could not parse JSON file';
					const position = parseInt(
						(/[\d]/.exec(err.message) || [])[0],
						10
					);
					this.warn({ message, id, position } as any);
				}
				console.error(err);
				return null;
			}
		},
	};
}
