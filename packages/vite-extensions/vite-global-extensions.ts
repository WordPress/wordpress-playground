import fs from 'node:fs';

const vitePlugins = [
	{
		name: 'base64-loader',
		transform(_: any, id: string) {
			const url = new URL(id, 'file://');
			if (!url.searchParams.has('base64')) return null;
			const path = url.pathname;

			const data = fs.readFileSync(path);
			const base64 = data.toString('base64');

			return `export default Uint8Array.from(atob('${base64}'), c => c.charCodeAt(0));`;
		},
	},
];

export default vitePlugins;
