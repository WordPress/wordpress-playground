import type { Plugin } from '@rollup/browser';
import type { MemFile } from './common';

type ProvideDependenciesOptions = {
	files: MemFile[];
	inputPrefix: string;
};

export default function provideDependencies(
	options: ProvideDependenciesOptions
): Plugin {
	const filesIndex = options.files.reduce((acc, file) => {
		acc[file.fileName] = file.contents;
		return acc;
	}, {} as Record<string, string>);

	return {
		name: 'rollup-dependency-loader',
		resolveId(importee, importer) {
			return new URL(importee, importer).href;
		},
		load(id) {
			const relativePath = id.substring(options.inputPrefix.length);
			if (!(relativePath in filesIndex)) {
				throw new Error(`Could not find file ${relativePath}`);
			}
			return filesIndex[relativePath];
		},
	};
}
