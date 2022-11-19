import * as babel from '@babel/standalone';
import type { Plugin } from '@rollup/browser';

type BabelPluginOptions = {
	plugins: any[];
};

export default function babelForRollup(options: BabelPluginOptions): Plugin {
	return {
		name: 'babel-plugin',
		transform(code) {
			return (babel as any).transform(code, {
				plugins: options.plugins,
			}).code;
		},
	};
}
