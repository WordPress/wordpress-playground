// rollup.config.js
import typescript from '@rollup/plugin-typescript';

const path = (filename) => new URL(filename, import.meta.url).pathname;
export default [
	{
		input: path`./src/bundler/react-fast-refresh/setup-react-refresh-runtime.js`,
		output: {
			dir: 'build',
			format: 'iife',
		},
		plugins: [
			typescript(),
		],
	},
];
