import fs from 'node:fs';
import nodePath from 'node:path';

const vitePlugins = [
	{
		name: 'base64-loader',
		resolveId(source: string, importer: string | undefined) {
			if (!source.includes('?base64')) return null;
			const cleanPath = source.split('?')[0];
			const resolved = importer
				? nodePath.resolve(nodePath.dirname(importer), cleanPath)
				: cleanPath;
			return resolved + '?base64';
		},
		load(id: string) {
			const url = new URL(id, 'file://');
			if (!url.searchParams.has('base64')) return null;
			const filePath = url.pathname;

			const data = fs.readFileSync(filePath);
			const base64 = data.toString('base64');

			return `export default Uint8Array.from(atob('${base64}'), c => c.charCodeAt(0));`;
		},
	},
];

export default vitePlugins;
